# Threads API 설정 가이드

- **관련**: [[guides/instagram-api-setup]], [[guides/token-refresh]]
- **설정 파일**: `~/Library/Application Support/card-news-maker/config.json`

## 앱 생성

1. [Meta for Developers](https://developers.facebook.com/) 접속
2. My Apps → Create App → Business → Threads API 선택
3. 앱 이름, 연락처 이메일 입력 후 생성

## 액세스 토큰 발급

1. Threads API → API 설정 → Generate Token
2. Threads 계정 로그인 및 권한 승인
3. 발급된 Long-Lived Token 복사 (유효기간: 60일)

## 사용자 ID 확인

```
GET https://graph.threads.net/v1.0/me?fields=id,username&access_token={TOKEN}
```

## config.json 설정

분석기 앱은 [[card-news-maker]]의 config.json을 read-only로 참조한다.

```json
{
  "snsAccounts": {
    "threads": {
      "accessToken": "THAA...(발급받은 토큰)",
      "userId": "(사용자 ID)"
    }
  }
}
```

## 수집 가능 데이터

| 항목 | API 엔드포인트 |
|------|---------------|
| 포스트 목록 | `GET /{user-id}/threads?fields=id,text,timestamp,media_type,permalink` |
| 포스트 인사이트 | `GET /{post-id}/insights?metric=views,likes,replies,reposts,quotes` |
| 계정 통계 | `GET /{user-id}/threads_insights?metric=followers_count` |

## 수집 테스트

```javascript
// CDP (port 9223)
await window.api.collect("threads");
```
