# ADR-001: card-news-maker 연동 카테고리 자동 분류

- **상태**: 확정
- **날짜**: 2026-03-15
- **관련**: [[processes/data-collection]], [[ARCHITECTURE]]

## 컨텍스트

SNS 플랫폼 API(Threads, Instagram)의 응답에는 카테고리 정보가 없다. 수집된 모든 포스트가 `other`(기타)로 저장되어, "콘텐츠 유형별 분석"과 "플랫폼 X 카테고리 비교" 뷰가 무의미해지는 문제가 있었다.

카드뉴스는 [[card-news-maker]]에서 제작되며, 이 앱에는 프로젝트별 카테고리 태깅 시스템(`tech-ai`, `career`, `life`, `money`, `news`)이 이미 존재한다.

## 결정

card-news-maker의 프로젝트 데이터를 참조하여 수집된 포스트에 **3단계 폴백** 알고리즘으로 카테고리를 자동 부여한다.

## 알고리즘

### 데이터 흐름

```
card-news-maker                          card-news-sns-analyzer
┌──────────────────────┐                 ┌──────────────────────┐
│ projects/{id}.json   │                 │ SQLite DB            │
│  ├ category: "money" │  ── 매칭 ──▶    │  posts.category      │
│  └ snsText:          │                 │  (other → finance)   │
│     threads.text     │                 │                      │
│     instagram.text   │                 │                      │
└──────────────────────┘                 └──────────────────────┘
```

### 카테고리 ID 매핑

두 앱의 카테고리 체계가 다르므로 변환 테이블을 사용:

| card-news-maker | sns-analyzer | 설명 |
|-----------------|-------------|------|
| `tech-ai` | `tech` | AI/테크 |
| `career` | `lifestyle` | 커리어/일 |
| `life` | `lifestyle` | 라이프스타일 |
| `money` | `finance` | 재테크/경제 |
| `news` | `policy` | 뉴스/시사 |

### 3단계 매칭

**1단계 — snsText 직접 매칭** (가장 정확)

card-news-maker 프로젝트의 `snsText.{platform}.text` 첫 줄과 수집된 포스트 캡션 첫 줄을 비교한다.

- 양쪽 텍스트를 정규화 (공백 통합, 해시태그 제거, 100자 제한)
- 첫 줄 완전 일치 → 즉시 반환
- 첫 줄 10자 이상이고 한쪽이 다른 쪽 포함 → 즉시 반환 (잘림 대응)
- 단어 겹침률 30% 이상 → 후보로 저장

왜 첫 줄인가: SNS 캡션의 첫 줄은 제목/훅 역할이며, 발행 시 수정 가능성이 가장 낮다.

**2단계 — 프로젝트 이름 매칭**

캡션에 card-news-maker 프로젝트 이름(첫 15자)이 포함되어 있는지 확인한다.

**3단계 — 키워드 기반 자동 분류** (폴백)

card-news-maker의 `autoCategorizeProjects()`와 동일한 키워드 사전을 사용한다. 1~2단계에서 매칭되지 않은 포스트(card-news-maker에서 제작하지 않은 콘텐츠 포함)에 적용된다. 영어 키워드도 포함하여 영어 포스트도 분류 가능.

## 적용 시점

| 시점 | 함수 | 설명 |
|------|------|------|
| 수집 시 자동 | `matchCategory()` | collectors가 새 포스트 저장 시 호출 |
| 수동 일괄 | `syncCategories()` | `category === 'other'`인 포스트만 대상 |

```javascript
// 수동 동기화
await window.api.syncCategories();
// → { updated: 41, total: 43 }
```

## 실제 결과

초기 테스트 (43개 포스트):

| 단계 | 매칭 | 비고 |
|------|------|------|
| 1단계 (snsText) | 11개 | card-news-maker에서 SNS 텍스트 생성한 프로젝트 |
| 3단계 (키워드) | 30개 | 영어 포스트 포함 |
| 미매칭 | 2개 | 날씨 관련 포스트 (키워드 해당 없음) |

최종 분포: finance 28, tech 7, lifestyle 6, other 2

## 트레이드오프

- (+) 수동 태깅 없이 95% 자동 분류
- (+) card-news-maker 카테고리 체계와 일관성 유지
- (+) 키워드 폴백으로 외부 콘텐츠도 분류 가능
- (-) card-news-maker 프로젝트 파일 디렉토리에 의존 (로컬 전용)
- (-) 카테고리 체계 변경 시 `CNM_CATEGORY_MAP` 수동 업데이트 필요

## 관련 코드

| 파일 | 위치 | 역할 |
|------|------|------|
| `main.js` | `matchCategory()`, `syncCategoriesFromCnm()` | 매칭 로직 + 일괄 동기화 |
| `main.js` | `CNM_CATEGORY_MAP`, `CATEGORY_KEYWORDS` | 매핑 테이블 + 키워드 사전 |
| `collectors/threads.js` | `collect()` 4번째 인자 | 수집 시 matchCategory 호출 |
| `collectors/instagram.js` | `collect()` 4번째 인자 | 수집 시 matchCategory 호출 |
| `preload.js` | `syncCategories` | IPC 브릿지 |

## 한계

1. **snsText 미생성 프로젝트**: 1단계 불가, 키워드 폴백 의존
2. **키워드 미해당 주제**: 날씨/과학/스포츠 등은 `other` → 키워드 추가로 해결
3. **발행 전 캡션 대폭 수정**: 1단계 실패 → 키워드 폴백 동작
4. **카테고리 추가/변경**: `CNM_CATEGORY_MAP` 업데이트 필요
