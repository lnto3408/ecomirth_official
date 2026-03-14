# SNS API 초기 세팅 가이드

card-news-sns-analyzer에서 각 플랫폼 API를 연동하기 위한 설정 가이드입니다.

모든 API 토큰은 `~/Library/Application Support/card-news-maker/config.json`에 저장되며, 분석기 앱은 이 파일을 read-only로 참조합니다.

---

## 1. Threads API

### 1-1. 앱 생성
1. [Meta for Developers](https://developers.facebook.com/) 접속
2. My Apps → Create App → Business → Threads API 선택
3. 앱 이름, 연락처 이메일 입력 후 생성

### 1-2. 액세스 토큰 발급
1. Threads API → API 설정 → Generate Token
2. Threads 계정 로그인 및 권한 승인
3. 발급된 Long-Lived Token 복사

### 1-3. config.json 설정
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

### 1-4. 사용자 ID 확인
```
GET https://graph.threads.net/v1.0/me?fields=id,username&access_token={TOKEN}
```

---

## 2. Instagram API

### 2-1. 사전 요구사항
- Instagram **비즈니스** 또는 **크리에이터** 계정 (개인 계정 불가)
- Facebook 페이지와 연결 필요

### 2-2. 앱 생성
1. [Meta for Developers](https://developers.facebook.com/) 접속
2. My Apps → Create App → Business
3. Instagram Graph API 제품 추가

### 2-3. 액세스 토큰 발급
1. Graph API Explorer에서 토큰 생성
2. 필요 권한: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`
3. Short-Lived Token → Long-Lived Token 변환:
```
GET https://graph.instagram.com/access_token
  ?grant_type=ig_exchange_token
  &client_secret={APP_SECRET}
  &access_token={SHORT_LIVED_TOKEN}
```

### 2-4. Account ID 확인
```
GET https://graph.instagram.com/v21.0/me?fields=id,username&access_token={TOKEN}
```

### 2-5. config.json 설정
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

### 2-6. 수집 가능 데이터
| 항목 | API 엔드포인트 |
|------|---------------|
| 포스트 목록 | `GET /{account-id}/media?fields=id,caption,timestamp,like_count,comments_count,media_type,permalink` |
| 포스트 인사이트 | `GET /{media-id}/insights?metric=reach,saved,shares,total_interactions` |
| 계정 통계 | `GET /{account-id}?fields=followers_count,follows_count` |

> **참고**: CAROUSEL_ALBUM 타입은 `impressions` 메트릭을 지원하지 않으므로 `total_interactions`를 사용합니다.

---

## 3. TikTok API

### 3-1. 개발자 앱 생성
1. [TikTok for Developers](https://developers.tiktok.com/) 접속
2. Developer Portal → Manage apps → Create app

### 3-2. 앱 정보 입력

| 필드 | 입력값 |
|------|--------|
| App name | ecomirth_official (또는 원하는 이름) |
| Category | Finance |
| Description | A desktop analytics dashboard that tracks and analyzes card news performance metrics across social media platforms. |
| Platforms | Desktop 체크 |

### 3-3. URL 설정 (GitHub Pages 활용)

GitHub Pages를 활성화하여 Terms/Privacy 페이지를 호스팅합니다.

**GitHub Pages 활성화 방법:**
1. GitHub 리포 → Settings → Pages
2. Source: `Deploy from a branch`
3. Branch: `main`, 폴더: `/docs`
4. Save

**URL 입력:**

| 필드 | URL |
|------|-----|
| Terms of Service URL | `https://{username}.github.io/{repo}/terms.html` |
| Privacy Policy URL | `https://{username}.github.io/{repo}/privacy.html` |
| Web/Desktop URL | `https://{username}.github.io/{repo}/` |

### 3-4. URL 도메인 인증

TikTok은 입력한 URL의 도메인 소유권 확인을 요구합니다.

1. 페이지 우측 상단 **URL properties** 클릭
2. 인증할 URL prefix 선택 (루트 URL 하나만 인증하면 하위 경로 모두 커버)
3. **Download File** 클릭 → `tiktok{hash}.txt` 파일 다운로드
4. 다운로드한 파일을 `docs/` 폴더에 복사
5. git add → commit → push
6. GitHub Pages 배포 완료 대기 (약 30초~1분)
7. TikTok 팝업에서 **Verify** 클릭

### 3-5. Scopes 설정

Scopes 탭에서 아래 3개 추가:

| Scope | 용도 |
|-------|------|
| `user.info.stats` | 팔로워 수, 좋아요 수 등 계정 통계 |
| `user.info.profile` | 프로필 정보 (계정 식별) |
| `video.list` | 비디오 목록 + 조회수/좋아요/댓글/공유 데이터 |

### 3-6. App Review 제출

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

**데모 영상:**
- 앱 실행 화면을 QuickTime 등으로 30초~1분 녹화
- TikTok 데이터가 대시보드에 표시되는 흐름을 보여줌
- mp4 또는 mov 포맷, 50MB 이하

### 3-7. config.json 설정 (승인 후)
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

### 3-8. 대안: 에뮬레이터 스크래핑
API 승인 전에도 TikTok 데이터를 수집할 수 있습니다:
- Android 에뮬레이터 + uiautomator2로 TikTok Creator Center 스크래핑
- `scripts/tiktok-scraper.py` 실행
- 실패 시 앱 내 수동 입력 폼으로 폴백

---

## 4. 토큰 갱신

| 플랫폼 | 토큰 유효기간 | 갱신 방법 |
|--------|-------------|----------|
| Threads | 60일 (Long-Lived) | 만료 전 refresh API 호출 |
| Instagram | 60일 (Long-Lived) | 만료 전 refresh API 호출 |
| TikTok | 보통 24시간 | refresh_token으로 갱신 |

### Threads/Instagram 토큰 갱신
```
GET https://graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token
  &access_token={CURRENT_TOKEN}
```

---

## 5. 수집 테스트

앱 실행 후 각 플랫폼의 "수집" 버튼을 클릭하여 데이터 수집을 테스트합니다.

```bash
npm start
```

또는 CDP를 통한 자동 수집 테스트:
```javascript
// Chrome DevTools Protocol (port 9223)
await window.api.collect("threads");    // Threads 수집
await window.api.collect("instagram");  // Instagram 수집
await window.api.collect("tiktok");     // TikTok 수집
```
