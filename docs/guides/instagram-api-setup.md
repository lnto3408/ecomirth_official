# Instagram API 설정 가이드

- **관련**: [[guides/threads-api-setup]], [[guides/token-refresh]]
- **설정 파일**: `~/Library/Application Support/card-news-maker/config.json`

## 사전 요구사항

- Instagram **비즈니스** 또는 **크리에이터** 계정 (개인 계정 불가)
- Facebook 페이지와 연결 필요

## 앱 생성

1. [Meta for Developers](https://developers.facebook.com/) 접속
2. My Apps → Create App → Business
3. Instagram Graph API 제품 추가

## 액세스 토큰 발급

1. Graph API Explorer에서 토큰 생성
2. 필요 권한: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`
3. Short-Lived Token → Long-Lived Token 변환:

```
GET https://graph.instagram.com/access_token
  ?grant_type=ig_exchange_token
  &client_secret={APP_SECRET}
  &access_token={SHORT_LIVED_TOKEN}
```

## Account ID 확인

```
GET https://graph.instagram.com/v21.0/me?fields=id,username&access_token={TOKEN}
```

## config.json 설정

```json
{
  "snsAccounts": {
    "instagram": {
      "accessToken": "IGAA...(발급받은 토큰)",
      "accountId": "(Account ID)"
    }
  }
}
```

## 수집 가능 데이터

| 항목 | API 엔드포인트 |
|------|---------------|
| 포스트 목록 | `GET /{account-id}/media?fields=id,caption,timestamp,like_count,comments_count,media_type,permalink` |
| 포스트 인사이트 | `GET /{media-id}/insights?metric=reach,saved,shares,total_interactions` |
| 계정 통계 | `GET /{account-id}?fields=followers_count,follows_count` |

> **주의**: CAROUSEL_ALBUM 타입은 `impressions` 메트릭을 지원하지 않으므로 `total_interactions`를 사용한다.

## 수집 테스트

```javascript
// CDP (port 9223)
await window.api.collect("instagram");
```
