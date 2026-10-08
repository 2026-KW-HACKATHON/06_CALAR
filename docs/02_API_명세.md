# 월계 프로젝트 API 명세서 (초안)

프론트엔드와 백엔드가 데이터를 주고받는 약속을 정리한 문서입니다.
처음 API 작업하시는 분들도 이해할 수 있도록 예시 위주로 작성했습니다.

---

## 1. 데이터 필드 정의

### 1-1. Store (가게)

가게 하나의 정보를 나타내는 데이터입니다.

```json
{
  "id": 1,
  "name": "월계 손칼국수",
  "category": "음식점",
  "description": "직접 뽑은 면으로 끓이는 동네 칼국수집",
  "phone": "02-000-0000",
  "address": "서울 노원구 월계1동 ...",
  "location": { "lat": 37.62, "lng": 127.06 },
  "openHours": "11:00-21:00",
  "openStatus": "open",
  "orderType": "preorder",
  "signKeywords": ["월계", "손칼국수"],
  "menu": [
    { "id": 101, "name": "바지락 칼국수", "price": 8000 },
    { "id": 102, "name": "왕만두", "price": 6000 }
  ],
  "coupon": { "title": "만두 1판 10% 할인", "discountRate": 10 },
  "visits": 120,
  "createdAt": "2026-09-01"
}
```

**필드별 설명**

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 가게 고유 번호. 다른 가게랑 절대 안 겹침 |
| `name` | string | 가게 이름 |
| `category` | string | 업종 (예: "음식점", "카페") |
| `description` | string | 한 줄 소개 |
| `phone` | string | 전화번호. `CallButton` 컴포넌트에서 씀 |
| `address` | string | 주소 |
| `location` | `{ lat, lng }` | 지도에 표시할 좌표 |
| `openHours` | string | 영업시간 텍스트 |
| `openStatus` | `"open"` 또는 `"closed"` | 지금 영업중인지 여부. 둘 중 하나만 가능 |
| `orderType` | `"preorder"` / `"reservation"` / `"none"` | 이 가게가 미리주문을 받는지, 예약만 받는지, 둘 다 안 받는지 |
| `signKeywords` | 문자열 배열 | 간판 인식할 때 매칭에 쓰이는 키워드들 |
| `menu` | 메뉴 배열 | 아래 1-2 참고 |
| `coupon` | `{ title, discountRate }` 또는 `null` | 지금 쓸 수 있는 쿠폰 1개. 쓸 수 있는 쿠폰이 없으면 값 자체가 `null`로 옵니다 (빈 객체 `{}` 아님 주의!) |
| `visits` | number | 조회수/방문수. 추천 목록 정렬에 쓰일 예정 |
| `createdAt` | string | 가게 등록일 (`YYYY-MM-DD` 형식, 한국 시간 기준) |

> 🎟️ **쿠폰 고르는 규칙**: DB에는 가게마다 쿠폰이 여러 개 있을 수 있습니다. 백엔드는 `is_active = 1`이고 지금 시각이 `valid_from` ~ `valid_until` 사이인(비어 있으면 제한 없음) 쿠폰 중에서 **할인율(`discountRate`)이 가장 큰 것** 1개를 고릅니다. 할인율이 같으면 먼저 만든 쿠폰(`coupon_id`가 작은 것)을 고릅니다.

> 💡 **`null`과 빈 값의 차이**: `coupon`이 없는 가게는 `"coupon": null` 로 옵니다. 프론트에서는 `if (store.coupon)` 처럼 체크하고 쿠폰 카드를 보여줄지 말지 결정하면 됩니다.

### 1-2. Menu (메뉴) — Store 안에 들어있는 항목

```json
{ "id": 101, "name": "바지락 칼국수", "price": 8000 }
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 메뉴 고유 번호. 주문할 때 이 id를 씀 |
| `name` | string | 메뉴 이름 |
| `price` | number | 가격 (원 단위, 숫자만) |

### 1-3. Order (주문/예약)

```json
{
  "id": 1,
  "storeId": 1,
  "items": [
    { "menuId": 101, "quantity": 2 }
  ],
  "totalPrice": 16000,
  "pickupTime": "2026-10-08T12:30",
  "customerPhone": "010-0000-0000",
  "status": "pending",
  "createdAt": "2026-10-08T11:50"
}
```

**필드별 설명**

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 주문 고유 번호 |
| `storeId` | number | 어느 가게에 낸 주문인지 (Store의 `id`와 연결) |
| `items` | 배열 | 주문한 메뉴 목록. `menuId`로 어떤 메뉴인지, `quantity`로 몇 개인지 표시 |
| `totalPrice` | number | 총 결제 금액 |
| `pickupTime` | string | 픽업/예약 시간 (`YYYY-MM-DDTHH:mm` 형식, ISO 8601이라고 부름. 한국 시간 기준) |
| `customerPhone` | string | 주문한 고객 연락처 |
| `status` | string | 아래 표 참고 |
| `createdAt` | string | 주문 생성 시각 (`YYYY-MM-DDTHH:mm`, 한국 시간 기준. DB에는 UTC로 저장되지만 백엔드가 변환해서 내려줍니다) |

**`status` 값의 흐름**

```
pending (대기중)
   │
   ├─→ accepted (점주가 수락) ──→ done (완료)
   │
   └─→ rejected (점주가 거절)
```

| 값 | 의미 | 누가 바꾸나 |
|---|---|---|
| `pending` | 점주 확인 대기중 (주문 생성 시 자동으로 이 값) | 시스템 기본값 |
| `accepted` | 점주가 수락함 | 점주 |
| `rejected` | 점주가 거절함 | 점주 |
| `done` | 픽업/이용 완료 | 점주 (또는 시스템) |

**허용되는 상태 변경은 아래 3가지뿐입니다.** 그 외의 변경(예: `pending → done`, `accepted → rejected`, `done`/`rejected`에서 다른 값으로)은 전부 에러입니다.

| 지금 상태 | 바꿀 수 있는 상태 |
|---|---|
| `pending` | `accepted`, `rejected` |
| `accepted` | `done` |
| `done`, `rejected` | 없음 (최종 상태) |

> 💡 거절 이유(`rejectionReason`)는 아직 확정 안 해서 이번 필드에서 뺐습니다. 나중에 필요해지면 `status`를 `rejected`로 바꿀 때 같이 보내는 선택 항목(optional)으로 추가할 예정입니다.

---

## 2. API 엔드포인트

### 인증 (로그인 토큰)

주문과 관련된 API는 로그인한 사람만 쓸 수 있습니다. 로그인하면 받는 토큰을 요청 헤더에 넣어서 보냅니다.

```
Authorization: Bearer <토큰>
```

| API | 누가 쓸 수 있나 |
|---|---|
| 2-5 주문 생성 | 로그인한 고객 (비회원 세션 포함) |
| 2-6 주문 상태 조회 | 그 주문을 만든 고객 본인 |
| 2-7 가게별 주문 목록, 2-8 주문 상태 변경 | 그 가게의 점주 본인 (`stores.owner_id`와 로그인한 사용자 id가 같아야 함) |

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 토큰이 없거나 만료됨 | `401` | `{ "error": "Authentication required" }` |
| 로그인은 했지만 내 주문/내 가게가 아님 | `403` | `{ "error": "Forbidden" }` |

> ⚠️ 주문 번호는 1, 2, 3 … 순서대로 매겨지기 때문에, 이 확인이 없으면 누구나 번호를 바꿔 가며 다른 사람의 주문(전화번호 포함)을 보거나 바꿀 수 있습니다. 백엔드는 2-6 ~ 2-8에서 반드시 본인 확인을 해야 합니다.

> 💡 **라우트 등록 순서 주의 (백엔드)**: `/api/stores/recommendations`, `/api/stores/recognize`처럼 고정된 경로는 **`/api/stores/:id`보다 먼저** 등록해야 합니다. 순서가 반대면 `recommendations`를 가게 id로 읽어서 `404 Store not found`가 납니다.

### 2-1. 가게 목록 조회

무엇을 하는 API인지: 홈 화면이나 검색할 때 가게 리스트를 가져올 때 씁니다.

```
GET /api/stores
```

**Query Parameters** (전부 선택사항, 안 보내면 전체 목록)

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `category` | string | 업종으로 필터링. 하위 카테고리에 속한 가게도 포함 (예: `한식` → 국밥, 돼지국밥 가게도 나옴) | `음식점` |
| `keyword` | string | 이름/키워드로 검색 | `칼국수` |
| `lat`, `lng` | number | 현재 위치 기준 거리순 정렬용 좌표 | `37.62`, `127.06` |

**요청 예시**
```
GET /api/stores?category=음식점&keyword=칼국수&lat=37.62&lng=127.06
```

**응답 예시** (`200 OK`)
```json
[
  {
    "id": 1,
    "name": "월계 손칼국수",
    "category": "음식점",
    "openStatus": "open",
    "location": { "lat": 37.62, "lng": 127.06 }
    // ... Store 필드 전체
  },
  {
    "id": 2,
    "name": "월계 분식",
    "category": "음식점",
    "openStatus": "closed"
  }
]
```
→ **가게 여러 개가 배열(`[ ]`)로** 옵니다. 결과가 없으면 빈 배열 `[]`이 옵니다 (에러 아님).

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 잘못된 쿼리 값 (예: `lat`에 문자열) | `400` | `{ "error": "Invalid query parameter: lat" }` |

---

### 2-2. 가게 상세 조회

무엇을 하는 API인지: 가게 하나를 클릭했을 때 상세 정보(StoreDetail 페이지)를 가져올 때 씁니다.

```
GET /api/stores/:id
```

**요청 예시**
```
GET /api/stores/1
```
→ `:id` 자리에 실제 가게 번호(`1`)를 넣어서 요청합니다.

**응답 예시** (`200 OK`)
```json
{
  "id": 1,
  "name": "월계 손칼국수",
  "menu": [
    { "id": 101, "name": "바지락 칼국수", "price": 8000 }
  ]
  // ... Store 필드 전체
}
```
→ 여기는 배열이 아니라 **객체 하나(`{ }`)** 만 옵니다.

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 해당 `id`의 가게가 없음 | `404` | `{ "error": "Store not found" }` |

---

### 2-3. 간판 인식

무엇을 하는 API인지: 카메라로 찍은 간판 사진을 보내면, 매칭되는 가게를 찾아서 돌려줍니다.

```
POST /api/stores/recognize
```

**요청 예시** (사진 파일을 담아서 보냄)
```
Content-Type: multipart/form-data

image: (사진 파일)
```

**응답 예시 — 인식 성공** (`200 OK`)
```json
{
  "matched": true,
  "stores": [
    { "id": 1, "name": "월계 손칼국수" }
  ]
}
```

**응답 예시 — 인식 실패**
```json
{
  "matched": false,
  "stores": []
}
```
→ `matched`가 `false`면, 프론트에서는 "수동 검색으로 전환하시겠어요?" 안내를 보여주면 됩니다.

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 이미지 파일 누락 | `400` | `{ "error": "Image file is required" }` |
| 지원 안 하는 파일 형식 | `400` | `{ "error": "Unsupported file type" }` |
| 파일 용량 초과 | `413` | `{ "error": "File too large" }` |

---

### 2-4. 오늘의 동네 추천 목록

무엇을 하는 API인지: Recommendation 페이지에서 오늘의 추천 가게 목록을 가져올 때 씁니다.

```
GET /api/stores/recommendations
```

**Query Parameters**

| 파라미터 | 타입 | 설명 | 필수 여부 |
|---|---|---|---|
| `lat`, `lng` | number | 사용자 위치. 이 근처 가게 위주로 추천 | 선택 (안 보내면 전체 지역 기준) |

**요청 예시**
```
GET /api/stores/recommendations?lat=37.62&lng=127.06
```

**응답 예시** (`200 OK`)
```json
[
  { "id": 5, "name": "신규 오픈 카페", "createdAt": "2026-09-25", "visits": 3 },
  { "id": 2, "name": "월계 분식", "createdAt": "2026-01-10", "visits": 8 }
]
```
→ 신규 가게(`createdAt`이 최근) 또는 저활성 가게(`visits`가 낮음) 위주로 백엔드에서 골라서 내려줍니다.

---

### 2-5. 주문/예약 생성 (고객이 사용)

무엇을 하는 API인지: 고객이 OrderForm에서 "주문하기" 버튼을 눌렀을 때 씁니다.

```
POST /api/orders
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `storeId` | number | ✅ | 주문할 가게 ID |
| `items` | `{ menuId, quantity }[]` | ✅ | 주문 항목. 최소 1개 이상 |
| `pickupTime` | string | ✅ | 픽업/예약 시간 |
| `customerPhone` | string | ✅ | 고객 연락처 |

```json
{
  "storeId": 1,
  "items": [
    { "menuId": 101, "quantity": 2 }
  ],
  "pickupTime": "2026-10-08T12:30",
  "customerPhone": "010-0000-0000"
}
```
> ⚠️ `id`, `status`, `createdAt`, `totalPrice`는 요청에 안 넣습니다. 서버가 알아서 채워줍니다.
> - `id`, `createdAt`: 서버가 자동 생성
> - `status`: 서버가 자동으로 `"pending"`으로 시작
> - `totalPrice`: **메뉴 가격 기준으로 서버가 직접 계산합니다.** 프론트는 가격 계산 로직을 만들 필요가 없고, 화면에 미리보기용 합계를 보여주고 싶으면 화면 표시용으로만 계산하고 요청에는 안 넣으면 됩니다.

**응답 예시** (`201 Created`)
```json
{
  "id": 1,
  "storeId": 1,
  "items": [{ "menuId": 101, "quantity": 2 }],
  "totalPrice": 16000,
  "pickupTime": "2026-10-08T12:30",
  "customerPhone": "010-0000-0000",
  "status": "pending",
  "createdAt": "2026-10-08T11:50"
}
```
→ 생성된 주문 전체 정보가 그대로 돌아옵니다. 이걸 받아서 "주문이 접수됐어요" 화면을 보여주면 됩니다.

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 토큰 없음 | `401` | `{ "error": "Authentication required" }` |
| 필수 필드 누락 | `400` | `{ "error": "customerPhone is required" }` |
| 존재하지 않는 `storeId` | `404` | `{ "error": "Store not found" }` |
| 존재하지 않는 `menuId` | `400` | `{ "error": "Invalid menuId: 999" }` |
| 그 가게가 주문을 안 받음 (`orderType: 'none'`) | `400` | `{ "error": "This store does not accept orders" }` |

---

### 2-6. 주문 상태 조회 (고객이 사용)

무엇을 하는 API인지: 고객이 "내 주문 상태 확인하기"를 눌렀을 때 씁니다.

```
GET /api/orders/:id
```

**요청 예시**
```
GET /api/orders/1
```

**응답 예시** (`200 OK`)
```json
{
  "id": 1,
  "status": "accepted",
  "pickupTime": "2026-10-08T12:30"
  // ... Order 필드 전체
}
```

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 토큰 없음 | `401` | `{ "error": "Authentication required" }` |
| 다른 사람의 주문 | `403` | `{ "error": "Forbidden" }` |
| 해당 `id`의 주문이 없음 | `404` | `{ "error": "Order not found" }` |

---

### 2-7. 가게로 들어온 주문 목록 조회 (점주가 사용)

무엇을 하는 API인지: 점주가 OwnerHome 화면에서 자기 가게로 들어온 요청 목록을 볼 때 씁니다.

```
GET /api/stores/:id/orders
```

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `status` | string | 선택 | `pending` / `accepted` / `rejected` / `done` 중 하나. 안 보내면 전체 |

**요청 예시**
```
GET /api/stores/1/orders?status=pending
```
→ `status` 쿼리를 안 붙이면 전체 주문이, 붙이면 그 상태인 것만 옵니다.

**응답 예시** (`200 OK`)
```json
[
  { "id": 1, "status": "pending", "pickupTime": "2026-10-08T12:30" },
  { "id": 2, "status": "pending", "pickupTime": "2026-10-08T13:00" }
]
```

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 토큰 없음 | `401` | `{ "error": "Authentication required" }` |
| 내 가게가 아님 | `403` | `{ "error": "Forbidden" }` |
| 해당 `id`의 가게가 없음 | `404` | `{ "error": "Store not found" }` |
| `status` 값이 허용 목록에 없는 값 | `400` | `{ "error": "Invalid status value" }` |

---

### 2-8. 주문 상태 변경 — 수락/거절/완료 (점주가 사용)

무엇을 하는 API인지: 점주가 OwnerOrderManage 화면에서 "수락" 또는 "거절" 버튼을 눌렀을 때 씁니다.

```
PATCH /api/orders/:id/status
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `status` | string | ✅ | `accepted` / `rejected` / `done` 중 하나. 1-3의 허용되는 상태 변경 표를 따라야 함 (`pending`은 수락/거절만, `accepted`는 완료만 가능) |

**요청 예시 — 수락**
```json
{ "status": "accepted" }
```

**요청 예시 — 거절**
```json
{ "status": "rejected" }
```

**요청 예시 — 완료 처리**
```json
{ "status": "done" }
```

**응답 예시** (`200 OK`)
```json
{
  "id": 1,
  "status": "accepted",
  "pickupTime": "2026-10-08T12:30"
  // ... Order 필드 전체 (바뀐 status 반영됨)
}
```
> 💡 `PATCH`를 쓰는 이유: `status` 필드 하나만 바꾸는 거라서, 주문 전체를 다시 보내는 `PUT`이나 `POST`보다 `PATCH`(부분 수정)가 더 정확한 표현입니다.

**에러 응답**

| 상황 | 상태 코드 | 예시 |
|---|---|---|
| 토큰 없음 | `401` | `{ "error": "Authentication required" }` |
| 내 가게의 주문이 아님 | `403` | `{ "error": "Forbidden" }` |
| 해당 `id`의 주문이 없음 | `404` | `{ "error": "Order not found" }` |
| 허용 안 되는 `status` 값 (예: `pending`으로 되돌리기 시도) | `400` | `{ "error": "Cannot change status to pending" }` |
| 지금 상태에서 갈 수 없는 상태로 변경 (예: `pending → done`, `accepted → rejected`) | `409` | `{ "error": "Cannot change status from pending to done" }` |
| 이미 `done`/`rejected`된 주문을 또 바꾸려는 시도 | `409` | `{ "error": "Order status cannot be changed anymore" }` |

---

## 3. 엔드포인트 한눈에 보기

| 기능 | 메서드 | 주소 | 사용하는 화면 |
|---|---|---|---|
| 가게 목록 조회 | `GET` | `/api/stores` | Home |
| 간판 인식 | `POST` | `/api/stores/recognize` | Camera |
| 동네 추천 목록 | `GET` | `/api/stores/recommendations` | Recommendation |
| 가게 상세 조회 | `GET` | `/api/stores/:id` | StoreDetail |
| 주문/예약 생성 | `POST` | `/api/orders` | Order (고객) |
| 주문 상태 조회 | `GET` | `/api/orders/:id` | Order (고객) |
| 가게별 주문 목록 조회 | `GET` | `/api/stores/:id/orders` | OwnerHome |
| 주문 상태 변경 | `PATCH` | `/api/orders/:id/status` | OwnerOrderManage |

---

## 4. 아직 협의가 필요한 부분

- ✅ `openStatus`(영업중/영업종료)는 **백엔드가 계산**해서 내려줍니다. 프론트는 받은 값을 그대로 표시만 하면 됩니다.
- ✅ `totalPrice`는 **백엔드가 메뉴 가격 기준으로 계산**합니다. 프론트는 주문 생성 요청에 `totalPrice`를 아예 넣지 않습니다 (넣어도 서버가 무시하고 자체 계산한 값으로 응답).

**아직 협의 필요**
- [ ] 간판 인식 실패 시 응답 형식이 이대로 괜찮은지
- [ ] 거절 이유(`rejectionReason`) 필드를 나중에 어떤 형태로 추가할지 (예: `PATCH /orders/:id/status` 요청에 선택 항목으로 추가)

---

## 5. 참고 — 프론트에서 이런 식으로 요청을 보낼 예정입니다

```javascript
// 가게 상세 조회 예시
const storeRes = await fetch(`/api/stores/${storeId}`);
const store = await storeRes.json();
if (!storeRes.ok) throw new Error(store.error); // 404 등 에러면 { error: ... }가 옴

// 주문 생성 예시 (로그인 토큰 필요)
const orderRes = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    storeId: 1,
    items: [{ menuId: 101, quantity: 2 }],
    pickupTime: '2026-10-08T12:30',
    customerPhone: '010-0000-0000',
  }),
});
const order = await orderRes.json();
if (!orderRes.ok) throw new Error(order.error);
```
