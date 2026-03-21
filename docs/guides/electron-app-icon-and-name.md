# Electron 앱 아이콘 및 Dock 이름 설정

## 개요

macOS에서 Electron 앱의 Dock 아이콘과 마우스 오버 시 표시되는 이름을 커스터마이징하는 방법을 정리한다.

## 아이콘 설정

### 파일 위치

- `assets/icon.svg` — 원본 SVG
- `assets/icon_512.png` — 512x512 PNG (Electron에서 사용)
- `assets/icon.icns` — macOS 네이티브 아이콘 (패키징 시 사용)

### 코드 적용 (main.js)

```js
// Dock 아이콘 설정 (macOS)
if (process.platform === 'darwin') {
  app.dock.setIcon(path.join(__dirname, 'assets', 'icon_512.png'));
}

// BrowserWindow 아이콘 (Windows/Linux)
mainWindow = new BrowserWindow({
  icon: path.join(__dirname, 'assets', 'icon_512.png'),
  // ...
});
```

### 아이콘 생성 방법

```bash
# SVG → PNG
sips -s format png icon.svg --out icon_512.png --resampleWidth 512

# PNG → icns (macOS 패키징용)
mkdir icon.iconset
for size in 16 32 64 128 256 512; do
  sips -z $size $size icon_512.png --out icon.iconset/icon_${size}x${size}.png
done
for size in 16 32 64 128 256; do
  double=$((size * 2))
  sips -z $double $double icon_512.png --out icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset
```

## Dock 이름 변경

### 문제

`app.setName('SNS Analyzer')`이나 `package.json`의 `productName`을 변경해도 macOS Dock의 마우스 오버 툴팁은 여전히 "Electron"으로 표시된다.

### 원인

macOS는 Dock 툴팁 이름을 **`.app` 번들의 `Info.plist`** 에서 읽는다. 개발 모드(`electron .`)로 실행할 때 실제로 실행되는 앱은 `node_modules/electron/dist/Electron.app`이며, 이 번들의 `Info.plist`에 `CFBundleName = "Electron"`으로 되어 있다.

`app.setName()`은 Electron 내부 API 레벨에서만 이름을 변경할 뿐, macOS 시스템(Dock, 메뉴바)에서 읽는 `Info.plist` 값은 변경하지 않는다.

### 해결 방법

1. **`.app` 번들 이름 변경**: `Electron.app` → `SNS Analyzer.app`으로 디렉토리 이름 변경
2. **`Info.plist` 수정**: `CFBundleName`과 `CFBundleDisplayName`을 "SNS Analyzer"로 변경
3. **`path.txt` 업데이트**: Electron이 바이너리를 찾는 경로 파일 수정

```bash
DIST="node_modules/electron/dist"

# 1. 번들 이름 변경
mv "$DIST/Electron.app" "$DIST/SNS Analyzer.app"

# 2. Info.plist 수정
PLIST="$DIST/SNS Analyzer.app/Contents/Info.plist"
plutil -replace CFBundleDisplayName -string "SNS Analyzer" "$PLIST"
plutil -replace CFBundleName -string "SNS Analyzer" "$PLIST"

# 3. path.txt 업데이트 (electron 모듈이 바이너리를 찾는 경로)
echo "SNS Analyzer.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
```

### 핵심 포인트

| 방법 | Dock 이름 변경 | 설명 |
|------|:-:|------|
| `app.setName()` | X | Electron 내부 API만 영향 |
| `package.json` productName | X | 빌드/패키징 시에만 사용 |
| Info.plist 수정만 | X | macOS가 번들 이름을 캐싱 |
| **번들 이름 변경 + Info.plist + path.txt** | **O** | **macOS가 새 앱으로 인식** |

### 주의사항

- `npm install` 시 `node_modules/electron`이 재설치되면 변경사항이 초기화된다.
- 영구 적용하려면 `package.json`의 `postinstall` 스크립트로 자동화할 수 있다:

```json
{
  "scripts": {
    "postinstall": "node scripts/setup-electron-name.js"
  }
}
```

- 프로덕션 배포 시에는 `electron-builder`나 `electron-forge`를 사용하면 빌드 설정에서 앱 이름과 아이콘을 지정할 수 있으므로 이 작업이 불필요하다.

## userData 경로 변경으로 인한 데이터 유실 사고 (2026-03-16)

### 증상

Dock 이름을 "Electron" → "SNS Analyzer"로 변경한 뒤 대시보드의 기존 데이터(팔로워 추이, 도달/노출 추이 등)가 모두 사라졌다. 당일 수집한 데이터만 표시됨.

### 원인 분석

Electron의 `app.getPath('userData')`는 DB 파일 저장 경로를 결정한다. 이 경로는 다음 두 가지에 의해 결정된다:

1. **`app.setName()`**: 호출 시 앱 이름을 변경하여 `userData` 경로가 바뀜
2. **`.app` 번들의 `Info.plist` `CFBundleName`**: 번들 이름도 Electron이 앱 이름으로 사용

이번 사고에서는 두 가지를 모두 변경했기 때문에, `app.setName()`을 제거한 이후에도 Info.plist의 `CFBundleName = "SNS Analyzer"`가 적용되어 경로가 변경된 상태로 유지됐다.

```
변경 전 경로: ~/Library/Application Support/card-news-sns-analyzer/data/sns-analyzer.db
변경 후 경로: ~/Library/Application Support/SNS Analyzer/data/sns-analyzer.db
```

앱이 새 경로에서 DB를 찾지 못해 빈 DB를 새로 생성했고, 기존 데이터(posts 50개, metrics 312개, account_stats 3일치)에 접근하지 못했다.

### 경로 변경을 일으키는 것들

| 변경 항목 | userData 경로 변경 | Dock 이름 변경 |
|---|:-:|:-:|
| `app.setName()` | O | X |
| `package.json` `name` | O | X |
| Info.plist `CFBundleName` | O | O |
| Info.plist `CFBundleDisplayName` | X | O |
| `.app` 번들 디렉토리 이름 | X | O |

### 복구 과정

```bash
# 1. 기존 DB 위치 확인
find "$HOME/Library/Application Support" -name "sns-analyzer.db"
# → card-news-sns-analyzer/data/sns-analyzer.db (96KB, 원본)
# → SNS Analyzer/data/sns-analyzer.db (48KB, 새로 생성된 빈 DB)

# 2. 원본 DB를 현재 사용 경로로 복사
/bin/cp "$HOME/Library/Application Support/card-news-sns-analyzer/data/sns-analyzer.db" \
        "$HOME/Library/Application Support/SNS Analyzer/data/sns-analyzer.db"

# 3. 앱 재시작 후 데이터 복원 확인
```

### 재발 방지 규칙

1. **`app.setName()`을 사용하지 않는다** — `userData` 경로를 변경시킨다.
2. **`package.json`의 `name` 필드를 변경하지 않는다** — `userData` 경로의 기본값이다.
3. **Info.plist의 `CFBundleName`을 변경하지 않는다** — Electron이 이 값을 앱 이름으로 사용하여 `userData` 경로에 반영한다.
4. **Dock 표시 이름만 바꾸려면 `CFBundleDisplayName`과 `.app` 번들 디렉토리 이름만 변경한다** — 이 두 가지는 `userData` 경로에 영향을 주지 않는다.

```bash
# 안전한 Dock 이름 변경 방법
DIST="node_modules/electron/dist"
mv "$DIST/Electron.app" "$DIST/SNS Analyzer.app"

PLIST="$DIST/SNS Analyzer.app/Contents/Info.plist"
plutil -replace CFBundleDisplayName -string "SNS Analyzer" "$PLIST"
# CFBundleName은 변경하지 않는다!

echo "SNS Analyzer.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
```

5. **이름 관련 변경 전에 반드시 현재 `userData` 경로를 확인한다**:
```js
console.log(app.getPath('userData'));
// 예상: ~/Library/Application Support/card-news-sns-analyzer
```
