# Attendly (해커톤 MVP)

## 목표
해커톤 예선 통과를 위해 "실제로 작동하는 제품"을 만든다.

1. 실제로 동작하는 웹서비스 (Vercel 배포)
2. OpenAI API로 미납 리마인드 / 전체 공지 문자를 생성
3. Solapi로 한국 휴대폰(010)으로 실제 SMS 발송
4. 수익성: Polar 구독 결제(Checkout) + 결제 성공 시 PRO 플랜 전환(webhook)
5. 발송 로그/상태(DRAFT/SENT/FAILED)가 DB에 저장되고 UI에서 확인
6. Outbox에서 여러 메시지를 선택해서 "선택 전송(Bulk send)" 가능

## 이번 MVP에서 하지 않을 것
- 카카오 알림톡 연동
- 멀티테넌시(여러 학원/지점) / 복잡한 권한
- 완벽한 아키텍처/테스트 커버리지

---

## 기술 스택 (변경 금지)

| 영역 | 기술 |
|---|---|
| **프론트** | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| **DB / Auth** | Supabase (Postgres + RLS) |
| **API Routes** | Next.js API Routes (`preferredRegion = 'iad1'`) |
| **배포** | Vercel (https://attendly-mu.vercel.app) |
| **SMS** | Solapi (한국 번호 지원, HMAC-SHA256 인증) |
| **AI** | OpenAI gpt-4o-mini |
| **결제** | Polar Subscription |

---

## 구현된 페이지

| 경로 | 기능 |
|---|---|
| `/` | 랜딩 + Pricing + 업그레이드 CTA |
| `/login` | 이메일/비번 로그인·회원가입 |
| `/app/dashboard` | 학원명 표시, 통계 카드(결석/미납/발송/남은 건수), 빠른 이동 |
| `/app/students` | 학생 CRUD + 이름/반/미납 필터 + 페이징(10건) + 미납 토글 + 월수강료 입력 |
| `/app/attendance` | 날짜별 출결(출석/결석/지각) + 고정 템플릿 선택(기본/친근/간결) → Outbox 저장 |
| `/app/billing` | 미납 학생 목록 + 월수강료·미납개월 편집 + 자동 미수금 계산 + AI 리마인드 생성 |
| `/app/notice` | 전체 공지 AI 생성(휴원/명절/새해/행사/개강/기타) → 전체 학생 Outbox 저장 |
| `/app/outbox` | 메시지 목록 + 상태 필터(ALL/DRAFT/SENT/FAILED) + 페이징(15건) + 단건·선택 전송 + 삭제·재시도 |
| `/app/settings` | 학원명 등록/수정 |

## 구현된 API Routes

| 경로 | 기능 |
|---|---|
| `POST /api/generate-message` | ATTENDANCE·PAYMENT 타입 AI 메시지 생성 + Outbox 저장 |
| `POST /api/generate-notice` | NOTICE 타입 AI 공지 생성 (미저장, 내용만 반환) |
| `POST /api/send-sms` | 단건 SMS 발송 (Solapi) + 쿼터 차감 |
| `POST /api/send-sms-bulk` | 다건 SMS 발송 (Solapi) |
| `POST /api/polar/create-checkout` | Polar 결제 세션 생성 |
| `POST /api/polar/webhook` | Polar webhook → PRO 플랜 전환 |

---

## DB 스키마

```sql
-- profiles: 유저 플랜/발송 카운트/학원명
profiles (id, plan, academy_name, sms_sent_count, sms_sent_count_month)

-- students: 학생 정보
students (id, owner_id, name, parent_phone, class_name, memo,
          is_unpaid, unpaid_months, monthly_fee)

-- attendance_records: 날짜별 출결
attendance_records (id, owner_id, student_id, date, status)
-- status: PRESENT | ABSENT | LATE

-- messages: Outbox
messages (id, owner_id, student_id, type, tone, content, status,
          provider_message_id, error)
-- type: ATTENDANCE | PAYMENT | NOTICE
-- status: DRAFT | SENT | FAILED
```

※ 모든 테이블 RLS: `owner_id = auth.uid()`

---

## 환경변수 (Vercel)

```
# Public
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Server-only (API Routes)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
SOLAPI_API_KEY
SOLAPI_API_SECRET
SOLAPI_SENDER_NUMBER
POLAR_ACCESS_TOKEN
POLAR_PRODUCT_ID
POLAR_WEBHOOK_SECRET
APP_BASE_URL
```

---

## 핵심 규칙

- 비밀키는 API Routes에서만 사용 (클라이언트 금지)
- 전화번호 정규화: 010xxxxxxxx → Solapi는 010xxxxxxxx 그대로 사용
- 레이트리밋: 사용자당 분당 최대 5회
- 무료 플랜: 월 20건 / PRO: 월 300건
- 출결 문자: AI 미사용, 고정 템플릿 (비용 절감)
- 미납 문자: AI 사용 (학원명 + 미납 개월 수 포함)
- 공지 문자: AI 사용 (학원명 포함)

---

## 디자인 원칙

- **색상 시스템**: indigo-600 (primary), gray-50/100 (bg), red/green/orange (상태)
- **카드**: `bg-white border border-gray-200 rounded-xl`
- **버튼 primary**: `bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition`
- **버튼 secondary**: `border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition`
- **인풋**: `border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300`
- **테이블 헤더**: `bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide`
- **페이지 제목**: `text-2xl font-bold text-gray-900`
- **페이지 레이아웃**: `space-y-6`

---

## 로컬 실행

```bash
npm install
npm run dev   # localhost:3000
```

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://yuzygpommgawbmdrzsxn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_URL=https://yuzygpommgawbmdrzsxn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
SOLAPI_API_KEY=...
SOLAPI_API_SECRET=...
SOLAPI_SENDER_NUMBER=010xxxxxxxx
POLAR_ACCESS_TOKEN=...
POLAR_PRODUCT_ID=...
POLAR_WEBHOOK_SECRET=...
APP_BASE_URL=http://localhost:3000
```

## 배포

```bash
VERCEL_TOKEN=xxx vercel deploy --prod --yes
```
