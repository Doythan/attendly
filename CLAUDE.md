# Attendly (해커톤 MVP)

## 목표 (반드시 충족 / Pass 조건)
해커톤 예선 통과를 위해 “실제로 작동하는 제품”을 만든다.

1) 실제로 동작하는 웹서비스(배포 가능)
2) OpenAI API로 SMS 문구를 생성한다
3) Twilio로 한국 휴대폰(010)으로 실제 SMS를 발송한다
4) 수익성: Polar 구독 결제(Checkout) + 결제 성공 시 Pro 플랜 해제(webhook)
5) 발송 로그/상태(DRAFT/SENT/FAILED)가 DB에 저장되고 UI에서 확인된다
6) Outbox에서 여러 메시지를 선택해서 “선택 전송(Bulk send)”이 가능해야 한다

## 이번 MVP에서 하지 않을 것(절대 하지 말기)
- 카카오 알림톡/카톡 자동발송 연동
- 멀티테넌시(여러 학원/지점) / 복잡한 권한
- 과한 디자인/애니메이션
- 완벽한 아키텍처/테스트 커버리지

## 고정 기술 스택(변경 금지)
- Next.js 14(App Router) + TypeScript + Tailwind
- Supabase: Auth + Postgres + RLS
- Cloudflare Workers: 서버 API(OpenAI, Twilio, Polar webhook)
- Cloudflare Pages: 프론트 배포
- Polar: Checkout Subscription (한국 지원, 테스트 모드 OK)
- Twilio: SMS 실발송

## MVP 페이지(최소 화면)
- /                 : 랜딩 + Pricing(요금제) + 업그레이드 CTA
- /login            : 로그인(이메일/비번)
- /app/dashboard     : 오늘 결석/미납/발송 수 + 내 플랜 + 남은 무료 발송량
- /app/students      : 학생 CRUD + 더미데이터 생성 버튼
- /app/attendance    : 날짜/반 선택 → 출석/결석/지각 저장 + 안내문 생성(AI)
- /app/billing       : 미납 학생 목록 + 미납 리마인드 생성(AI)
- /app/outbox        : 메시지 목록(DRAFT/SENT/FAILED) + 미리보기 + 선택 전송(Bulk) + 단건 전송(확인 모달)

## 핵심 규칙(중요)
- “끝까지 동작하는 흐름”을 먼저 만든다:
  로그인 → 학생 등록 → 출결 저장 → 안내문 생성 → Outbox 저장 → SMS 전송 → 로그 확인
- 비밀키(OpenAI/Twilio/Polar Access Token)는 Workers에서만 사용한다(클라이언트 금지)
- 전화번호 정규화: 010xxxxxxxx → +8210xxxxxxxx
- 전송 레이트리밋: 사용자당 분당 최대 5회
- 무료 플랜 제한: 월 20건 SMS 발송 제한
- Pro 플랜: 제한 해제(또는 월 300건)

## DB 모델(필수)
- profiles: 유저 플랜/월 발송 카운트
- students: 학생/학부모 전화/반/미납 여부
- attendance_records: 날짜별 출결(PRESENT/ABSENT/LATE)
- messages: Outbox(type, tone, content, status, provider id, error)

※ 모든 데이터는 owner_id = auth.uid() 조건으로 RLS 적용

## 완료 정의(Definition of Done)
- 결석 처리 후 “AI 안내문 생성”을 누르면 Outbox에 메시지가 생긴다
- Outbox에서 1건 전송 및 여러 건 선택 전송이 된다
- 실제 폰으로 문자가 도착한다
- 성공/실패가 UI에 표시되고 DB에 저장된다
- Polar 결제(테스트 모드 OK) 성공 후 plan=PRO로 바뀌고 제한이 해제된다
- README에 설치/배포/시연 체크리스트가 있다

## 시연(영상) 체크리스트(예선 제출용)
1) 로그인
2) 출결에서 학생 2~3명 결석 체크
3) AI 안내문 생성 → Outbox에 여러 건 생성 확인
4) 체크박스 선택 후 “선택 전송” → 실제 폰 문자 연속 도착 화면
5) 대시보드에서 발송 수 증가 + 남은 무료 건수 감소
6) Pricing에서 Polar 결제 → PRO 전환 확인(제한 해제)
