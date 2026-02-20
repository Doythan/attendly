# Attendly — 세션 인수인계 문서

> 새 세션 시작 시 이 파일부터 읽을 것

---

## 배포 URL

| 서비스 | URL |
|---|---|
| **프론트 (Vercel)** | https://attendly-mu.vercel.app |
| **GitHub** | https://github.com/Doythan/attendly |
| **Supabase** | https://yuzygpommgawbmdrzsxn.supabase.co |

> Cloudflare Pages/Workers는 더 이상 사용하지 않음

---

## 현재 상태 (2026-02-20 기준)

### ✅ 완료된 것

- 전체 페이지 정상 작동 및 Vercel 배포 완료
- Supabase Email Confirm **OFF** 설정됨
- SMS 실발송 테스트 완료 (Solapi, 한국 010 번호)
- OpenAI AI 안내문 생성 정상 동작 확인
- favicon: `app/icon.png` 사용 중 (favicon.ico 제거됨)
- 모든 DB 마이그레이션 적용 완료

### 페이지별 기능 요약

| 페이지 | 기능 |
|---|---|
| `/app/dashboard` | 학원명 타이틀, 통계 카드(결석/미납/발송/남은 건수 클릭 이동), 빠른 이동 |
| `/app/students` | CRUD + 이름/반/미납 필터 + 10건 페이징 + 미납 토글 버튼 + 월수강료 입력 |
| `/app/attendance` | 출결 저장 + 기본/친근/간결 템플릿 선택 → Outbox 직접 저장 (AI 미사용, 비용 0) |
| `/app/billing` | 미납 목록 + 월수강료·미납개월 편집 + 미수금 자동계산 + AI 템플릿 1회 생성 → 전체 저장 |
| `/app/notice` | 유형 선택(휴원/명절/새해/행사/개강/기타) + AI 생성 → 전체 학생 Outbox 저장 |
| `/app/outbox` | 상태 탭 필터(ALL/DRAFT/SENT/FAILED) + 15건 페이징 + 단건·선택 전송 + 삭제·재시도·수정 |
| `/app/settings` | 학원명 등록/수정 |

### API Routes

| 경로 | 동작 |
|---|---|
| `POST /api/generate-message` | ATTENDANCE·PAYMENT 메시지 생성. `templateMode:true` 시 플레이스홀더 템플릿 반환 (DB 저장 없음) |
| `POST /api/generate-notice` | NOTICE 공지 생성 (내용만 반환, DB 저장 없음) |
| `POST /api/send-sms` | 단건 Solapi 발송 + 쿼터 차감 |
| `POST /api/send-sms-bulk` | 다건 Solapi 발송 |
| `POST /api/polar/create-checkout` | Polar 결제 세션 생성 |
| `POST /api/polar/webhook` | Polar webhook → PRO 전환 |

---

## DB 스키마 (현재 적용 상태)

```sql
-- 기본 스키마
supabase/schema.sql 적용 완료

-- 추가 마이그레이션 (모두 적용됨)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academy_name text NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS unpaid_months integer NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee integer NOT NULL DEFAULT 0;
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'NOTICE';
```

---

## 환경변수 현황

### Vercel (설정 완료)
```
NEXT_PUBLIC_SUPABASE_URL=https://yuzygpommgawbmdrzsxn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Z9peJ2CystiLxoLAa5dpLw_bwD90etn
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
SOLAPI_API_KEY
SOLAPI_API_SECRET
SOLAPI_SENDER_NUMBER
POLAR_ACCESS_TOKEN
POLAR_PRODUCT_ID
POLAR_WEBHOOK_SECRET  ← 미설정 (Polar webhook 미등록)
APP_BASE_URL=https://attendly-mu.vercel.app
```

### 로컬 .env.local
- 실제 값 있음 (git 제외)

---

## 🟡 미완료 / 다음 세션 작업

| 우선순위 | 항목 |
|---|---|
| 🟡 | Polar 결제 → PRO 전환: `POLAR_WEBHOOK_SECRET` Vercel 미설정, Polar 대시보드에 webhook URL 미등록 |
| 🟡 | 시연 영상 촬영 (체크리스트: README.md 참고) |

---

## 핵심 버그 이력 (해결됨)

| 문제 | 해결 |
|---|---|
| middleware에서 Supabase import 시 정적 페이지 500 | middleware no-op 유지, auth는 `/app/layout.tsx`에서 처리 |
| root layout에 edge runtime 추가 시 정적 페이지 깨짐 | root layout에서 edge runtime 제거 |
| OpenAI 한국 IP 차단 | Vercel `preferredRegion='iad1'`으로 해결 |
| SMS 한국 번호 미지원 | Twilio → Solapi로 교체 |
| Solapi 인증 오류 | Node.js `crypto` 모듈 + `.trim()` 방어 처리 |

---

## 아키텍처 (현재)

```
브라우저
  └── Vercel (attendly-mu.vercel.app)
        Next.js 15 App Router
        ├── 페이지 (/login, /app/*)
        └── API Routes (preferredRegion='iad1', 미국 서버)
              POST /api/generate-message
              POST /api/generate-notice
              POST /api/send-sms
              POST /api/send-sms-bulk
              POST /api/polar/create-checkout
              POST /api/polar/webhook
```

---

## 주요 파일 위치

| 파일 | 역할 |
|---|---|
| `app/layout.tsx` | root layout (static, edge 없음) |
| `app/app/layout.tsx` | /app/* 공통 레이아웃 (edge, auth 체크) |
| `components/Sidebar.tsx` | 사이드바 네비게이션 |
| `lib/types.ts` | 전체 TypeScript 타입 정의 |
| `lib/supabase/server.ts` | 서버 Supabase 클라이언트 |
| `lib/supabase/client.ts` | 브라우저 Supabase 클라이언트 |
| `supabase/schema.sql` | 기본 DB 스키마 (이미 적용됨) |
| `middleware.ts` | no-op (matcher: /app/* 만) |
| `app/icon.png` | 파비콘 |

---

## 로컬 실행

```bash
npm install
npm run dev  # localhost:3000
```

## 배포

```bash
VERCEL_TOKEN=<Vercel 대시보드에서 발급> vercel deploy --prod --yes
```
