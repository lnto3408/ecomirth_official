# 데이터 수집 프로세스

- **관련**: [[decisions/001-category-sync]], [[ARCHITECTURE]]

## 전체 흐름

```
1. 앱에서 "수집" 버튼 클릭 (또는 CDP 호출)
2. main.js → runCollector(platform)
3. card-news-maker config.json에서 API 토큰 읽기
4. 플랫폼별 수집기 실행
5. 새 포스트 저장 시 matchCategory()로 카테고리 자동 부여
6. 수집 결과 collection_log 테이블에 기록
```

## 플랫폼별 수집기

### Threads (`collectors/threads.js`)

```
GET /{user-id}/threads → 포스트 목록
  ↓ (각 포스트별)
GET /{post-id}/insights → 조회수, 좋아요, 댓글, 리포스트, 인용
  ↓
GET /{user-id}/threads_insights → 팔로워 수, 계정 통계
```

### Instagram (`collectors/instagram.js`)

```
GET /{account-id}/media → 포스트 목록
  ↓ (각 포스트별)
GET /{media-id}/insights → 도달, 저장, 공유, 상호작용
  ↓
GET /{account-id}?fields=followers_count → 팔로워 수
```

### TikTok (`collectors/tiktok-bridge.js`)

- API 승인 전: 에뮬레이터 스크래핑 또는 수동 입력
- API 승인 후: TikTok API 직접 호출 (구현 예정)

## 카테고리 자동 부여

수집 시 새 포스트를 저장할 때, `matchCategory(caption, platform)` 함수가 자동으로 카테고리를 결정한다. 상세 알고리즘은 [[decisions/001-category-sync]] 참조.

## 수집 트리거

### UI 버튼

앱의 "데이터 수집" 탭에서 플랫폼별 수집 버튼 클릭.

### CDP (Chrome DevTools Protocol)

```javascript
// port 9223
await window.api.collect("threads");
await window.api.collect("instagram");
await window.api.collect("tiktok");
```

## DB 저장 구조

수집된 데이터는 3개 테이블에 저장된다:

| 테이블 | 내용 |
|--------|------|
| `posts` | 포스트 메타데이터 (캡션, 카테고리, 발행일) |
| `metrics` | 포스트별 성과 지표 (시계열, 수집 시마다 새 행) |
| `account_stats` | 계정 통계 (일별, platform+date 유니크) |
