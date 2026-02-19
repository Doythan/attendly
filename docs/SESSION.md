# Attendly — 세션 인수인계 문서

> 새 세션 시작 시 이 파일부터 읽을 것

---

## 배포 URL

| 서비스 | URL |
|---|---|
| **프론트 (Cloudflare Pages)** | https://attendly-1lg.pages.dev |
| **Workers API** | https://attendly-workers.won03289.workers.dev |
| **GitHub** | https://github.com/Doythan/attendly |
| **Supabase** | https://yuzygpommgawbmdrzsxn.supabase.co |

---

## 현재 상태 (2026-02-19 기준)

### ✅ 완료된 것
- 홈(랜딩) 페이지 정상
- `/login` 로그인/회원가입 정상 (Supabase Email Confirm **OFF** 설정됨)
- `/app/dashboard` 정상
- Supabase 스키마 적용 완료 (`supabase/schema.sql`)
- Cloudflare Workers 배포 완료 + 시크릿 설정 완료
- Cloudflare Pages 환경변수 설정 완료

### 🔴 미확인 / 테스트 필요
- AI 안내문 생성 → Outbox 저장 (Workers SUPABASE_SERVICE_ROLE_KEY 인증 확인 필요)
- Outbox에서 SMS 전송 (Twilio 설정 확인 필요)
- Polar 결제 → PRO 플랜 전환

---

## 핵심 버그 해결 이력

### 문제 1: `/login` 접속 시 500
- **원인**: `@supabase/ssr`을 import하는 middleware가 Cloudflare Pages에서 정적 pre-render 페이지(/login)에 매칭되면 module load 실패
- **해결**: middleware에서 `/login` 매처 제거 + Supabase 코드 완전 제거
- **파일**: `middleware.ts`

### 문제 2: `/app/dashboard` 500
- **원인**: Supabase Email Confirm ON 상태에서 회원가입 후 세션 없이 대시보드 접근 → redirect() 처리 문제
- **해결 1**: `app/app/layout.tsx`에 try-catch 추가 (Supabase 오류 시 /login으로 redirect)
- **해결 2**: `wrangler.toml` compatibility_date `2025-01-01`, `nodejs_compat_v2`로 업데이트
- **해결 3**: Supabase 대시보드에서 Email Confirm **OFF**

### 문제 3: 홈화면 파비콘만 표시
- **원인**: root layout (`app/layout.tsx`)에 `export const runtime = 'edge'` 추가했다가 정적 페이지 렌더링 깨짐
- **해결**: root layout에서 edge runtime 제거

---

## 아키텍처 요약

```
브라우저
  │
  ├── Cloudflare Pages (attendly-1lg.pages.dev)
  │     Next.js 15 App Router + next-on-pages
  │     ├── / (static)
  │     ├── /login (static, 'use client')
  │     └── /app/* (edge functions, runtime = 'edge')
  │           └── /app/layout.tsx ← Supabase auth 체크 (try-catch)
  │
  └── Cloudflare Workers (attendly-workers.won03289.workers.dev)
        비밀키 사용 API:
        POST /api/generate-message  (OpenAI)
        POST /api/send-sms          (Twilio)
        POST /api/send-sms-bulk     (Twilio)
        POST /api/polar/create-checkout (Polar)
        POST /api/polar/webhook     (Polar → DB plan 업데이트)
```

---

## 환경변수 현황

### Cloudflare Pages 대시보드 (빌드 + 런타임)
```
NEXT_PUBLIC_SUPABASE_URL=https://yuzygpommgawbmdrzsxn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Z9peJ2CystiLxoLAa5dpLw_bwD90etn
NEXT_PUBLIC_WORKERS_URL=https://attendly-workers.won03289.workers.dev
```

### Cloudflare Workers 시크릿 (대시보드에서 설정됨)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
APP_BASE_URL=https://attendly-1lg.pages.dev
```
> POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID, POLAR_WEBHOOK_SECRET 도 필요

### wrangler.toml (workers/)
```toml
OPENAI_MODEL = "gpt-4o-mini"  # [vars]로 설정됨
```

---

## 주요 파일 위치

| 파일 | 역할 |
|---|---|
| `app/layout.tsx` | root layout (edge runtime 없음, static) |
| `app/app/layout.tsx` | /app/* 공통 레이아웃 (edge, auth 체크) |
| `app/app/dashboard/page.tsx` | 대시보드 (edge) |
| `app/app/attendance/page.tsx` | 출결 ('use client') |
| `app/app/outbox/page.tsx` | Outbox ('use client') |
| `app/login/page.tsx` | 로그인 ('use client') |
| `middleware.ts` | no-op (Supabase 제거됨, /app/* 매칭만) |
| `lib/supabase/server.ts` | 서버 Supabase 클라이언트 |
| `lib/supabase/client.ts` | 브라우저 Supabase 클라이언트 |
| `workers/src/index.ts` | Workers 전체 API |
| `supabase/schema.sql` | DB 스키마 (이미 적용됨) |
| `wrangler.toml` | Pages 설정 (compatibility_date: 2025-01-01) |
| `workers/wrangler.toml` | Workers 설정 |

---

## 다음 세션에서 해야 할 것

1. **AI 생성 테스트**: 학생 등록 → 출결에서 결석 체크 → AI 안내문 생성 → Outbox 확인
2. **SMS 전송 테스트**: Outbox에서 메시지 선택 → 전송 → 실제 폰 수신 확인
3. **Polar 결제 테스트**: PRO 업그레이드 플로우

---

## 로컬 실행법

```bash
# 프론트
npm install
npm run dev  # localhost:3000

# Workers
cd workers
npm install
# workers/.dev.vars 파일 생성 후 시크릿 값 입력
npm run dev  # localhost:8787

# Cloudflare Pages 빌드 (배포 전 확인용)
npm run pages:build
```
