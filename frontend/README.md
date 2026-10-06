# 월계-frontend (wolgye-frontend)

고령층 및 디지털 취약계층도 쉽게 동네 가게를 찾고, 주문/예약하고, 오늘의 동네 추천을 받을 수 있도록 돕는 프론트엔드 프로젝트입니다.
**고객용 화면**과 **점주용 화면**을 폴더 단위로 분리했습니다.

## 폴더 구조

```
wolgye-frontend/
├── public/
│   ├── icons/                  # 직관적 아이콘
│   └── images/
├── src/
│   ├── assets/                 # 이미지/폰트 등 코드에서 import하는 정적 리소스
│   ├── components/
│   │   ├── common/             # 공통 컴포넌트 (큰 글씨 버튼, 헤더, 전화 연결 버튼)
│   │   ├── camera/             # 간판 촬영/QR/수동 인식 UI
│   │   ├── store/               # 가게 정보, 메뉴, 대표상품, 쿠폰
│   │   ├── order/               # [고객용] 주문/예약 신청 + 상태 표시
│   │   ├── owner/               # [점주용] 요청 카드, 수락/거절 UI
│   │   └── recommendation/     # 오늘의 동네 추천 카드/이유
│   ├── pages/
│   │   ├── customer/            # 고객이 보는 화면
│   │   │   ├── Home.jsx
│   │   │   ├── Camera.jsx
│   │   │   ├── StoreDetail.jsx
│   │   │   ├── Order.jsx
│   │   │   └── Recommendation.jsx
│   │   └── owner/                # 점주가 보는 화면
│   │       ├── OwnerHome.jsx           # 들어온 요청 목록
│   │       └── OwnerOrderManage.jsx    # 개별 요청 수락/거절
│   ├── services/                 # API 통신 (api.js, storeService.js, orderService.js)
│   ├── hooks/                    # useGeolocation, useCamera
│   ├── utils/                    # phoneFormatter, businessHours
│   ├── constants/                # routes.js (라우트 경로 상수)
│   ├── styles/                   # global.css, variables.css
│   ├── App.jsx
│   └── main.jsx
├── .gitignore
├── package.json
└── README.md
```

## 구조에 대한 간단한 설명
- **고객/점주 분리**: `components`와 `pages` 안에서 점주 전용 기능(`owner/`)을 고객 기능과 분리해뒀습니다. 라우팅도 `/owner`로 시작하도록 구분할 예정이라, 나중에 점주 화면만 따로 떼서 별도 배포하기도 쉽습니다.
- 해커톤 규모라 상태관리 라이브러리(Redux 등)나 별도 `layouts/` 폴더는 넣지 않았습니다. 페이지 간 공유 상태가 꼭 필요해지면 `hooks`에 간단한 Context 하나 추가하는 정도로 충분할 거예요.
- 점주 화면에 로그인/인증이 필요한지도 해커톤 범위에 따라 나중에 정하면 됩니다 (일단은 `/owner` 경로 접근 자체로 처리해도 무방).

## 시작하기

```bash
npm install
cp .env.example .env   # 안의 VITE_API_BASE_URL을 실제 백엔드 주소로 수정
npm run dev
```

## 백엔드 API 연동 반영 내역 (2026-10-05)

정민님 이슈(#3) 피드백을 반영해서 백엔드 API 명세에 맞게 아래 내용을 수정했습니다.

- `index.html`, `vite.config.js` 추가 — `npm run dev` 실행 안 되던 문제 해결
- `main.jsx`, `App.jsx` 실제 구현 — 라우팅 연결, 화면 렌더링 확인
- QR 전용 API 제거, QR 코드에는 가게 id만 담아 `getStoreDetail` 재사용
- `storeService.js`에 `getStores`(목록/검색) 추가
- `orderService.js` — 상태 변경에 `done`(완료) 처리 추가, `getOwnerOrderList`에 `status` 필터 인자 추가
- 요청 카드(`ReservationRequestCard`) — `customerName` 대신 `customerPhone` 표시, 메뉴는 가게 `menu` 목록에서 이름 조회
- 추천 카드 — `imageUrl`/`isNew` 필드 제거, 거리는 프론트에서 좌표로 계산(`utils/distance.js`), 추천 이유는 백엔드 `reason` 필드 사용
- `OrderStatus`에서 `updatedAt` 제거 (백엔드에 없는 필드)
- `FeaturedProduct`는 `menu[0]`을 대표 상품으로 사용
- `utils/businessHours.js` 제거 (백엔드가 `openStatus` 계산해서 내려줌)
- 라우트를 `/store/:storeId`, `/store/:storeId/order`, `/owner/:storeId`, `/owner/:storeId/order/:orderId`로 변경
- 사진 업로드 전 리사이징 유틸(`utils/imageResize.js`) 추가 — 1600px, JPEG 변환 (HEIC도 자동 변환됨)
- 카메라는 `getUserMedia` 대신 `<input type="file" capture="environment">` 방식 사용 (휴대폰에서 http로 테스트 시 카메라 접근 제한 회피)

> ⚠️ 지금 만든 컴포넌트/페이지들은 **기능 연결(와이어링)까지만** 되어 있고, 디자인(글씨 크기, 색상, 레이아웃)은 전혀 입혀지지 않은 상태입니다. `styles/global.css`, `styles/variables.css`에 고령층 배려 스타일을 입히는 작업이 다음 단계로 남아있습니다.

> `package.json`은 React + Vite 기준이며, `react-router-dom`, `axios`가 추가되어 있습니다.

---

## TODO 리스트

### 0. 프로젝트 세팅
- [x] `react-router-dom` 추가 (페이지 라우팅)
- [x] `axios` 추가 (API 통신)
- [ ] QR 인식 라이브러리 선정 및 추가 (예: `jsQR`, `react-qr-reader`) — `QRScanner.jsx`는 코드 입력 방식으로 임시 연결만 해둠
- [x] `.env` 파일 생성 (API Base URL 등)

### 1. 공통 컴포넌트 (components/common)
- [x] `BigButton.jsx`
- [x] `Header.jsx`
- [x] `CallButton.jsx`

### 2. 간판 촬영/인식 (components/camera, pages/customer/Camera.jsx)
- [x] `useCamera.js` 훅
- [x] `CameraCapture.jsx`
- [x] `QRScanner.jsx`
- [x] `ManualInput.jsx`
- [x] `Camera.jsx` 페이지 조합 및 인식 결과 라우팅

### 3. 가게 정보 (components/store, pages/customer/StoreDetail.jsx)
- [x] `StoreInfo.jsx`
- [x] `MenuList.jsx`
- [x] `FeaturedProduct.jsx`
- [x] `CouponCard.jsx`
- [x] `StoreDetail.jsx` 페이지에서 `storeService.js` 연동

### 4. 고객 주문/예약 (components/order, pages/customer/Order.jsx)
- [x] `OrderForm.jsx`
- [x] `OrderStatus.jsx`
- [x] `Order.jsx` 페이지에서 `orderService.js` 연동

### 5. 점주 화면 (components/owner, pages/owner)
- [x] `ReservationRequestCard.jsx` (요청 카드 + 수락/거절 버튼)
- [x] `OwnerHome.jsx` (요청 목록 조회)
- [x] `OwnerOrderManage.jsx` (개별 요청 상세/처리)
- [x] `orderService.js`의 점주용 함수(`getOwnerOrderList`, `respondToOrder`) 연동

### 6. 오늘의 동네 추천 (components/recommendation, pages/customer/Recommendation.jsx)
- [x] `RecommendationCard.jsx`
- [x] `RecommendationReason.jsx`
- [x] `Recommendation.jsx` 페이지에서 데이터 fetch 및 렌더링

### 7. API 통신 (services)
- [x] `api.js` Axios 인스턴스 설정
- [x] `storeService.js` 함수 구현
- [x] `orderService.js` 함수 구현 (고객용 + 점주용)

### 8. 커스텀 훅 & 유틸 & 상수
- [x] `useGeolocation.js`
- [x] `useCamera.js`
- [x] `phoneFormatter.js`
- [x] `constants/routes.js`에 라우트 경로 채우기

### 9. 스타일
- [ ] `variables.css` 색상/폰트 변수
- [ ] `global.css` 큰 글씨/고대비 전역 스타일

### 10. 라우팅 & 진입점
- [x] `App.jsx`에 고객용/점주용 라우트 모두 정의
- [x] `main.jsx`에서 앱 렌더링

### 11. 시간 남으면 해볼 것 (선택)
- [ ] 점주 화면 접근 제한 (간단한 비밀번호/코드 정도)
- [ ] 반응형 대응 (모바일 우선)
- [ ] 로딩/에러 상태 UI
