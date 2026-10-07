# CALAR 모바일 앱

Capacitor 기반 Android/iOS 앱입니다. `../frontend/src`를 공유하므로 고객·점주 화면, 주문, 별점, 크레딧, 90일 로그인 기능이 웹과 함께 업데이트됩니다. 백엔드는 앱에 포함되지 않으며 별도 서버에 연결합니다.

## Android 개발 실행

1. Node 22 이상, Android Studio 2025.2.1 이상과 Android SDK를 설치합니다.
2. `mobileapp`에서 `npm install`을 실행합니다.
3. `.env.example`을 `.env`로 복사합니다. 에뮬레이터는 `http://10.0.2.2:8008`, 실제 휴대폰은 PC의 LAN IP 또는 HTTPS 서버 주소를 지정합니다. 휴대폰에서 localhost는 휴대폰 자신입니다.
4. 기존 `backend` 서버를 실행하고 `npm run android`로 Android Studio를 엽니다.
5. 에뮬레이터 또는 USB 연결 기기를 선택해 Run을 누릅니다. APK는 Android Studio의 Build 메뉴 또는 `android/gradlew.bat assembleDebug`로 생성합니다.

`npm run dev`는 5174 포트에서 브라우저 미리보기를 제공합니다. 브라우저 미리보기에서 네이티브 권한과 앱 복귀 동작을 확인할 수는 없습니다.

## 배포 및 iOS

운영 `.env`의 `VITE_API_BASE_URL`에 HTTPS API 주소를 설정하고 `npm run sync`를 실행하세요. 운영 빌드는 HTTP 주소를 거부합니다. 개발 HTTP 통신은 Android debug에서만 허용됩니다.
iOS는 macOS와 Xcode, Apple 서명 설정이 필요합니다. HTTPS 서버를 설정하고 `npm run ios` 후 Xcode에서 기기를 선택해 실행합니다. Swift Package Manager 프로젝트가 포함돼 있습니다.
앱 ID는 `kr.calar.app`입니다. 스토어 배포용 서명 키·프로비저닝은 별도로 설정해야 합니다.

## 기능과 결제

- 고객 홈/내 정보 하단 메뉴, 전화번호 인증과 세션, 주문 내역/평점, 크레딧, 점주 기능은 기존 API를 사용합니다.
- 위치는 네이티브 위치 권한을 요청합니다. 간판 사진은 기존 카메라/사진 선택 입력을 사용합니다.
- Android 뒤로가기는 화면을 이동하며 시작 화면에서는 앱을 최소화합니다.
- 카카오페이는 시스템 브라우저에서 열고 서버의 `/mobile/payment-result`를 통해 `calar://payment-result`로 앱에 복귀합니다. 복귀 후 기존 앱 세션으로 승인합니다. 서버 `CALAR_PUBLIC_URL`은 외부에서 접근 가능한 HTTPS 서버 주소여야 하며 카카오페이에 도메인을 등록해야 합니다.
- 실제 결제는 운영 CID/Secret Key가 필요합니다. 실기기 결제·촬영·위치 동작은 배포 전에 확인해야 합니다. 현재 QR 화면은 기존 웹과 동일한 번호 입력 방식입니다.

로그인 정보는 앱 WebView 저장소에 유지됩니다. 앱 데이터 삭제·재설치·로그아웃·세션 만료 시 재인증합니다.

공식 환경 요구사항: https://capacitorjs.com/docs/getting-started/environment-setup
