# Instagram DM 기능

- **상태**: 기본 인프라 구현 완료, 테스트/검수 대기
- **관련**: [[ARCHITECTURE]], [[TREND-ANALYSIS-ROADMAP]]

## 아키텍처

```
Instagram 사용자 → DM 발송
       ↓
Meta 서버 → Webhook (POST /webhook)
       ↓
ngrok 터널 (https://xxx.ngrok-free.dev)
       ↓
Webhook 서버 (localhost:3847)
       ↓
Electron main process → IPC → renderer (dm-received 이벤트)
```

## 구현 현황

### 완료
- [x] Webhook 서버 (`webhook-server.js`) — port 3847
  - GET: Meta 검증 (hub.mode + verify_token → challenge 응답)
  - POST: 이벤트 수신 (서명 검증, 메시지 파싱, 콜백 호출)
- [x] 앱 시작 시 webhook 자동 시작
- [x] ngrok 터널 설정 (로컬 → 외부 HTTPS 노출)
- [x] Meta Developer Dashboard 설정
  - Instagram Webhook 구독 (`messages` 필드 활성화)
  - `instagram_manage_messages` 권한 — 테스트 준비 완료
  - Callback URL + Verify Token 등록 완료
- [x] IPC API 구현
  - `startWebhook` / `stopWebhook` — webhook 서버 제어
  - `sendInstagramDM(recipientId, text)` — DM 발송
  - `getInstagramConversations()` — 대화 목록 조회
  - `getInstagramMessages(conversationId)` — 메시지 조회
  - `onDMReceived(callback)` — 실시간 DM 수신 이벤트
- [x] preload.js에 DM API 노출
- [x] 앱 종료 시 webhook 서버 정리

- [x] DM 관리 UI (`src/js/13-dm.js` — 사이드바 DM 탭)
  - 대화 목록 + 메시지 뷰 (채팅 레이아웃)
  - DM 답장 기능 (입력창 + 전송)
  - 실시간 DM 수신 로그
  - 댓글 자동 DM 규칙 관리 (키워드 → 자동 답장)
- [x] 댓글 webhook 처리 (`comments` 이벤트 수신 + 자동 DM 발송)
- [x] DM 알림 (수신 시 toast)

### 진행 중
- [x] Meta Dashboard에서 `comments` + `messages` webhook 구독 활성화 완료
- [ ] 앱 검수 제출 진행 중 (instagram_manage_messages + instagram_manage_comments + instagram_content_publish 등 8개 권한)
- [ ] 검수 승인 후 실제 DM 수신 테스트
- [ ] ngrok 고정 도메인 claim (dashboard.ngrok.com → Domains)

## 제약사항

| 제약 | 설명 |
|------|------|
| 비즈니스/크리에이터 계정만 | 개인 계정은 API 접근 불가 |
| 상대가 먼저 DM 보내야 | 콜드 아웃리치(먼저 DM) 불가 |
| 24시간 제한 | 상대의 마지막 메시지 후 24시간 내 자동 답장만 가능 |
| 시간당 200건 | DM 발송 rate limit |
| 개발 모드 | 앱 역할에 등록된 사용자만 테스트 가능 (검수 통과 전) |
| ngrok 무료 플랜 | 앱 재시작 시 URL 변경됨 → Meta Dashboard 재설정 필요 |

## 설정 정보

### Meta Developer Dashboard
- **앱 ID**: 1620791072808742
- **앱 이름**: cardnews
- **Callback URL**: `https://{ngrok-url}/webhook`
- **Verify Token**: `sns-analyzer-verify-token`
- **구독 필드**: `messages` (Instagram product)

### 로컬 설정
- **Webhook port**: 3847
- **ngrok authtoken**: ngrok.yml에 저장됨
- **Verify token**: `analyzer-config.json` → `webhookVerifyToken` (기본값: `sns-analyzer-verify-token`)
- **App Secret**: `analyzer-config.json` → `metaAppSecret` (선택, 서명 검증용)

### Instagram 계정
- **비즈니스 계정**: ecomirth_official (accountId: 34328649266749554)
- **테스터 등록 필요**: @toechon (DM 발신 테스트용)

## 파일 구조

```
webhook-server.js          # Webhook HTTP 서버 (검증 + 이벤트 수신)
main.js                    # IPC 핸들러 (DM 발송/조회/대화 목록)
preload.js                 # DM API 노출 (sendInstagramDM, onDMReceived 등)
```

## 앱 검수 제출 시 필요 사항

1. **개인정보 처리방침 URL** — DM 데이터 처리 관련 내용 포함
2. **화면 녹화 영상** — DM 수신/답장 기능 데모 (테스트 모드에서 촬영)
3. **권한 사용 목적** — "콘텐츠 크리에이터의 Instagram DM을 데스크톱 앱에서 관리"
4. **비즈니스 인증** — Meta Business Suite 연동 필요할 수 있음

## 재시작 시 체크리스트

1. 앱 시작 → webhook 서버 자동 시작 (port 3847)
2. `ngrok http 3847` 실행
3. ngrok URL이 변경되었으면 Meta Dashboard에서 Callback URL 업데이트
4. 검증 확인: `curl https://{ngrok-url}/webhook?hub.mode=subscribe&hub.verify_token=sns-analyzer-verify-token&hub.challenge=test`
