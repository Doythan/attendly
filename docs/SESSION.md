# Attendly — 세션 인수인계 문서

> 새 세션 시작 시 이 파일부터 읽을 것

---

## 배포 URL

| 서비스 | URL |
|---|---|
| **프론트 (Vercel)** | https://attendly-mu.vercel.app |
| ~~Cloudflare Pages~~ | ~~https://attendly-1lg.pages.dev~~ (사용 안 함) |
| ~~Workers API~~ | ~~https://attendly-workers.won03289.workers.dev~~ (사용 안 함) |
| **GitHub** | https://github.com/Doythan/attendly |
| **Supabase** | https://yuzygpommgawbmdrzsxn.supabase.co |

---

## 현재 상태 (2026-02-20 기준)

### ✅ 완료된 것
- 홈(랜딩) + Pricing 페이지 정상
- `/login` 로그인/회원가입 정상 (Supabase Email Confirm **OFF** 설정됨)
- `/app/dashboard` 정상
- `/app/students` 학생 CRUD + 더미데이터 정상
- `/app/attendance` 출결 저장 정상
- `/app/billing` 미납 관리 페이지 정상
- `/app/outbox` Outbox UI 정상
- Supabase 스키마 적용 완료 (`supabase/schema.sql`)
- profiles 트리거 정상 (신규 가입 시 profiles row 자동 생성 확인됨)
- OpenAI API 크레딧 충전 완료 ($5, gpt-4o-mini 사용 중)
- Twilio Trial 계정 확인 (인증된 번호로만 발송 가능)
- **✅ Vercel 이전 완료** (Workers → Next.js API Routes, `preferredRegion = 'iad1'`)
  - `app/api/generate-message/route.ts`
  - `app/api/send-sms/route.ts`
  - `app/api/send-sms-bulk/route.ts`
  - `app/api/polar/create-checkout/route.ts`
  - `app/api/polar/webhook/route.ts`
  - 프론트엔드: `NEXT_PUBLIC_WORKERS_URL` 제거, `/api/...` 직접 호출로 변경
  - `next.config.mjs`: Cloudflare setup 제거
  - `.env.local`: 모든 서버 키 통합 완료
  - 로컬 빌드 성공 확인 (`npm run build` ✅)

- **✅ Vercel 배포 완료**: https://attendly-mu.vercel.app (미국 iad1 서버)
- Next.js 15.5.12으로 업데이트 (CVE-2025-66478 패치)

### 🟡 미완료 (다음 세션)
- SMS 전송 테스트 (Twilio verified number 등록 필요)
- Polar 결제 → PRO 플랜 전환 (POLAR_WEBHOOK_SECRET 미설정)
- AI 안내문 생성 동작 테스트 확인 필요

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

### 문제 4: OpenAI 한국 IP 차단 (미해결 → Vercel 이전으로 해결 예정)
- **원인**: Cloudflare Workers 한국 PoP에서 OpenAI 호출 시 차단
- **해결책**: Vercel API Routes (`preferredRegion = 'iad1'`) 사용

---

## 다음 세션에서 해야 할 것 (우선순위 순)

### 1순위: SMS 전송 테스트
- Twilio 대시보드에서 본인 번호 verified number 등록
- 학생 parent_phone을 그 번호로 설정 후 전송 테스트

### 3순위: Polar 결제
- POLAR_WEBHOOK_SECRET 설정 (Polar 대시보드에서 webhook 등록 후 발급)
- 결제 → PRO 전환 테스트

---

## 아키텍처 (현재 → 목표)

### 현재
```
브라우저
  ├── Cloudflare Pages (attendly-1lg.pages.dev)
  │     Next.js App Router + next-on-pages
  │
  └── Cloudflare Workers (attendly-workers.won03289.workers.dev)
        POST /api/generate-message  ← 한국 IP 차단으로 동작 안 함
        POST /api/send-sms
        POST /api/send-sms-bulk
        POST /api/polar/create-checkout
        POST /api/polar/webhook
```

### 목표 (Vercel 이전 후)
```
브라우저
  └── Vercel (새 URL)
        Next.js App Router
        ├── 프론트엔드 페이지 (기존과 동일)
        └── API Routes (preferredRegion = 'iad1', 미국 서버)
              POST /api/generate-message
              POST /api/send-sms
              POST /api/send-sms-bulk
              POST /api/polar/create-checkout
              POST /api/polar/webhook
```

---

## 환경변수 현황

### Cloudflare Pages (현재)
```
NEXT_PUBLIC_SUPABASE_URL=https://yuzygpommgawbmdrzsxn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Z9peJ2CystiLxoLAa5dpLw_bwD90etn
NEXT_PUBLIC_WORKERS_URL=https://attendly-workers.won03289.workers.dev
```

### Cloudflare Workers 시크릿 (설정됨)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
APP_BASE_URL=https://attendly-1lg.pages.dev
POLAR_ACCESS_TOKEN
POLAR_PRODUCT_ID
```
> POLAR_WEBHOOK_SECRET 미설정

### workers/.dev.vars (로컬, 실제 값 있음)
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
- OPENAI_MODEL=gpt-4o-mini
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER=+18454724310
- POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID 있음
- POLAR_WEBHOOK_SECRET 비어있음
- APP_BASE_URL=http://localhost:3000

### Vercel 이전 시 설정할 환경변수
```
# Public (빌드 시 번들에 포함)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
# NEXT_PUBLIC_WORKERS_URL 불필요 (API Routes 직접 호출)

# Server-only (API Routes에서 사용)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
POLAR_ACCESS_TOKEN
POLAR_PRODUCT_ID
POLAR_WEBHOOK_SECRET
APP_BASE_URL (Vercel 배포 URL)
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
| `workers/src/index.ts` | Workers 전체 API (Vercel 이전 후 불필요) |
| `supabase/schema.sql` | DB 스키마 (이미 적용됨) |
| `wrangler.toml` | Pages 설정 (Vercel 이전 후 불필요) |
| `workers/wrangler.toml` | Workers 설정 (Vercel 이전 후 불필요) |

---

## 로컬 실행법

```bash
# 프론트
npm install
npm run dev  # localhost:3000

# Workers (현재)
cd workers
npm install
# workers/.dev.vars 파일에 시크릿 값 있음
npm run dev  # localhost:8787
```
