-- ============================================================
-- Attendly MVP — Supabase Schema + RLS
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── ENUM types ───────────────────────────────────────────────
do $$ begin
  create type plan_type      as enum ('FREE', 'PRO');
  create type attendance_status as enum ('PRESENT', 'ABSENT', 'LATE');
  create type message_type   as enum ('ATTENDANCE', 'PAYMENT');
  create type message_tone   as enum ('FRIENDLY', 'FORMAL', 'FIRM');
  create type message_status as enum ('DRAFT', 'SENT', 'FAILED');
exception
  when duplicate_object then null;
end $$;

-- ── 1. profiles ──────────────────────────────────────────────
-- One row per auth user. Created automatically via trigger.
create table if not exists profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  plan                  plan_type    not null default 'FREE',
  sms_sent_count        integer      not null default 0,
  sms_sent_count_month  text         not null default to_char(now(), 'YYYY-MM'), -- e.g. '2026-02'
  created_at            timestamptz  not null default now(),
  updated_at            timestamptz  not null default now()
);

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 2. students ──────────────────────────────────────────────
create table if not exists students (
  id           uuid         primary key default uuid_generate_v4(),
  owner_id     uuid         not null references auth.users(id) on delete cascade,
  name         text         not null,
  parent_phone text         not null,          -- stored as 010xxxxxxxx, normalized on send
  class_name   text         not null default '',
  memo         text         not null default '',
  is_unpaid    boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

create index if not exists students_owner_id_idx on students(owner_id);

-- ── 3. attendance_records ────────────────────────────────────
create table if not exists attendance_records (
  id          uuid              primary key default uuid_generate_v4(),
  owner_id    uuid              not null references auth.users(id) on delete cascade,
  student_id  uuid              not null references students(id) on delete cascade,
  date        date              not null,
  status      attendance_status not null default 'PRESENT',
  created_at  timestamptz       not null default now(),
  -- one record per student per day
  unique (owner_id, student_id, date)
);

create index if not exists attendance_owner_date_idx on attendance_records(owner_id, date);

-- ── 4. messages (Outbox) ─────────────────────────────────────
create table if not exists messages (
  id                  uuid           primary key default uuid_generate_v4(),
  owner_id            uuid           not null references auth.users(id) on delete cascade,
  student_id          uuid           references students(id) on delete set null,
  type                message_type   not null,
  tone                message_tone   not null default 'FRIENDLY',
  content             text           not null,
  status              message_status not null default 'DRAFT',
  provider_message_id text,          -- Twilio SID on success
  error               text,          -- error message on failure
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now()
);

create index if not exists messages_owner_status_idx on messages(owner_id, status);

-- ── updated_at trigger (shared) ──────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists set_students_updated_at on students;
create trigger set_students_updated_at
  before update on students
  for each row execute function set_updated_at();

drop trigger if exists set_messages_updated_at on messages;
create trigger set_messages_updated_at
  before update on messages
  for each row execute function set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table profiles          enable row level security;
alter table students          enable row level security;
alter table attendance_records enable row level security;
alter table messages          enable row level security;

-- ── profiles ─────────────────────────────────────────────────
drop policy if exists "profiles: select own" on profiles;
create policy "profiles: select own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: update own" on profiles;
create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);

-- Service role (Workers) can bypass RLS via SUPABASE_SERVICE_ROLE_KEY
-- No insert policy needed — trigger handles it.

-- ── students ─────────────────────────────────────────────────
drop policy if exists "students: all own" on students;
create policy "students: all own" on students
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── attendance_records ───────────────────────────────────────
drop policy if exists "attendance: all own" on attendance_records;
create policy "attendance: all own" on attendance_records
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── messages ─────────────────────────────────────────────────
drop policy if exists "messages: all own" on messages;
create policy "messages: all own" on messages
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
