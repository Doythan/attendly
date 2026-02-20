# Attendly — 학원 출결·SMS 자동화

> 로그인 → 학생 등록 → 출결 저장 → 안내문 생성 → Outbox → Solapi SMS 실발송

**배포 URL**: https://attendly-mu.vercel.app

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트 | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| DB / Auth | Supabase (Postgres + RLS) |
| API | Next.js API Routes (Vercel, `preferredRegion = 'iad1'`) |
| SMS | Solapi (한국 010 번호 지원) |
| AI | OpenAI gpt-4o-mini |
| 결제 | Polar Subscription |
| 배포 | Vercel |

---

## 주요 기능

- **출결 관리**: 날짜별 출석/결석/지각 기록, 고정 템플릿(기본/친근/간결)으로 안내문 Outbox 저장
- **미납 관리**: 미납 학생 목록, 월 수강료 × 미납 개월 수 자동 계산, AI 미납 리마인드 생성
- **전체 공지**: 휴원/명절/새해/행사 등 유형 선택 → AI 공지 문자 생성 → 전체 학부모 Outbox 저장
- **Outbox**: DRAFT/SENT/FAILED 필터, 페이징, 단건·선택 전송, 내용 수정·삭제·재시도
- **설정**: 학원명 등록 (문자 발송 시 자동 포함)
- **결제**: Polar PRO 플랜 구독 (월 SMS 300건)

---

## 로컬 실행

### 1. 환경 변수 설정

```bash
cp .env.local.example .env.local
# 아래 값들 입력
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

POLAR_ACCESS_TOKEN=polar_sk_...
POLAR_PRODUCT_ID=<UUID>
POLAR_WEBHOOK_SECRET=<base64-encoded>
APP_BASE_URL=http://localhost:3000
```

### 2. 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

---

## Supabase 세팅

1. [supabase.com](https://supabase.com) 프로젝트 생성
2. SQL Editor → `supabase/schema.sql` 전체 실행
3. 추가 마이그레이션 실행:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academy_name text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS unpaid_months integer NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee integer NOT NULL DEFAULT 0;
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'NOTICE';
```

4. Authentication → Email Confirm: **OFF** 설정

---

## Solapi 세팅

1. [solapi.com](https://solapi.com) 가입 → API Key 발급
2. 발신 번호 등록 (본인 인증 필요)
3. `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER` 설정

---

## Polar 세팅 (결제)

1. [polar.sh](https://polar.sh) 가입
2. Products → + New Product → 구독 상품 생성 → `POLAR_PRODUCT_ID`
3. Settings → Developers → API Keys → `POLAR_ACCESS_TOKEN`
4. Settings → Webhooks → Add Endpoint
   - URL: `https://attendly-mu.vercel.app/api/polar/webhook`
   - Events: `checkout.updated`
   - Webhook Secret → `POLAR_WEBHOOK_SECRET`

---

## Vercel 배포

```bash
# Vercel CLI 설치 (이미 있으면 skip)
npm i -g vercel

# 프로덕션 배포
VERCEL_TOKEN=xxx vercel deploy --prod --yes
```

Vercel 대시보드에서 환경변수 등록 후 배포 필요.

---

## 시연 체크리스트 (예선 제출용)

- [ ] 1. `/login` 이메일/비번 로그인
- [ ] 2. `/app/settings` 학원명 등록
- [ ] 3. `/app/students` 더미 데이터 생성 (15명)
- [ ] 4. `/app/attendance` 학생 2~3명 결석 체크 → 출결 저장 → 템플릿 선택 → Outbox 저장
- [ ] 5. `/app/outbox` 메시지 확인 → 선택 전송 → 실제 폰 문자 도착 확인
- [ ] 6. `/app/billing` 미납 개월 수 설정 → AI 리마인드 생성 → Outbox 저장 → 전송
- [ ] 7. `/app/notice` 명절 인사 선택 → AI 생성 → Outbox 저장 → 전체 전송
- [ ] 8. `/app/dashboard` 발송 수 증가 / 남은 건수 감소 확인
- [ ] 9. `/app/billing` Polar 결제 → PRO 전환 확인
