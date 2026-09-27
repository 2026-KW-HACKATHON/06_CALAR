# GitHub 협업 규칙 (Git Convention)

우리 팀의 깔끔한 코드 관리와 원활한 소통을 위한 Git 활용 규칙입니다.

---

## 1. Repository 이름 규칙
* 소문자를 사용하여 작성합니다.
* **형식:** `[역할]`
* **예시:** `frontend`, `backend`, `docs`

---

## 2. 브랜치 이름 규칙 (Branch Naming)
작업 내용에 맞춰 Prefix(접두사)를 붙이고 **소문자/하이픈(`-`)**을 사용합니다.

* **형식:** `[작업유형]/[기능명]`

| 작업 유형 | 설명 | 예시 |
| :--- | :--- | :--- |
| `feature` | 새로운 기능 개발 | `feature/login-kakao` |
| `fix` | 버그 및 오류 수정 | `fix/button-click-error` |
| `refactor` | 코드 리팩토링 (기능 변경 없음) | `refactor/user-service` |
| `docs` | 문서 작성 및 수정 | `docs/readme-update` |
| `chore` | 빌드, 패키지 설정, 기타 잡무 | `chore/install-axios` |

---

## 3. 커밋 메시지 규칙 (Commit Message)
[Conventional Commits](https://www.conventionalcommits.org/) 표준을 따릅니다.

* **형식:** `[태그]: [작업 내용]` (태그 첫 글자는 대문자)
* **예시:** `Feat: 로그인 기능 구현`, `Fix: 버튼 클릭 오류 수정`

| 태그 | 설명 |
| :--- | :--- |
| `Feat` | 새로운 기능 추가 |
| `Fix` | 버그 수정 |
| `Docs` | 문서 수정 (README 등) |
| `Style` | 코드 포맷팅, 세미콜론 정돈 등 (코드 로직 영향 없음) |
| `Refactor` | 코드 리팩토링 (로직 및 구조 개선) |
| `Test` | 테스트 코드 작성 및 수정 |
| `Chore` | 빌드 업무 수정, 패키지 매니저 설정 등 |