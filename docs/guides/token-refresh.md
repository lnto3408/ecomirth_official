# API 토큰 갱신 가이드

- **관련**: [[guides/threads-api-setup]], [[guides/instagram-api-setup]], [[guides/tiktok-api-setup]]

## 토큰 유효기간

| 플랫폼 | 토큰 유효기간 | 갱신 방법 |
|--------|-------------|----------|
| Threads | 60일 (Long-Lived) | 만료 전 refresh API 호출 |
| Instagram | 60일 (Long-Lived) | 만료 전 refresh API 호출 |
| TikTok | 보통 24시간 | refresh_token으로 갱신 |

## Threads / Instagram 토큰 갱신

두 플랫폼 모두 동일한 Meta API를 사용한다:

```
GET https://graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token
  &access_token={CURRENT_TOKEN}
```

- 만료 전에만 갱신 가능 (만료 후에는 재발급 필요)
- 갱신 시 새로운 60일 토큰 발급
- 갱신된 토큰을 `config.json`에 수동 업데이트

## TikTok 토큰 갱신

TikTok은 `refresh_token`을 사용하며, API 승인 후 구현 예정.
