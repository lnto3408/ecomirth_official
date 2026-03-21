# TikTok URL 도메인 인증

- **관련**: [[guides/tiktok-api-setup]]
- **인증 완료**: 2026-03-15

## 개요

TikTok 개발자 앱에 입력하는 URL(Terms, Privacy, Web)의 도메인 소유권을 증명해야 한다. GitHub Pages(`{username}.github.io`)를 사용하는 경우, `github.com` 도메인은 인증할 수 없으므로 GitHub Pages URL을 사용해야 한다.

## 인증 절차

1. TikTok Developer Portal → 앱 설정 페이지 우측 상단 **URL properties** 클릭
2. 인증할 URL prefix 선택
3. **Download File** 클릭 → `tiktok{hash}.txt` 파일 다운로드
4. 다운로드한 파일을 GitHub Pages 소스 폴더(`docs/github-pages/`)에 복사
5. git add → commit → push
6. GitHub Pages 배포 완료 대기 (약 30초~1분)
7. TikTok 팝업에서 **Verify** 클릭

## 핵심 포인트

> **루트 URL 하나만 인증하면 하위 경로 모두 커버된다.**
>
> 예: `https://lnto3408.github.io/ecomirth_official/` 인증 시
> `/terms.html`, `/privacy.html` 등 모든 하위 경로도 인증 완료.

## 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| "This URL is not verified" | `github.com` URL 사용 | `{username}.github.io` URL로 변경 |
| 인증 파일 404 | GitHub Pages 배포 미완료 | 30초~1분 대기 후 재시도 |
| 하위 경로 개별 인증 요구 | URL prefix별 개별 인증 | 루트 URL 인증으로 통합 |

## 관련 파일

인증용 파일들은 `docs/` 루트에 위치 (GitHub Pages 배포 대상):

```
docs/
├── tiktokrOBAxjCbdiE06MmisQziIUMFGg2OV2lT.txt   ← 루트 URL 인증 (유효)
├── tiktokxTtOk2x2bLMVbSDurFq6dVn5Xpdg6nwh.txt   ← 이전 인증 파일
└── terms/
    └── tiktokatScn87pjvWczKjpIBBaqP3S4VsQKgCH.txt  ← terms/ 경로 인증 (불필요)
```
