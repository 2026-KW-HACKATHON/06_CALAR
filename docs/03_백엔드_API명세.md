# 백엔드 API 명세 (구현 기준)

> 작성: 2026-09-30 · 브랜치 `feature/backend-setup` · 서버 기본 주소 `http://localhost:3000`
> 실제 구현된 코드(`backend/routes/`) 기준으로 정리한 문서임. 각 규칙을 **왜** 그렇게 정했는지는 `docs/03_백엔드_구현현황.md` 참고.

## 0. 비교 기준이 된 명세 문서

- 현재 저장소에 API 명세가 두 개 존재하여 두 문서 모두와 비교함.

| 기호 | 파일 | 작성 | 내용 |
|---|---|---|---|
| **A** | `main` 브랜치 `docs/02_API명세.md` | NamJaeHyeon (9/21~24) | 초기 초안. `POST /api` 하나에 `p`(purpose) 코드로 기능 구분. 추천 음식(`p: 0`), 간판 인식(`p: 1`) 2개만 정의. 문서 끝이 중간에 잘려 있음 |
| **B** | `docs/api-spec` 브랜치 `docs/02_API_명세.md` | KimGeonho (9/30) | 엔드포인트 8개 상세 명세. **구현 기준으로 삼은 문서** |

**표시 방법**
- ✅ **명세대로**: 명세 B에 있던 그대로 구현
- ➕ **추가**: 어느 명세에도 없어서 새로 정한 것 (필드, 에러, 검증 규칙). 팀 확인 필요
- 🔄 **A와 다름**: 명세 A의 방식과 다르게 구현한 것 (B를 따랐기 때문)

> 기존 가게·주문 API에 더해 인증 및 역할별 관리 엔드포인트가 추가되었다. 인증·관리 규약은 4장 참고.

---

## 1. 한눈에 보기

| # | 기능 | 메서드 | 주소 | 명세 B | 명세 A | 추가된 부분 |
|---|---|---|---|---|---|---|
| 1 | 가게 목록 조회 (검색·필터·거리순) | `GET` | `/api/stores` | ✅ | ❌ 없음 | ➕ 좌표 검증, 중복 쿼리 400 |
| 2 | 가게 상세 조회 | `GET` | `/api/stores/:id` | ✅ | ❌ 없음 | ➕ 방문수 집계 |
| 3 | 간판 인식 | `POST` | `/api/stores/recognize` | ✅ | 🔄 `POST /api {p:1, d:base64}` | ➕ `text` 필드, 에러 추가 |
| 4 | 오늘의 동네 추천 | `GET` | `/api/stores/recommendations` | ✅ | 🔄 `POST /api {p:0}` (음식 목록) | ➕ 추천 기준 숫자 |
| 5 | 주문/예약 생성 | `POST` | `/api/orders` | ✅ | ❌ 없음 | ➕ 검증 규칙 다수 |
| 6 | 주문 상태 조회 | `GET` | `/api/orders/:id` | ✅ | ❌ 없음 | - |
| 7 | 가게별 주문 목록 (점주) | `GET` | `/api/stores/:id/orders` | ✅ | ❌ 없음 | ➕ 정렬 기준 |
| 8 | 주문 상태 변경 (점주) | `PATCH` | `/api/orders/:id/status` | ✅ | ❌ 없음 | ➕ 409 세부 규칙 |
| - | 서버 동작 확인 | `GET` | `/` | ➕ | ❌ | 텍스트 `06_CALAR 백엔드 서버 동작 중.` |

---

## 2. 데이터 형식

모든 주요 테이블(`users`, `stores`, `menus`, `orders` 등)은 레코드마다 고유한 UUID v4를 저장하며 API에서 `uuid` 필드로 제공한다. 기존 숫자 `id`와 숫자 외래키는 이전 API·프론트 호환성을 위해 내부 키로 유지한다.

### Store (가게) — 명세 B와 같음 ✅

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 가게 번호 |
| `name` | string | 가게 이름 |
| `category` | string | 업종 |
| `description` | string | 한 줄 소개 |
| `phone` | string | 전화번호 |
| `address` | string | 주소 |
| `location` | `{ lat, lng }` | 좌표 |
| `openHours` | string | `"11:00-21:00"` (자정 넘김 `"18:00-02:00"`, 24시간 `"00:00-24:00"` 가능) |
| `openStatus` | `"open"` / `"closed"` | **요청 시점의 한국 시간 기준으로 서버가 계산** (명세 B 4장 합의 사항) |
| `orderType` | `"preorder"` / `"reservation"` / `"none"` | 주문 방식 |
| `signKeywords` | string[] | 간판 인식 매칭용 키워드 |
| `menu` | `{ id, name, price }[]` | 메뉴 |
| `coupon` | `{ title, discountRate }` 또는 `null` | 쿠폰 없으면 `null` |
| `visits` | number | 방문수 |
| `createdAt` | string | `YYYY-MM-DD` |

### Order (주문) — 명세 B와 같음 ✅

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 주문 번호 (서버가 생성) |
| `storeId` | number | 가게 번호 |
| `items` | `{ menuId, quantity }[]` | 주문 항목 (같은 메뉴는 합쳐서 저장 ➕) |
| `totalPrice` | number | 서버가 메뉴 가격으로 계산 |
| `pickupTime` | string | `YYYY-MM-DDTHH:mm` (한국 시간) |
| `customerPhone` | string | 고객 연락처 |
| `status` | `pending` / `accepted` / `rejected` / `done` | 생성 시 `pending` |
| `createdAt` | string | `YYYY-MM-DDTHH:mm` (한국 시간, 서버가 생성) |

### 에러 응답 — 명세 B와 같음 ✅

- 모든 에러는 `{ "error": "메시지" }` 형식임.

---

## 3. API 상세

### 3-1. 가게 목록 조회 `GET /api/stores` — ✅ 명세 B

**요청 (쿼리, 모두 선택)**

| 파라미터 | 타입 | 설명 | 구분 |
|---|---|---|---|
| `category` | string | 업종이 정확히 같은 가게만 | ✅ |
| `keyword` | string | 이름·`signKeywords`에 포함된 가게만 | ✅ |
| `lat`, `lng` | number | 이 좌표에서 가까운 순으로 정렬 | ✅ |

- ➕ 앞뒤 공백 무시, 빈 값은 미전송으로 처리함.
- ➕ `keyword`는 띄어쓰기·특수문자를 무시하고 비교함 (`손 칼국수` → `월계 손칼국수`).

**응답** `200` — `Store[]`. 결과가 없으면 `[]` (에러 아님)

**에러**

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| `lat`/`lng`가 숫자가 아님 | 400 | `Invalid query parameter: lat` | ✅ |
| `lat`이 ±90, `lng`가 ±180 범위 밖 | 400 | `Invalid query parameter: lat` | ➕ |
| `lat`, `lng` 중 하나만 보냄 | 400 | `lat and lng must be provided together` | ➕ |
| 같은 키를 두 번 보냄 (`?category=a&category=b`) | 400 | `Invalid query parameter: category` | ➕ |

---

### 3-2. 가게 상세 조회 `GET /api/stores/:id` — ✅ 명세 B

**요청**: 주소의 `:id` (가게 번호)

**응답** `200` — `Store` 객체 하나

**에러**

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| 해당 가게 없음 | 404 | `Store not found` | ✅ |
| `:id`가 1 이상의 정수가 아님 (`abc`, `1.0`, `0x1`, `01`) | 404 | `Store not found` | ➕ |

**➕ 추가 동작: 방문수 집계**
- 조회 시마다 `visits` +1. 동일 사용자(IP + 브라우저)의 30분 내 재조회는 미집계.
- `HEAD` 요청은 미집계.
- 명세 B는 `visits` 필드만 정의하고 증가 방법은 미정이었음.

---

### 3-3. 간판 인식 `POST /api/stores/recognize` — ✅ 명세 B

**요청** `Content-Type: multipart/form-data`

| 필드 | 타입 | 필수 | 설명 | 구분 |
|---|---|---|---|---|
| `image` | 파일 | ✅ | jpeg / png / webp, 10MB·5천만 화소 이하 | ✅ (형식·크기 숫자는 ➕) |
| `text` | string | 선택 | **개발용**: 보내면 OCR 대신 이 글자로 매칭 | ➕ |

**응답** `200`

```json
{ "matched": true, "stores": [{ "id": 1, "name": "월계 손칼국수" }] }
{ "matched": false, "stores": [] }
```
- ✅ 형식은 명세 B와 동일함.
- ➕ `stores`는 점수 높은 순. 가게 이름 전체가 보이거나 키워드 2개 이상 일치 시에만 매칭함.

**에러**

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| 이미지 파일 누락 | 400 | `Image file is required` | ✅ |
| 지원 안 하는 형식 (파일 내용으로 판단, HEIC 포함) | 400 | `Unsupported file type` | ✅ |
| 파일 용량 초과 (10MB) | 413 | `File too large` | ✅ (숫자는 ➕) |
| 헤더는 정상인데 내용이 깨진 이미지 | 400 | `Invalid image file` | ➕ |
| `image` 필드가 아니거나 파일 2개 이상 | 400 | `Send exactly one image file in the 'image' field` | ➕ |
| multipart 형식이 깨짐 | 400 | `Invalid multipart body` | ➕ |
| `text`를 여러 번 보냄 | 400 | `text must be a single string` | ➕ |
| 해상도 5천만 화소 초과 | 413 | `Image dimensions too large` | ➕ |
| 인식 요청이 5개 넘게 몰림 | 503 | `Sign recognition is busy, please try again` | ➕ |
| OCR 준비 실패 | 503 | `Sign recognition is temporarily unavailable` | ➕ |
| 인식 30초 초과 | 504 | `Sign recognition timed out` | ➕ |
| 인식 중 OCR 프로세스 비정상 종료 | 500 | `Sign recognition failed` | ➕ |

→ 프론트는 **200이 아니거나 `matched: false`인 경우** "수동 검색으로 전환" 안내를 표시하면 됨 (명세 B의 실패 처리 방식과 동일).

**🔄 명세 A와 다른 점**

| | 명세 A | 구현 (명세 B) |
|---|---|---|
| 주소 | `POST /api` + `p: 1` | `POST /api/stores/recognize` |
| 사진 전송 | JSON 내 base64 문자열 (`d: "data:image/jpeg;base64,..."`) | multipart 파일 (`image`). base64 대비 크기 약 25% 감소 |
| 응답 | `{ d: "https://wolgye.kr/..." }` (가게 페이지 주소, 문서가 여기서 잘림) | `{ matched, stores: [{ id, name }] }` → 프론트가 `/store/:id`로 이동 |

---

### 3-4. 오늘의 동네 추천 `GET /api/stores/recommendations` — ✅ 명세 B

**요청 (쿼리, 선택)**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `lat`, `lng` | number | 전송 시 반경 2km 이내 가게만 추천 ✅ (반경 수치는 ➕) |

**응답** `200` — `Store[]` (최대 10개). 반경 내 가게가 없으면 `[]`

➕ **추천 기준** (명세 B에 "신규 또는 저활성 가게 위주"로만 기재되어 수치를 정함)
1. 신규 가게: 등록 30일 이내, 최근 등록순
2. 저활성 가게: 방문 30 이하, 방문 적은 순
3. 두 기준 모두 해당하지 않으면 제외

**에러**: 3-1의 `lat`/`lng` 에러와 동일

**🔄 명세 A와 다른 점**

| | 명세 A | 구현 (명세 B) |
|---|---|---|
| 주소 | `POST /api` + `p: 0` | `GET /api/stores/recommendations` |
| 추천 대상 | **음식** (`food_name`, `food_img`, `food_cost`, `food_rate`) | **가게** (`Store` 전체) |
| 음식 이미지·평점 | 있음 | 없음 (데이터에 이미지·평점 필드 없음) |

---

### 3-5. 주문/예약 생성 `POST /api/orders` — ✅ 명세 B

- 로그인한 고객의 `Authorization: Bearer <token>` 헤더가 필요하며, 주문은 해당 계정에 연결됨.

**요청 (JSON 바디)**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `storeId` | number | ✅ | 가게 번호 (문자열 `"1"` 불가) |
| `items` | `{ menuId, quantity }[]` | ✅ | 1개 이상. 수량은 1 이상 정수 |
| `pickupTime` | string | ✅ | `YYYY-MM-DDTHH:mm` (한국 시간) |
| `customerPhone` | string | ✅ | `010-1234-5678`, `01012345678`, `02-123-4567` 등 |

- ✅ `id`, `status`, `createdAt`, `totalPrice`는 전송해도 무시되며 서버가 결정함.
- ➕ 동일 메뉴가 여러 번 오면 하나로 합산함 (101번 2개 + 101번 1개 → 3개).

**응답** `201` — 생성된 `Order`

**에러** (404 외 전부 400)

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| 필수 필드 누락 (`null`, `""` 포함) | 400 | `customerPhone is required` 등 | ✅ |
| 없는 가게 | 404 | `Store not found` | ✅ |
| 그 가게 메뉴가 아닌 `menuId` | 400 | `Invalid menuId: 999` | ✅ |
| 주문 안 받는 가게 (`orderType: none`) | 400 | `This store does not accept orders` | ✅ |
| body가 JSON 객체가 아님 (배열, 빈 body, form 형식) | 400 | `Request body must be a JSON object` | ➕ |
| `storeId`가 1 이상 정수가 아님 | 400 | `Invalid storeId` | ➕ |
| `items`가 배열이 아니거나 비어 있음 | 400 | `items must be a non-empty array` | ➕ (B는 "최소 1개"만 명시) |
| `items` 항목이 객체가 아님 | 400 | `Each item must be an object with menuId and quantity` | ➕ |
| 수량이 1 이상 정수가 아님 | 400 | `Invalid quantity for menuId: 101` | ➕ |
| 메뉴 하나 수량 99 초과 | 400 | `Quantity for menuId: 101 exceeds 99` | ➕ |
| `pickupTime` 형식 틀림 / 없는 날짜 (2월 30일 등) | 400 | `Invalid pickupTime format (YYYY-MM-DDTHH:mm)` | ➕ |
| `pickupTime`이 과거 | 400 | `pickupTime must not be in the past` | ➕ |
| `pickupTime`이 30일보다 뒤 | 400 | `pickupTime must be within 30 days` | ➕ |
| `pickupTime`이 영업시간 밖 | 400 | `pickupTime is outside business hours` | ➕ |
| 전화번호 형식 틀림 | 400 | `Invalid customerPhone format` | ➕ |

---

### 3-6. 주문 상태 조회 `GET /api/orders/:id` — ✅ 명세 B

- 로그인 주문은 주문자, 해당 가게 점주 또는 관리자만 조회할 수 있음.

**요청**: 주소의 `:id` (주문 번호)
**응답** `200` — `Order`

**에러**

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| 해당 주문 없음 (`:id`가 정수가 아닌 경우 포함) | 404 | `Order not found` | ✅ |

---

### 3-7. 가게별 주문 목록 `GET /api/stores/:id/orders` — ✅ 명세 B

**요청 (쿼리, 선택)**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `status` | string | `pending` / `accepted` / `rejected` / `done` 중 하나. 없거나 빈 값이면 전체 |

**응답** `200` — `Order[]`
- ➕ 픽업 시간 빠른 순, 동일하면 먼저 들어온 순으로 정렬함.

**에러**

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| 해당 가게 없음 | 404 | `Store not found` | ✅ |
| 허용 안 되는 `status` 값 | 400 | `Invalid status value` | ✅ |
| `status`를 두 번 보냄 | 400 | `Invalid query parameter: status` | ➕ |

---

### 3-8. 주문 상태 변경 `PATCH /api/orders/:id/status` — ✅ 명세 B

**요청 (JSON 바디)**: `{ "status": "accepted" }` — `accepted` / `rejected` / `done`

**응답** `200` — 변경된 `Order`

**상태 변경 규칙** (명세 B의 흐름도를 그대로 규칙화)

| 현재 상태 | 바꿀 수 있는 상태 |
|---|---|
| `pending` | `accepted`, `rejected` |
| `accepted` | `done` |
| `rejected`, `done` | 없음 |

**에러**

| 상황 | 코드 | 메시지 | 구분 |
|---|---|---|---|
| 해당 주문 없음 | 404 | `Order not found` | ✅ |
| `pending`으로 되돌리기 | 400 | `Cannot change status to pending` | ✅ |
| 이미 `done`/`rejected`인 주문 | 409 | `Order status cannot be changed anymore` | ✅ |
| `status` 누락 | 400 | `status is required` | ➕ |
| 없는 `status` 값 (`foo`, 대문자 등) | 400 | `Invalid status value` | ➕ |
| 흐름도에 없는 변경 (`pending → done`, `accepted → rejected`, 같은 상태로 변경) | 409 | `Cannot change status from pending to done` | ➕ |

> 명세 B 4장의 미결 사항인 **거절 사유(`rejectionReason`)는 미구현.**

---

## 4. 인증 및 역할별 관리 API

`Authorization: Bearer <token>` 세션 토큰을 사용한다. 원문 토큰은 클라이언트에만 전달하며 DB에는 SHA-256 해시와 만료 시각을 저장한다. 세션은 14일간 유효하다.

| 메서드 | 주소 | 권한 | 기능 |
|---|---|---|---|
| `POST` | `/api/auth/register` | 공개 | 고객 또는 점주 가입 |
| `POST` | `/api/auth/login` | 공개 | 로그인 및 세션 발급 |
| `GET` | `/api/auth/me` | 로그인 | 내 계정 및 사업자 정보 |
| `PATCH` | `/api/auth/profile` | 로그인 | 이름·연락처·주소 수정 |
| `PUT` | `/api/auth/business` | 점주 | 사업자 정보 수정 후 재검토 요청 |
| `POST` | `/api/auth/logout` | 로그인 | 현재 세션 삭제 |
| `GET` | `/api/auth/orders` | 로그인 | 내 주문 내역 |
| `GET/POST/PATCH/DELETE` | `/api/owner/stores...` | 승인된 점주 | 본인 가게·메뉴·쿠폰 CRUD |
| `GET/PATCH` | `/api/owner/stores/:id/orders`, `/api/owner/orders/:id/status` | 해당 가게 점주 | 주문 조회 및 상태 변경 |
| `GET/PATCH/DELETE` | `/api/admin/users...` | 관리자 | 사용자 조회·수정·삭제 |
| `GET/PATCH` | `/api/admin/businesses...` | 관리자 | 사업자 신청 조회·승인·보완 요청 |
| `GET/POST/PATCH/DELETE` | `/api/admin/stores...`, `/api/admin/categories...` | 관리자 | 가게·업종 CRUD |

점주 가입 시 사업자번호 체크섬을 검사하고 사업자명·대표자·사업장 주소를 저장한다. 체크섬은 번호 형식 검사이며 국세청 등록 사실을 증명하지 않는다. 관리자가 확인해 `verified`로 승인한 뒤 점주 가게 관리 API를 사용할 수 있다. 가게 생성 폼은 사업장 주소를 기본값으로 사용하고 주소를 지도 검색 링크로 연결한다.

신규 주문은 로그인한 고객 계정에 연결된다. 주문 조회는 주문자·해당 점주·관리자로 제한한다. 주문 이력이 있는 가게나 메뉴의 삭제는 `409`로 거부한다.

---

## 5. 중요 변경 이력

`importantDetailsUpdate`는 사용자 프로필, 사업자 승인/정보, 가게, 메뉴, 쿠폰, 업종, 주문 상태 등 주요 변경을 필드별로 기록한다. 생성은 이전 값이 `NULL`, 삭제는 변경 후 값이 `NULL`이며, 변경 전/후가 같은 필드는 기록하지 않는다. 원본 변경과 로그 INSERT는 같은 SQLite 트랜잭션으로 처리한다.

비밀번호 해시, 세션 토큰, 사업자등록번호, 고객 주문 연락처는 로그에 복사하지 않는다. 프로필 연락처·주소 등 일반 변경 필드는 이력에 남는다. `updated_record_id`는 해당 테이블의 내부 숫자 키이며, 감사 로그 자체에도 UUID가 부여된다.

---

## 6. 모든 API 공통 에러 — ➕ 추가

| 상황 | 코드 | 메시지 |
|---|---|---|
| 없는 주소 / 지원 안 하는 메서드 | 404 | `Not found` |
| JSON 문법이 깨진 body | 400 | `Invalid JSON body` |
| JSON body 100KB 초과 | 413 | `Request body too large` |
| 주소의 `%` 인코딩이 깨짐 | 400 | (Express 기본 메시지) |
| 예상 못 한 서버 오류 | 500 | `Internal server error` |

- CORS: 모든 출처 허용 (`Access-Control-Allow-Origin: *`)

---

## 7. 명세 A에만 있고 구현하지 않은 것

| 명세 A 항목 | 상태 | 이유 |
|---|---|---|
| `POST /api` + `p`(purpose) 코드로 기능 구분 | 🔄 기능별 주소로 대체 | 명세 B가 REST 방식(주소 = 대상, 메서드 = 동작)으로 재정의함 |
| 추천 **음식** 목록 (`food_name`, `food_img`, `food_cost`, `food_rate`) | ❌ 미구현 | 명세 B에서 추천 대상이 **가게**로 바뀜. 음식 이미지·평점 데이터 없음 |
| `GET /home`, `GET /pannel` | 해당 없음 | 백엔드 API가 아니라 프론트 화면 주소 |
| 간판 사진을 base64로 전송 | 🔄 multipart 파일로 대체 | 명세 B 방식 |

→ 명세 A와 B 중 최종본 결정 필요한 것으로 판단됨 (`docs/03_백엔드_구현현황.md` 4장).
