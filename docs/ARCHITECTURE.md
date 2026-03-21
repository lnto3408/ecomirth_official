# 기술 아키텍처

- **관련**: [[decisions/001-category-sync]], [[processes/data-collection]]

## 기술 스택

| 영역 | 기술 |
|------|------|
| 데스크톱 | Electron 33 |
| 프론트엔드 | Vanilla JS (11 모듈), CSS Variables (다크 테마) |
| DB | SQLite (better-sqlite3), WAL 모드 |
| 차트 | Chart.js |
| API | Meta Graph API (Threads/Instagram), TikTok API (승인 대기), 네이버 데이터랩/뉴스, YouTube Data API v3, 정책브리핑 RSS, Google Trends (백그라운드 보너스) |
| DM Webhook | Instagram Messaging API + ngrok 터널 (port 3847) |
| 디버깅 | Chrome DevTools Protocol (port 9223) |
| 설정 공유 | card-news-maker config.json (read-only 참조) |

## 프로젝트 구조

```
card-news-sns-analyzer/
├── main.js                    # Electron main process + IPC + 카테고리 매칭
├── preload.js                 # Context bridge (IPC expose)
├── package.json
├── database.js                # SQLite DB layer (CRUD + 분석 쿼리)
├── collectors/
│   ├── threads.js             # Threads API 수집기
│   ├── instagram.js           # Instagram Graph API 수집기
│   ├── tiktok-bridge.js       # TikTok 에뮬레이터 브릿지
│   └── trends/
│       ├── google-trends.js   # Google Trends 수집기
│       ├── naver-datalab.js   # 네이버 데이터랩 + 뉴스 검색
│       ├── rss-feed.js        # 정책브리핑/뉴스 RSS 파서
│       └── youtube-trending.js # YouTube 인기 동영상
├── scripts/
│   └── tiktok-scraper.py      # uiautomator2 TikTok Creator Center 스크래핑
├── src/
│   ├── index.html             # SPA shell (사이드바 + 뷰 컨테이너)
│   ├── styles.css             # 다크 테마
│   └── js/
│       ├── 01-state.js        # 앱 상태
│       ├── 02-utils.js        # 유틸리티
│       ├── 03-ui.js           # 뷰 전환, 사이드바
│       ├── 04-dashboard.js    # 성장 트래킹 대시보드
│       ├── 05-content-analysis.js  # 콘텐츠 유형별 분석
│       ├── 06-time-analysis.js     # 시간대/요일별 분석
│       ├── 07-cross-platform.js    # 플랫폼 간 교차 비교
│       ├── 08-posts.js        # 포스트 목록/수동입력/태깅/상세 분석
│       ├── 09-collection.js   # 데이터 수집 트리거/상태
│       ├── 10-settings.js     # API 토큰, 카테고리, 스케줄러
│       ├── 11-init.js         # 초기화
│       └── 12-trends.js       # 트렌드 분석 뷰
└── docs/                      # 프로젝트 문서 (Obsidian 볼트)
```

## DB 스키마

```sql
posts          -- 포스트 메타데이터 (플랫폼, 캡션, 카테고리, 발행일)
metrics        -- 포스트별 성과 지표 (시계열, FK → posts.id)
account_stats  -- 계정 통계 (일별, platform+date 유니크)
collection_log -- 수집 이력 (시작/종료 시간, 상태, 처리 건수)
trends         -- 트렌드 스냅샷 (source별 JSON, 수집 시점)
trend_keywords -- 키워드 트렌드 시계열 (keyword+source+date 유니크)
```

## 앱 간 연동

```
card-news-maker (제작)          card-news-sns-analyzer (분석)
┌────────────────────┐          ┌────────────────────┐
│ config.json        │─ 토큰 ──▶│ API 수집           │
│  └ snsAccounts     │          │                    │
│                    │          │                    │
│ projects/*.json    │─ 카테고리▶│ 카테고리 매칭       │
│  ├ category        │          │  └ matchCategory() │
│  └ snsText         │          │                    │
└────────────────────┘          └────────────────────┘
```

## 자동 수집

- **앱 시작 시 자동 수집**: 앱이 시작되면 `runAutoCollectCycle()`이 autoCollect 설정과 무관하게 즉시 1회 실행된다.
  - SNS 데이터 (Threads/Instagram) + Google Trends + RSS (정책브리핑/뉴스) 동시 수집
  - 급상승 키워드 감지 시 renderer에 toast 알림 (`trend-alert` 이벤트)
- **스케줄러(setInterval)**: 설정에서 자동 수집이 활성화된 경우에만 지정 간격(분 단위)으로 반복 수집한다.

## 분석 뷰 (5가지)

1. **성장 대시보드**: 팔로워/도달률/참여율 시계열 (Line/Area chart, 7d/30d/90d)
   - 포스트별 성과 차트: 시간순/좋아요/댓글/공유/종합 정렬 지원
   - 차트 막대 클릭 → 포스트 상세 페이지로 이동
2. **콘텐츠 유형별**: 카테고리별 평균 참여도 (Grouped bar chart)
3. **시간대 분석**: 요일 X 시간 히트맵, 최적 발행 시간 도출
4. **교차 비교**: content_group 기준 플랫폼별 성과 비교 (Radar chart)
5. **트렌드 분석**: 외부 트렌드 데이터 기반 콘텐츠 기획 지원
   - 핫 토픽 (Google News + 연합뉴스 RSS, 카테고리별 필터)
   - 키워드 관심도 비교 차트 (네이버 데이터랩, 10분 캐시)
   - 키워드 인사이트 (트렌드 방향: 급상승/상승/유지/하락/급하락)
   - 정책브리핑 RSS (korea.kr 3개 피드)
   - 뉴스 핫 키워드 클라우드 (RSS 헤드라인 빈도 분석, 언론사명 필터)
   - 카테고리별 최신 뉴스 (네이버 뉴스 검색, 7개 카테고리)
   - YouTube 한국 인기 동영상 (Data API v3)
   - 콘텐츠 추천 (트렌드 + 내 성과 교차 분석)
   - 트렌드↔성과 상관관계 (매칭 vs 비매칭 포스트 비교)
   - 콘텐츠 캘린더 (요일별 성과 + 트렌드 키워드 매칭)
   - 트렌드 변화 비교 (이전/현재 스냅샷 비교)
   - 키워드 상세 패널 (클릭 시 네이버 뉴스)
6. **DM 관리**: Instagram DM 관리 + 댓글 자동 DM
   - Webhook 서버 (port 3847) + ngrok 터널
   - DM 대화 목록/메시지 뷰/답장
   - 댓글 자동 DM 규칙 (팔로우 확인 → 미팔로우 요청/팔로우 정보 제공)
   - 실시간 DM/댓글 수신 로그

## 포스트 관리

- **테이블 정렬**: 좋아요/조회/발행일 헤더 클릭으로 정렬 (▼▲ 토글)
- **포스트 상세 페이지**: 포스트 행 또는 대시보드 차트 클릭 시 진입
  - 포스트 정보 (캡션, 해시태그, 게시일, 슬라이드 수)
  - 지표 카드 6종 (조회수/좋아요/댓글/공유/저장/참여율)
  - 지표 변화 추이 (Dual Y-axis Line chart: 좌=좋아요·댓글·공유·저장, 우=조회수)
  - 계정 컨텍스트 (팔로워 수, 도달률)
  - 조회 소스/오디언스 (향후 API 연동 예정)
