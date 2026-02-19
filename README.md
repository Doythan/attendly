# Attendly — 학원 출결 SMS 자동화 (해커톤 MVP)

> 로그인 → 학생 등록 → 출결 저장 → AI 안내문 생성 → Outbox → Twilio SMS 실발송

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프론트 | Next.js 14 (App Router) + TypeScript + Tailwind |
| DB / Auth | Supabase (Postgres + RLS) |
| API | Cloudflare Workers |
| 배포 | Cloudflare Pages (프론트) |
| SMS | Twilio |
| AI | OpenAI (gpt-4o-mini) |
| 결제 | Polar Subscription (한국 지원) |

---

## 로컬 실행

### 1. 환경 변수 설정

```bash
cp .env.example .env.local
# .env.local 에 Supabase URL/Key, Workers URL 입력
```

### 2. Next.js 개발 서버

```bash
npm install
npm run dev        # http://localhost:3000
```

### 3. Workers 로컬 개발

```bash
cd workers
npm install
# workers/.dev.vars 파일에 비밀키 입력
npm run dev        # http://localhost:8787
```

`.dev.vars` 형식 (workers/ 폴더에 생성, git에 커밋 금지):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
POLAR_ACCESS_TOKEN=polar_sk_...
POLAR_PRODUCT_ID=<product UUID from Polar dashboard>
POLAR_WEBHOOK_SECRET=<base64-encoded secret from Polar dashboard>
APP_BASE_URL=http://localhost:3000
```

로컬 `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_WORKERS_URL=http://localhost:8787
APP_BASE_URL=http://localhost:3000
```

---

## Supabase 세팅

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. SQL Editor → **New query** → `supabase/schema.sql` 전체 붙여넣기 → Run
3. Project Settings → API에서 URL / Publishable key / Secret key 복사

---

## Twilio 세팅

1. [twilio.com](https://twilio.com) 콘솔에서 Account SID / Auth Token 확인
2. **Phone Numbers** → 번호 구매 (Trial 크레딧 사용)
3. Trial 계정은 **Verified Caller IDs**에 수신 번호 등록 필요

---

## Polar 세팅 (결제)

1. [polar.sh](https://polar.sh) 접속 → 회원가입 (GitHub 연동 가능, 한국 지원)
2. **Products** → **+ New Product** → 구독 상품 생성
   - Name: `Attendly PRO`
   - Price: ₩29,000 / month (또는 테스트용 $1)
   - 상품 저장 후 **Product ID** (UUID) 복사 → `POLAR_PRODUCT_ID`
3. **Settings** → **Developers** → **API Keys** → **New API Key** → `POLAR_ACCESS_TOKEN`
4. **Settings** → **Webhooks** → **+ Add Endpoint**
   - URL: `https://your-worker.workers.dev/api/polar/webhook`
   - Events: `checkout.updated`
   - **Webhook Secret** 복사 → `POLAR_WEBHOOK_SECRET`
   - ⚠️ secret은 base64-encoded 형식 그대로 사용

---

## Cloudflare 배포

### Workers

```bash
cd workers
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER
npx wrangler secret put POLAR_ACCESS_TOKEN
npx wrangler secret put POLAR_PRODUCT_ID
npx wrangler secret put POLAR_WEBHOOK_SECRET
npx wrangler secret put APP_BASE_URL
npm run deploy
```

### Pages (프론트)

```bash
NEXT_PUBLIC_WORKERS_URL=https://your-worker.workers.dev \
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
npm run build
# out/ 폴더를 Cloudflare Pages에 업로드
```

---

## 시연 체크리스트 (예선 제출용)

- [ ] 1. `/login` 에서 이메일/비번으로 로그인
- [ ] 2. `/app/students` → **더미 데이터 생성 (15명)** 버튼 클릭
- [ ] 3. `/app/attendance` → 오늘 날짜로 학생 2~3명 **결석** 체크 → **출결 저장**
- [ ] 4. **AI 안내문 생성 → Outbox 저장** 클릭
- [ ] 5. `/app/outbox` → 메시지 확인, 체크박스 선택 → **선택 전송** → 확인 모달 → 전송
- [ ] 6. 실제 폰에서 문자 도착 확인
- [ ] 7. Outbox에서 상태 **SENT** 표시 확인
- [ ] 8. `/app/dashboard` → 발송 수 증가 / 남은 건수 감소 확인
- [ ] 9. `/app/billing` → **Polar로 결제 →** 클릭 → 결제 완료
- [ ] 10. 대시보드 복귀 → **PRO 전환 배너** + 플랜 PRO 표시 확인
