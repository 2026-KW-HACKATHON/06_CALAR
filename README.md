# 06_CALAR — 월계1동 지역상권 앱 (가제)

2026 광운대학교 KW 해커톤 출품작 (팀 06_CALAR).
월계1동 지역 경제 순환을 돕기 위한 지역 상권 접근성 앱.

## 프로젝트 개요

동네 가게 접근성을 높이고, 외부인·고령층·디지털 취약계층도
쉽게 쓸 수 있도록 하는 것을 목표로 한다.

### 핵심 기능
1. 가게 간판 촬영 → 가게 정보(메뉴·설명·추천·쿠폰) 표시
2. 미리 주문·예약 → 점주가 확인 후 준비 (업종 전반)
3. 방문 저조 가게 우선 추천으로 지역경제 순환 기여

## 폴더 구조

| 폴더 | 설명 | 스택 |
|------|------|------|
| `frontend/` | 고객·점주·관리자 화면 | React / Vite |
| `mobileapp/` | 안드로이드·iOS 앱 (프론트를 감싼 앱) | Capacitor |
| `backend/` | 서버·API·추천 로직·간판 OCR | Node.js |
| `image-proc/` | 간판 사진 전처리 (OCR 정확도·속도 개선) | Rust → WebAssembly |
| `deploy/` | 운영 서버 설정 (nginx, systemd) | - |
| `docs/` | 기획안·설계 문서 | - |

## 개발 환경

- Node.js 22.5 이상 필요 (`node:sqlite` 내장 사용)
- 백엔드: `cd backend` 후 `npm install`, `npm start` (기본 `http://localhost:8008`)
- 프론트엔드: 별도 터미널에서 `cd frontend` 후 `npm install`, `npm run dev` (기본 `http://localhost:5173`)
- 서버 시작 시 `backend/setup.sql`을 적용하고 초기 데이터가 없는 항목을 시드합니다.
- SQLite 파일은 기본적으로 `backend/06_calar.sqlite`에 생성됩니다. 다른 경로는 `CALAR_DB_PATH` 환경 변수로 지정할 수 있습니다.
- 모든 DB 레코드에는 고유 UUID v4가 있으며, 기존 정수 기본키는 관계와 API 호환성을 위해 내부 키로 유지됩니다.
- 최초 관리자 계정은 실행 전에 `CALAR_ADMIN_EMAIL`과 12자 이상 `CALAR_ADMIN_PASSWORD`를 설정하면 생성됩니다. 관리자 계정은 DB에 없을 때만 추가됩니다.
- 점주 가입 시 사업자번호 체크섬을 확인하고 관리자 승인 전까지 가게 관리 기능을 제한합니다. 국세청 진위 확인은 별도 API 연동이 필요합니다.
- 간판 사진 전처리(`image-proc`)는 빌드된 `image-proc/pkg/calar_imgproc.wasm`을 백엔드가 바로 읽으므로 Rust 설치 없이 동작합니다. Rust 코드를 고쳤을 때만 다시 빌드합니다 (`image-proc/README.md`).
- 실제 휴대폰 간판 사진 인식률 확인: 사진을 `3_가게이름.jpg`처럼 가게 번호로 시작하게 저장한 폴더를 만들고 `cd backend` 후 `npm run evaluate:signs -- <폴더>`

```powershell
$env:CALAR_ADMIN_EMAIL = 'admin@example.com'
$env:CALAR_ADMIN_PASSWORD = 'replace-with-a-unique-password'
cd backend
npm start
```

## 팀

팀명: 06_CALAR
(팀원 정보 추후 작성)

## 라이선스 및 출처

- 본 프로젝트 라이선스: (추후 결정, 예: MIT)
- 사용한 오픈소스 및 출처:
  - [백엔드] express - MIT - https://github.com/expressjs/express
  - [백엔드] cors - MIT - https://github.com/expressjs/cors
  - [백엔드] multer - MIT - https://github.com/expressjs/multer
  - [백엔드] tesseract.js - Apache-2.0 - https://github.com/naptha/tesseract.js
  - [백엔드] @tesseract.js-data/kor, @tesseract.js-data/eng - MIT - https://github.com/naptha/tessdata
  - [백엔드] nodemailer - MIT-0 - https://github.com/nodemailer/nodemailer
  - [프론트·모바일] react, react-dom - MIT - https://github.com/facebook/react
  - [프론트·모바일] react-router-dom - MIT - https://github.com/remix-run/react-router
  - [프론트·모바일] axios - MIT - https://github.com/axios/axios
  - [프론트·모바일] vite, @vitejs/plugin-react - MIT - https://github.com/vitejs/vite
  - [모바일] @capacitor/core, cli, android, ios, app, browser, geolocation - MIT - https://github.com/ionic-team/capacitor
  - [image-proc] image (zune-jpeg, png, image-webp 등 포함) - MIT OR Apache-2.0 - https://github.com/image-rs/image
  - [image-proc] 그 밖에 image가 쓰는 크레이트(flate2, miniz_oxide, bytemuck, moxcms 등) - MIT / Apache-2.0 / BSD-3-Clause / Zlib 중 택일 - `cd image-proc && cargo tree -e normal --format "{p} {l}"`로 전체 목록 확인
  - [백엔드 테스트 이미지] Noto Sans KR 폰트로 제작 - OFL - https://fonts.google.com/noto/specimen/Noto+Sans+KR

> 개발 규칙에 따라 사용한 오픈소스의 라이선스와 출처를 명시합니다.

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>

# Git 핵심 명령어 치트시트 (Copy & Paste 전용)

---

## 1. 초기 설정 (최초 1회 실행)

```bash
git config --global user.name "Your Name" # 사용자 이름 설정
git config --global user.email "your_email@example.com" # 사용자 이메일 설정
git config --global credential.helper store # 비밀번호 최초 1번만 묻기로 설정
git config --list # 설정 확인
```

토큰 발급법:
1. 우측 상단 프로필 사진 클릭
2. Settings
3. Developer Settings
4. Personal access tokens
5. Tokens (classic)
6. 우측 상단 Generate new token
7. Generate new token (classic)
8. Expiration 설정
9. Select scopes에서 repo 선택
10. 우측 아래 Generate Token 클릭
11. "ghp_*" 복사(이 페이지를 벗어나면 다시 볼 수 없음)

---

## 2. 저장소 시작 & 연결

원격 저장소 복제 (Clone):
```bash
git clone https://github.com/2026-KW-HACKATHON/06_CALAR.git
cd 06_CALAR
```
이후 "ghp_*" 토큰 붙여넣기


연결된 원격 저장소 목록 확인:
```bash
git remote -v
```

브랜치 temp(원래 루트는 main) 생성:
```bash
git switch -c temp
```

---

## 3. 일상 작업 (상태 확인 / 추가 / 커밋)

모든 변경 파일 등록:
```bash
#git status
git add .
```

커밋(업로드 준비 작업) 생성:
```bash
git commit -m "feat: 로그인 기능 구현"
```

최초 푸시 (업스트림 설정):
```bash
git push -u origin temp
```

이후 일반 푸시:
```bash
git push
```

원격 저장소 최신 내용 내려받기 & 병합:
```bash
git pull origin main
```

원격 저장소 최신 내역만 조회 (병합 X):
```bash
git fetch
```

---

## 4. 브랜치 작업

브랜치 병합 (main으로 이동 후 실행):
```bash
git switch main
git merge feature-name
```

브랜치 삭제 (병합 완료된 브랜치):
```bash
git branch -d feature-name
```

브랜치 강제 삭제:
```bash
git branch -D feature-name
```

---

## 기타 작업중인거 임시 저장 불러오기, 브랜치 다루기 등의 명령어도 있으나 사용 빈도가 높지 않아 필요시 검색 추천
