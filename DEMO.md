# Attendly — 해커톤 발표 자료 & 시연 스크립트
# Attendly — Hackathon Presentation & Demo Script

> 배포 URL: https://attendly-mu.vercel.app
> GitHub: https://github.com/Doythan/attendly

---

## 1. 프로젝트 한 줄 소개 / One-liner

**KO:** 학원 선생님이 결석·미납을 클릭 한 번으로 파악하고, AI가 학부모 안내문을 써주고, 실제 SMS까지 발송되는 학원 운영 자동화 툴

**EN:** An academy management tool that lets teachers track absences & unpaid fees in one click, auto-generates parent notifications with AI, and sends real SMS messages.

---

## 2. 문제 정의 / Problem Statement

**KO:**
- 소규모 학원(1~3인 운영)은 출결 체크 → 학부모 연락을 수기로 처리
- 결석 통보 문자를 매일 직접 입력 → 반복 업무 + 실수 발생
- 미납 독촉 연락이 어색해서 미루다가 미수금 누적

**EN:**
- Small academies (1–3 staff) handle attendance and parent communication manually
- Daily absence notifications typed by hand → repetitive + error-prone
- Unpaid fee reminders feel awkward, get delayed, and receivables pile up

---

## 3. 솔루션 / Solution

| 기능 | 설명 |
|---|---|
| 출결 관리 | 날짜별 출석/결석/지각 기록, 원클릭 고정 템플릿 → Outbox |
| AI 미납 리마인드 | 학생 정보 기반 GPT-4o-mini 문자 자동 생성 |
| AI 전체 공지 | 휴원·명절·행사 유형 선택 → 전체 학생 SMS 한 번에 |
| Outbox & 발송 | DRAFT 저장 → 확인 후 단건/선택 전송 (Solapi, 한국 010) |
| 수익화 | Polar 구독 결제 → PRO 플랜 (월 300건) |

---

## 4. 기술 스택 / Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router + TypeScript + Tailwind CSS |
| Database / Auth | Supabase (Postgres + RLS) |
| API | Next.js API Routes (`preferredRegion='iad1'` — 미국 서버, OpenAI 차단 우회) |
| SMS | **Solapi** — 한국 010 번호 지원, HMAC-SHA256 인증 |
| AI | OpenAI **gpt-4o-mini** |
| Payment | **Polar** Subscription Checkout |
| Deploy | **Vercel** |

---

## 5. 아키텍처 다이어그램 / Architecture

```
브라우저 (User)
    │
    ▼
Vercel — attendly-mu.vercel.app
    ├── Next.js Pages  (/login, /app/*)
    └── API Routes (Node.js, iad1 리전)
            │
            ├── POST /api/generate-message   → OpenAI GPT-4o-mini
            ├── POST /api/generate-notice    → OpenAI GPT-4o-mini
            ├── POST /api/send-sms           → Solapi API (SMS 발송)
            ├── POST /api/send-sms-bulk      → Solapi API (다건 발송)
            ├── POST /api/polar/create-checkout → Polar API
            └── POST /api/polar/webhook      → Supabase DB (PRO 전환)
                    │
                    ▼
              Supabase (Postgres + RLS)
              profiles / students / attendance_records / messages
```

---

## 6. 핵심 구현 포인트 / Technical Highlights

### SMS (Solapi)
- Twilio는 한국 010 번호 발송 불가 → **Solapi**로 교체
- HMAC-SHA256 서명: `date + salt` → Node.js `crypto` 모듈 직접 구현
- 전화번호 정규화: `010XXXXXXXX` 포맷 자동 변환

### AI 메시지 생성
- 출결 문자: **AI 미사용**, 고정 3종 템플릿 (비용 절감)
- 미납 리마인드: GPT-4o-mini → 학원명·미납개월·미수금 포함 개인화
- 공지 문자: GPT-4o-mini → 유형(휴원/명절/새해/행사/개강/기타) 기반 생성
- OpenAI 한국 IP 차단 이슈 → Vercel `preferredRegion='iad1'`으로 해결

### 보안 & 할당량
- 모든 API Route: Supabase JWT Bearer 검증
- 레이트 리밋: 사용자당 분당 5회
- 월 쿼터: FREE 20건 / PRO 300건 (월별 자동 리셋)
- RLS: 모든 테이블 `owner_id = auth.uid()` 적용

### 결제 (Polar)
- Checkout 세션 생성 시 `metadata.owner_id` 포함
- Webhook: `checkout.updated` / `subscription.created` → profiles.plan = 'PRO'
- 현재: Sandbox 모드 (테스트 카드 사용 가능)

---

## 7. 비즈니스 모델 / Business Model

| 플랜 | 가격 | SMS 한도 |
|---|---|---|
| FREE | ₩0/월 | 20건/월 |
| **PRO** | ₩29,000/월 | 300건/월 |

- SMS 원가(Solapi): 건당 약 ₩20~30 → PRO 300건 원가 ≈ ₩9,000
- 타깃: 소규모 학원(전국 약 10만 개 이상)

---

## 8. 시연 영상 스크립트 / Demo Video Script

> 영상 권장 길이: 3~5분
> 준비: 미리 학생 10~15명 더미 데이터 입력, 학원명 "성수학원" 설정

---

### Scene 1 — 랜딩 페이지 (0:00 ~ 0:20)
**보여줄 것:** https://attendly-mu.vercel.app (랜딩 페이지)

**멘트:**
> "안녕하세요. Attendly는 학원 선생님의 반복 업무—출결 체크, 학부모 문자, 미납 독촉—를 자동화하는 SaaS입니다. Solapi로 실제 한국 010 번호로 SMS가 발송되고, GPT-4o-mini가 안내문을 써줍니다."

> "Hello. Attendly automates repetitive academy tasks—attendance, parent notifications, and payment reminders—as a SaaS. It sends real SMS to Korean 010 numbers via Solapi, and GPT-4o-mini writes the messages."

---

### Scene 2 — 로그인 (0:20 ~ 0:35)
**보여줄 것:** `/login` → "Google로 계속하기" 클릭 → Google 계정 선택 → 대시보드 이동

**멘트:**
> "로그인은 Google 소셜 로그인을 지원합니다. 버튼 한 번으로 OAuth 인증이 완료되고 즉시 대시보드로 이동됩니다. 이메일/비밀번호 방식도 지원합니다."

---

### Scene 3 — 대시보드 (0:35 ~ 1:00)
**보여줄 것:** `/app/dashboard` — 학원명, 통계 카드 4개

**멘트:**
> "대시보드에서 오늘 결석 수, 미납 학생 수, 이번 달 발송 건수, 남은 SMS 쿼터를 한눈에 확인합니다. 각 카드를 클릭하면 해당 페이지로 바로 이동됩니다."

---

### Scene 4 — 학생 관리 (1:00 ~ 1:25)
**보여줄 것:** `/app/students` — 학생 목록, 필터, 미납 토글

**멘트:**
> "학생 정보에는 이름, 반, 학부모 전화번호, 월 수강료가 포함됩니다. 이름·반·미납 여부로 필터링하고, 미납 버튼으로 원클릭 상태 변경이 됩니다."

---

### Scene 5 — 출결 관리 → Outbox 저장 (1:25 ~ 2:00)
**보여줄 것:** `/app/attendance` — 오늘 날짜에서 2~3명 결석 체크 → 템플릿 선택 → "Outbox 저장" 클릭

**멘트:**
> "날짜를 선택하고 결석 학생을 체크합니다. '친근한 말투' 템플릿을 선택하고 저장하면, AI 없이도 즉시 안내문이 Outbox에 쌓입니다. 비용 절감 설계입니다."

---

### Scene 6 — Outbox → 실제 SMS 발송 (2:00 ~ 2:40)
**보여줄 것:** `/app/outbox` — DRAFT 메시지 목록 → 체크박스 선택 → "선택 전송" → SENT 상태로 변경

**멘트:**
> "Outbox에서 보낼 메시지를 확인하고, 내용을 수정할 수도 있습니다. 체크박스로 여러 개를 선택해 한 번에 전송합니다. 지금 실제로 제 폰에 문자가 옵니다."

*(실제 폰 화면 보여주기)*

> "SENT 상태로 바뀌었고, 대시보드 카운터도 올라갑니다."

---

### Scene 7 — 미납 리마인드 (AI) (2:40 ~ 3:10)
**보여줄 것:** `/app/billing` → AI 리마인드 생성 → 내용 확인 → Outbox 저장

**멘트:**
> "미납 학생 목록에서 미납 개월 수와 월 수강료를 입력하면, 미수금이 자동 계산됩니다. GPT-4o-mini가 학원명, 미수금을 포함한 개인화 리마인드 문자를 생성합니다. Outbox에 저장 후 전송합니다."

---

### Scene 8 — 전체 공지 (AI) (3:10 ~ 3:35)
**보여줄 것:** `/app/notice` → "명절 인사" 선택 → AI 생성 → Outbox 저장

**멘트:**
> "전체 공지는 유형만 선택하면 AI가 바로 작성합니다. 전체 학생에게 한 번에 Outbox에 저장, 선택 전송까지 가능합니다."

---

### Scene 9 — Polar 결제 → PRO 전환 (3:35 ~ 4:15)
**보여줄 것:** 대시보드 "업그레이드" 배너 클릭 → Polar 체크아웃 페이지 → 테스트 카드 입력 → 결제 완료 → 대시보드 PRO 배지 확인

**멘트:**
> "현재 Sandbox 환경입니다. 업그레이드 버튼을 누르면 Polar 결제 페이지로 이동합니다. 테스트 카드로 결제하면 Webhook이 트리거되고, 자동으로 PRO 플랜으로 전환됩니다. SMS 한도가 20건에서 300건으로 늘어납니다."

**테스트 카드 정보 (Polar Sandbox):**
```
카드번호: 4242 4242 4242 4242
만료: 12/27  CVC: 123  이름: Test User
```

---

### Scene 10 — 마무리 (4:15 ~ 4:30)
**보여줄 것:** 대시보드 (남은 SMS 건수 300건으로 변경된 것 확인)

**멘트:**
> "전국 10만 개 이상 소규모 학원을 타깃으로, 선생님이 수업에만 집중할 수 있도록 반복 행정 업무를 자동화합니다. 감사합니다."

> "Targeting 100K+ small academies nationwide, Attendly lets teachers focus on teaching by automating repetitive admin work. Thank you."

---

## 9. 심사위원 예상 Q&A / Judge Q&A Prep

**Q: SMS를 실제로 보내나요? 비용은?**
> A: Solapi API로 실제 한국 010 번호에 발송합니다. SMS 1건당 약 ₩20~30. PRO 플랜 ₩29,000으로 원가 대비 충분한 마진 확보.

**Q: AI 비용은?**
> A: 출결 문자는 AI 미사용(고정 템플릿), 미납/공지만 GPT-4o-mini 사용. 메시지 1건 생성 비용 ≈ $0.001 미만.

**Q: 보안은?**
> A: Supabase RLS로 본인 데이터만 접근 가능. API Route마다 JWT 검증. 비밀키는 서버 전용 환경변수.

**Q: 스케일링 계획은?**
> A: Vercel + Supabase 기반으로 트래픽 자동 스케일링. Polar webhook으로 결제→플랜 전환 자동화.

**Q: 카카오 알림톡은?**
> A: 카카오 비즈 계정 심사 필요, 이번 MVP에서는 제외. SMS로도 충분히 동작 검증.

---

## 10. 체크리스트 (시연 전 준비) / Pre-demo Checklist

- [ ] https://attendly-mu.vercel.app 접속 확인
- [ ] 학원명 "성수학원" 설정 완료 (`/app/settings`)
- [ ] 학생 10~15명 더미 데이터 입력 완료 (`/app/students`)
  - 학부모 전화번호: 실제 수신 가능한 번호 1명 이상 포함
  - 미납 학생 2~3명, 미납개월/월수강료 입력 완료
- [ ] Solapi 잔액 확인 (SMS 발송 가능 상태)
- [ ] Polar Sandbox 결제 테스트 카드 준비
- [ ] POLAR_WEBHOOK_SECRET Vercel에 설정 완료
- [ ] 실제 폰(카메라에 잡힐 위치) 준비
- [ ] 시연 계정 로그인 상태로 브라우저 준비

---

*Last updated: 2026-02-20*
