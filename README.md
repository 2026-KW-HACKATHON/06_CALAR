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
| `frontend/` | 사용자 화면 | React |
| `backend/` | 서버·API·추천 로직 | Node.js |
| `image-proc/` | 간판 인식·이미지 처리 | C / Rust |
| `docs/` | 기획안·설계 문서 | - |

## 개발 환경

(추후 작성: 설치 방법, 실행 방법)

## 팀

팀명: 06_CALAR
(팀원 정보 추후 작성)

## 라이선스 및 출처

- 본 프로젝트 라이선스: (추후 결정, 예: MIT)
- 사용한 오픈소스 및 출처:
  - (라이브러리명 - 라이선스 - 링크)

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
git config --global user.name "NamJaeHyeon" # 사용자 이름 설정
git config --global user.email "rexnamccx1229@gmail.com" # 사용자 이메일 설정
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
9. Select scopes에서 repo 선
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



원격 저장소 연결:
```bash
git remote add origin https://github.com/2026-KW-HACKATHON/06_CALAR.git
```
<img width="1220" height="1089" alt="image" src="https://github.com/user-attachments/assets/71e1dd01-6afe-4974-895e-dff6b6eecc15" />



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
git add .
```

커밋(업로드 준비 작업) 생성:
```bash
git commit -m "feat: 기능 추가, 여기는 아무거나 쳐도 됨. 걍 메모장"
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
git pull origin temp
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
