# 백엔드 API 명세 (구현 기준)

> 작성: 2026-09-30 · 브랜치 `feature/backend-setup` · 서버 기본 주소 `http://localhost:3000`
> 실제로 구현된 코드(`backend/routes/`) 기준으로 정리한 문서입니다. 각 규칙을 **왜** 그렇게 정했는지는 `docs/03_백엔드_구현현황.md`에 있습니다.

## 0. 비교 기준이 된 명세 문서

현재 저장소에는 API 명세가 두 개 있어서 둘 다와 비교했습니다.

| 기호 | 파일 | 작성 | 내용 |
|---|---|---|---|
| **A** | `main` 브랜치 `docs/02_API명세.md` | NamJaeHyeon (9/21~24) | 초기 초안. `POST /api` 하나에 `p`(purpose) 코드로 기능 구분. 추천 음식(`p: 0`), 간판 인식(`p: 1`) 2개만 정의. 문서 끝이 중간에 잘려 있음 |
| **B** | `docs/api-spec` 브랜치 `docs/02_API_명세.md` | KimGeonho (9/30) | 엔드포인트 8개 상세 명세. **구현 기준으로 삼은 문서** |

**표시 방법**
- ✅ **명세대로**: 명세 B에 있던 그대로 구현
- ➕ **추가**: 어느 명세에도 없어서 새로 정한 것 (필드, 에러, 검증 규칙). 팀 확인 필요
- 🔄 **A와 다름**: 명세 A의 방식과 다르게 구현한 것 (B를 따랐기 때문)

> ⚠️ **엔드포인트(주소)를 새로 만든 것은 없습니다.** 8개 모두 명세 B에 있습니다. 검색(`keyword`), 추천, 간판 인식도 명세 B에 이미 정의되어 있었습니다. 추가한 것은 기존 API 안의 필드·에러·검증 규칙입니다.

---

## 1. 한눈에 보기

| # | 기능 | 메서드 | 주소 | 명세 B | 명세 A | 추가된 부분 |
|---|---|---|---|---|---|---|
| 1 | 가게 목록 조회 (검색·필터·거리순) | `GET` | `/api/stores` | ✅ | ❌ 없음 | ➕ 좌표 검증, 중복 쿼리 400 |
| 2 | 가게 상세 조회 | `GET` | `/api/stores/:id` | ✅ | ❌ 없음 | ➕ 방문수 집계 |
| 3 | 간판 인식 | `POST` | `/api/stores/recognize` | ✅ | 🔄 `POST /api {p:1, d:base64}` | ➕ `text` 필드, 에러 7종 |
| 4 | 오늘의 동네 추천 | `GET` | `/api/stores/recommendations` | ✅ | 🔄 `POST /api {p:0}` (음식 목록) | ➕ 추천 기준 숫자 |
| 5 | 주문/예약 생성 | `POST` | `/api/orders` | ✅ | ❌ 없음 | ➕ 검증 규칙 다수 |
| 6 | 주문 상태 조회 | `GET` | `/api/orders/:id` | ✅ | ❌ 없음 | - |
| 7 | 가게별 주문 목록 (점주) | `GET` | `/api/stores/:id/orders` | ✅ | ❌ 없음 | ➕ 정렬 기준 |
| 8 | 주문 상태 변경 (점주) | `PATCH` | `/api/orders/:id/status` | ✅ | ❌ 없음 | ➕ 409 세부 규칙 |
| - | 서버 동작 확인 | `GET` | `/` | ➕ | ❌ | 텍스트 `06_CALAR 백엔드 서버 동작 중.` |

---

## 2. 데이터 형식

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
| `openStatus` | `"open"` / `"closed"` | **서버가 요청 시점의 한국 시간으로 계산** (명세 B 4장 합의대로) |
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

모든 에러는 `{ "error": "메시지" }` 형식입니다.

---

## 3. API 상세

### 3-1. 가게 목록 조회 `GET /api/stores` — ✅ 명세 B

**요청 (쿼리, 모두 선택)**

| 파라미터 | 타입 | 설명 | 구분 |
|---|---|---|---|
| `category` | string | 업종이 정확히 같은 가게만 | ✅ |
| `keyword` | string | 이름·`signKeywords`에 포함된 가게만 | ✅ |
| `lat`, `lng` | number | 이 좌표에서 가까운 순으로 정렬 | ✅ |

- ➕ 앞뒤 공백은 무시하고, 빈 값은 안 보낸 것으로 처리합니다.
- ➕ `keyword`는 띄어쓰기·특수문자를 무시하고 비교합니다 (`손 칼국수` → `월계 손칼국수`).

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
- 조회할 때마다 `visits` +1. 같은 사용자(IP + 브라우저)가 30분 안에 다시 조회하면 세지 않습니다.
- `HEAD` 요청은 세지 않습니다.
- 명세 B는 `visits` 필드만 정의하고 늘리는 방법은 정하지 않았습니다.

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
- ✅ 형식은 명세 B와 같습니다.
- ➕ `stores`는 점수가 높은 순서입니다. 가게 이름 전체가 보이거나 키워드가 2개 이상 맞아야 매칭합니다.

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

→ 프론트는 **200이 아니거나 `matched: false`면** "수동 검색으로 전환" 안내를 보여주면 됩니다 (명세 B의 실패 처리 방식과 같음).

**🔄 명세 A와 다른 점**

| | 명세 A | 구현 (명세 B) |
|---|---|---|
| 주소 | `POST /api` + `p: 1` | `POST /api/stores/recognize` |
| 사진 전송 | JSON 안에 base64 문자열 (`d: "data:image/jpeg;base64,..."`) | multipart 파일 (`image`). base64보다 크기가 약 25% 작음 |
| 응답 | `{ d: "https://wolgye.kr/..." }` (가게 페이지 주소, 문서가 여기서 잘림) | `{ matched, stores: [{ id, name }] }` → 프론트가 `/store/:id`로 이동 |

---

### 3-4. 오늘의 동네 추천 `GET /api/stores/recommendations` — ✅ 명세 B

**요청 (쿼리, 선택)**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `lat`, `lng` | number | 보내면 반경 2km 안의 가게만 추천 ✅ (반경 숫자는 ➕) |

**응답** `200` — `Store[]` (최대 10개). 반경 안에 없으면 `[]`

➕ **추천 기준** (명세 B는 "신규 또는 저활성 가게 위주"라고만 되어 있어서 숫자를 정함)
1. 신규 가게: 등록 30일 이내, 최근 등록순
2. 저활성 가게: 방문 30 이하, 방문 적은 순
3. 두 기준 모두 해당하지 않으면 제외

**에러**: 3-1의 `lat`/`lng` 에러와 같음

**🔄 명세 A와 다른 점**

| | 명세 A | 구현 (명세 B) |
|---|---|---|
| 주소 | `POST /api` + `p: 0` | `GET /api/stores/recommendations` |
| 추천 대상 | **음식** (`food_name`, `food_img`, `food_cost`, `food_rate`) | **가게** (`Store` 전체) |
| 음식 이미지·평점 | 있음 | 없음 (데이터에 이미지·평점 필드가 없음) |

---

### 3-5. 주문/예약 생성 `POST /api/orders` — ✅ 명세 B

**요청 (JSON 바디)**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `storeId` | number | ✅ | 가게 번호 (문자열 `"1"` 불가) |
| `items` | `{ menuId, quantity }[]` | ✅ | 1개 이상. 수량은 1 이상 정수 |
| `pickupTime` | string | ✅ | `YYYY-MM-DDTHH:mm` (한국 시간) |
| `customerPhone` | string | ✅ | `010-1234-5678`, `01012345678`, `02-123-4567` 등 |

- ✅ `id`, `status`, `createdAt`, `totalPrice`는 보내도 무시하고 서버가 정합니다.
- ➕ 같은 메뉴가 여러 번 오면 하나로 합칩니다 (101번 2개 + 101번 1개 → 3개).

**응답** `201` — 생성된 `Order`

**에러** (모두 400, 404만 예외)

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
- ➕ 픽업 시간이 빠른 순, 같으면 먼저 들어온 순으로 정렬합니다.

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

> 명세 B 4장의 미결 사항인 **거절 사유(`rejectionReason`)는 구현하지 않았습니다.**

---

## 4. 모든 API 공통 에러 — ➕ 추가

| 상황 | 코드 | 메시지 |
|---|---|---|
| 없는 주소 / 지원 안 하는 메서드 | 404 | `Not found` |
| JSON 문법이 깨진 body | 400 | `Invalid JSON body` |
| JSON body 100KB 초과 | 413 | `Request body too large` |
| 주소의 `%` 인코딩이 깨짐 | 400 | (Express 기본 메시지) |
| 예상 못 한 서버 오류 | 500 | `Internal server error` |

- CORS: 모든 출처 허용 (`Access-Control-Allow-Origin: *`)

---

## 5. 명세 A에만 있고 구현하지 않은 것

| 명세 A 항목 | 상태 | 이유 |
|---|---|---|
| `POST /api` + `p`(purpose) 코드로 기능 구분 | 🔄 기능별 주소로 대체 | 명세 B가 REST 방식(주소 = 대상, 메서드 = 동작)으로 재정의함 |
| 추천 **음식** 목록 (`food_name`, `food_img`, `food_cost`, `food_rate`) | ❌ 미구현 | 명세 B에서 추천 대상이 **가게**로 바뀜. 음식 이미지·평점 데이터 없음 |
| `GET /home`, `GET /pannel` | 해당 없음 | 백엔드 API가 아니라 프론트 화면 주소 |
| 간판 사진을 base64로 전송 | 🔄 multipart 파일로 대체 | 명세 B 방식 |

→ 명세 A와 B 중 어느 쪽을 최종본으로 할지 정리가 필요합니다 (`docs/03_백엔드_구현현황.md` 4장).
