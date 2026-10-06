import { useState } from 'react';
import BigButton from '../common/BigButton';
import Icon from '../common/Icon';
import { getStoreDetail } from '../../services/storeService';

// QR 코드 안에는 가게 id 만 들어있다고 백엔드와 합의했습니다.
// (QR 을 찍으면 "12" 같은 숫자 문자열이 나옴 -> 그 id 로 가게 상세 조회)
//
// TODO: 실제 카메라로 QR 을 스캔하는 부분은 QR 인식 라이브러리(jsQR 등) 연동이 필요합니다.
// 지금은 "QR 아래 가게 번호"를 직접 입력하는 방식으로 뼈대만 만들어뒀습니다.
// 라이브러리 설치 후, 스캔 콜백 안에서 handleDecoded(decodedText) 를 호출하고
// 아래 <div className="qr-box"> 자리를 스캐너 화면으로 교체하면 됩니다.
const QRScanner = ({ onRecognized }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDecoded = async (decodedText) => {
    const storeId = Number(decodedText);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      setError('올바른 가게 코드가 아니에요.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const store = await getStoreDetail(storeId);
      onRecognized(store);
    } catch (err) {
      setError('가게 정보를 찾을 수 없어요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleDecoded(code.trim());
  };

  return (
    <>
      <h2 className="lead">
        가게에 붙은
        <br />
        QR 코드를 비춰주세요
      </h2>

      {/* TODO: 여기에 실제 QR 스캐너 화면 삽입 */}
      <div className="qr-box">
        QR 스캐너 화면
        <br />
        (jsQR 등 라이브러리 연동 후)
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">또는 QR 아래 가게 번호 입력</span>
          <input
            inputMode="numeric"
            placeholder="예: 12"
            className={`input${error ? ' input--error' : ''}`}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
          />
        </label>
        {error && (
          <span role="alert" className="field__error">
            <Icon name="error" />
            {error}
          </span>
        )}
        <BigButton type="submit" icon="check" loading={loading} loadingLabel="찾는 중...">
          확인
        </BigButton>
      </form>
    </>
  );
};

export default QRScanner;
