import { useState } from 'react';
import { resizeImage } from '../../utils/imageResize';
import { recognizeSignboard } from '../../services/storeService';

// 참고: getUserMedia(브라우저 카메라 스트림)는 https나 localhost에서만 동작합니다.
// 데모 때 휴대폰으로 http://192.168.x.x:5173 접속하면 카메라가 안 열리므로,
// <input type="file" capture="environment">로 폰 기본 카메라 앱을 바로 여는 방식을 씁니다.
// (아이폰 HEIC 사진도 resizeImage에서 JPEG로 자동 변환됩니다.)
const CameraCapture = ({ onRecognized }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const resized = await resizeImage(file, 1600);
      const result = await recognizeSignboard(resized); // { matched, stores }

      if (result.matched && result.stores.length > 0) {
        onRecognized(result.stores[0]); // 가장 매칭도 높은 가게로 이동
      } else {
        setError('가게를 인식하지 못했어요. 수동 검색을 이용해주세요.');
      }
    } catch (err) {
      setError('사진 인식 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label>
        간판 촬영하기
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />
      </label>
      {loading && <p>인식하는 중이에요...</p>}
      {error && <p>{error}</p>}
    </div>
  );
};

export default CameraCapture;
