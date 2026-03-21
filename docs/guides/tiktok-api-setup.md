# TikTok API 설정 가이드

- **상태**: App Review 제출 완료, 승인 대기 중 (2026-03-15)
- **관련**: [[guides/tiktok-domain-verification]], [[guides/token-refresh]]
- **설정 파일**: `~/Library/Application Support/card-news-maker/config.json`

## 개발자 앱 생성

1. [TikTok for Developers](https://developers.tiktok.com/) 접속
2. Developer Portal → Manage apps → Create app

## 앱 정보 입력

| 필드 | 입력값 |
|------|--------|
| App name | ecomirth_official (또는 원하는 이름) |
| Category | Finance |
| Description | A desktop analytics dashboard that tracks and analyzes card news performance metrics across social media platforms. |
| Platforms | Desktop 체크 |

## URL 설정

GitHub Pages를 활용하여 Terms/Privacy 페이지를 호스팅한다. 자세한 설정은 [[guides/tiktok-domain-verification]] 참조.

| 필드 | URL |
|------|-----|
| Terms of Service URL | `https://{username}.github.io/{repo}/terms.html` |
| Privacy Policy URL | `https://{username}.github.io/{repo}/privacy.html` |
| Web/Desktop URL | `https://{username}.github.io/{repo}/` |

## Scopes 설정

| Scope | 용도 |
|-------|------|
| `user.info.stats` | 팔로워 수, 좋아요 수 등 계정 통계 |
| `user.info.profile` | 프로필 정보 (계정 식별) |
| `video.list` | 비디오 목록 + 조회수/좋아요/댓글/공유 데이터 |

## App Review 제출

**설명 (1000자 이내):**

```
card-news-sns-analyzer is a desktop analytics dashboard built with Electron.
It collects and visualizes content performance metrics for social media card news posts.

How scopes are used:
- user.info.stats: Displays the creator's follower count, following count, and total likes
  on the analytics dashboard to track account growth over time.
- user.info.profile: Retrieves the creator's profile information to identify the account
  in the dashboard.
- video.list: Fetches the list of published videos to track each post's performance metrics
  (views, likes, comments, shares) and compare results across content categories and posting times.

The app runs locally on the creator's own machine and only accesses their own account data.
No data is shared with third parties.
```

**데모 영상 요구사항:**
- 앱 실행 화면을 QuickTime 등으로 30초~1분 녹화
- TikTok 데이터가 대시보드에 표시되는 흐름을 보여줌
- mp4 또는 mov 포맷, 50MB 이하

## config.json 설정 (승인 후)

```json
{
  "snsAccounts": {
    "tiktok": {
      "accessToken": "(발급받은 토큰)",
      "openId": "(사용자 Open ID)"
    }
  }
}
```

## 대안: 에뮬레이터 스크래핑

API 승인 전에도 TikTok 데이터를 수집할 수 있다:

- Android 에뮬레이터 + uiautomator2로 TikTok Creator Center 스크래핑
- `scripts/tiktok-scraper.py` 실행
- 실패 시 앱 내 수동 입력 폼으로 폴백
