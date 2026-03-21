# Card News SNS Analyzer - Documentation Hub

> Obsidian 볼트로 관리되는 프로젝트 문서. 모든 문서는 `[[wiki-link]]` 스타일로 상호 참조 가능.

## 문서 구조

```
docs/
├── README.md                  ← 현재 파일 (인덱스)
├── ARCHITECTURE.md            ← 기술 아키텍처 상세
│
├── processes/                 ← 프로세스 & 워크플로우
│   └── data-collection.md        ← 데이터 수집 파이프라인
│
├── decisions/                 ← ADR (Architecture Decision Records)
│   └── 001-category-sync.md      ← card-news-maker 연동 카테고리 자동 분류
│
├── guides/                    ← 설정 & 운영 가이드
│   ├── threads-api-setup.md      ← Threads API 설정
│   ├── instagram-api-setup.md    ← Instagram API 설정
│   ├── tiktok-api-setup.md       ← TikTok API 설정
│   ├── tiktok-domain-verification.md  ← TikTok URL 도메인 인증
│   └── token-refresh.md          ← API 토큰 갱신
│
├── legal/                     ← 법적 문서 (원본 Markdown)
│   ├── terms.md                  ← Terms of Service
│   └── privacy.md                ← Privacy Policy
│
├── index.html                 ← GitHub Pages 랜딩 페이지
├── terms.html                 ← Terms of Service (HTML, GitHub Pages 배포용)
├── privacy.html               ← Privacy Policy (HTML, GitHub Pages 배포용)
└── tiktok*.txt                ← TikTok 도메인 인증 파일
```

## 빠른 링크

| 주제 | 문서 |
|------|------|
| 전체 아키텍처 | [[ARCHITECTURE]] |
| 데이터 수집 흐름 | [[processes/data-collection]] |
| 카테고리 자동 분류 | [[decisions/001-category-sync]] |
| Threads API 설정 | [[guides/threads-api-setup]] |
| Instagram API 설정 | [[guides/instagram-api-setup]] |
| TikTok API 설정 | [[guides/tiktok-api-setup]] |
| TikTok 도메인 인증 | [[guides/tiktok-domain-verification]] |
| 토큰 갱신 | [[guides/token-refresh]] |

## 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 데스크톱 | Electron 33 |
| 프론트엔드 | Vanilla JS (11 모듈), CSS Variables |
| DB | SQLite (better-sqlite3) |
| 차트 | Chart.js |
| API | Meta Graph API, TikTok API |
| 디버깅 | Chrome DevTools Protocol (CDP) |
| 설정 공유 | card-news-maker config.json (read-only) |

## 자매 프로젝트

| 프로젝트 | 역할 | 문서 |
|----------|------|------|
| [[card-news-maker]] | 카드뉴스 제작 + SNS 발행 | `/Users/agent/card-news-maker/docs/` |
| **card-news-sns-analyzer** | 발행 후 성과 분석 | 현재 문서 |
