# 카카오페이 크레딧 충전

가맹점 심사 완료 후 운영 CID와 Secret Key(live)를 발급받고, 개발자센터에 서비스 도메인을 등록합니다.
backend/.env에 아래 값을 입력한 뒤 백엔드를 재시작하세요. Secret Key는 Git에 커밋하지 마세요.

```dotenv
KAKAOPAY_MODE=live
KAKAOPAY_CID=발급받은_운영_CID
KAKAOPAY_SECRET_KEY=발급받은_운영_Secret_Key
CALAR_PUBLIC_URL=https://서비스도메인
CALAR_DEV_CREDIT=false
NODE_ENV=production
```

테스트: MODE=test, CID=TC0ONETIME, Secret Key(dev), PUBLIC_URL=http://localhost:5173.
테스트 CID는 실제 결제가 발생하지 않습니다. 운영 모드에서는 개발용 충전을 차단합니다.
운영 서비스는 데모 크레딧이 없는 별도 DB를 사용하세요.

고객 화면 → 내 크레딧 → 금액 입력 → 카카오페이 → 복귀 후 서버 승인 → 크레딧 지급.
결제 금액·거래 ID·회원·주문번호를 검증하며, 중복 승인 요청은 잔액을 중복 증가시키지 않습니다.
승인 응답이 끊기면 카카오페이 주문 조회로 결과를 확인합니다. approving/review 거래는 운영자가 확인해야 합니다.
주문 거절은 크레딧을 돌려줍니다. 원 결제 수단으로 환불하는 기능은 별도 구현이 필요합니다.

공식 문서: https://developers.kakaopay.com/docs/payment/online/single-payment
주문 조회: https://developers.kakaopay.com/docs/payment/online/payment-detail
