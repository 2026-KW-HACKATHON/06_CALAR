import { useState } from 'react';
import { getStoreDetail } from '../../services/storeService';

// QR 코드 안에는 가게 id만 들어있다고 백엔드와 합의했습니다.
// (예: QR을 찍으면 "12" 같은 숫자 문자열이 나옴 -> 그 id로 가게 상세 조회)
//
// TODO: 실제 카메라로 QR을 스캔하는 부분은 QR 인식 라이브러리(jsQR 등) 연동이 필요합니다.
// 지금은 "QR에서 읽은 코드"를 직접 입력하는 방식으로 뼈대만 만들어뒀습니다.
// 라이브러리 설치 후, handleDecoded(decodedText)를 스캔 콜백 안에서 호출하면 됩니다.
const QRScanner = ({ onRecognized }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);

  const handleDecoded = async (decodedText) => {
    const storeId = Number(decodedText);
    if (!storeId) {
      setError('올바른 가게 코드가 아니에요.');
      return;
    }

    try {
      const store = await getStoreDetail(storeId);
      onRecognized(store);
    } catch (err) {
      setError('가게 정보를 찾을 수 없어요.');
    }
  };

  return (
    <div>
      {/* TODO: 여기에 실제 QR 스캐너 라이브러리 뷰 컴포넌트 삽입 */}
      <p>QR 코드 번호를 입력해보세요 (임시 테스트용)</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} />
      <button onClick={() => handleDecoded(code)}>확인</button>
      {error && <p>{error}</p>}
    </div>
  );
};

export default QRScanner;
