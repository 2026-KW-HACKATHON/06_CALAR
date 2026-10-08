import { useEffect, useRef, useState } from 'react';
import BigButton from '../common/BigButton';
import Icon from '../common/Icon';
import Spinner from '../common/Spinner';
import { MessageBox } from '../common/StateBox';
import { resizeImage } from '../../utils/imageResize';
import { getStoreDetail, recognizeSignboard } from '../../services/storeService';
import StoreCard from '../store/StoreCard';
import useDiscoveryLocation from '../../hooks/useDiscoveryLocation';
import { getDistanceKm, formatDistance } from '../../utils/distance';

// 참고: getUserMedia(브라우저 카메라 스트림)는 https 나 localhost 에서만 동작합니다.
// 데모 때 휴대폰으로 http://192.168.x.x:5173 에 접속하면 카메라가 안 열리므로,
// <input type="file" capture="environment"> 로 폰 기본 카메라 앱을 바로 여는 방식을 씁니다.
// (아이폰 HEIC 사진도 resizeImage 에서 JPEG 로 자동 변환됩니다.)

const FAIL = {
  nomatch: { icon: 'image_not_supported', title: '가게를 인식하지 못했어요', body: '수동 검색을 이용해주세요.' },
  error: { icon: 'wifi_off', title: '사진 인식 중 오류가 발생했어요', body: '다시 시도해주세요.' },
};

// 사진 촬영 버튼: 파일 선택 input 을 감싼 label 이라서 누르면 바로 폰 카메라가 열립니다.
const PhotoButton = ({ onPick, variant = 'primary', large = false, children }) => (
  <label className={`btn btn--${variant}${large ? ' btn--lg' : ''}`}>
    <input
      type="file"
      accept="image/*"
      capture="environment"
      className="visually-hidden"
      onChange={onPick}
    />
    <Icon name="photo_camera" />
    {children}
  </label>
);

// 촬영 예시 사진 자리. public/images/sign-example.jpg 를 넣으면 자동으로 그 사진이 보이고,
// 파일이 없으면 회색 자리 표시가 보입니다.
const ExamplePhoto = () => {
  const [ok, setOk] = useState(true);

  return (
    <div className="photo-example">
      {ok ? (
        <img src={`${import.meta.env.BASE_URL}examples/sign.png`} alt="간판 글씨가 잘 보이게 찍은 사진 예시" onError={() => setOk(false)} />
      ) : (
        <span aria-hidden="true">간판 촬영 예시 사진</span>
      )}
    </div>
  );
};

// props
//  - onRecognized(store) : 인식 성공 시 호출 (가게 상세로 이동)
//  - onSwitchToManual()  : 인식 실패 시 "직접 검색으로 전환" 버튼을 눌렀을 때 호출
const CameraCapture = ({ onRecognized, onSwitchToManual, onSwitchToNumber }) => {
  const [candidates, setCandidates] = useState([]);
  const location = useDiscoveryLocation();
  const [phase, setPhase] = useState('idle'); // idle | loading | nomatch | error
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewRef = useRef(null);

  // 미리보기 주소는 쓰고 나면 반드시 해제 (메모리 누수 방지)
  const replacePreview = (url) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreviewUrl(url);
  };
  useEffect(() => () => previewRef.current && URL.revokeObjectURL(previewRef.current), []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 사진을 다시 골라도 반응하도록 초기화
    if (!file || phase === 'loading') return;
    setCandidates([]);

    replacePreview(URL.createObjectURL(file));
    setPhase('loading');

    try {
      const resized = await resizeImage(file, 1600);
      const result = await recognizeSignboard(resized); // { matched, stores }

      if (result.stores?.length > 0) {
        const details = await Promise.all(result.stores.slice(0, 3).map((store) => getStoreDetail(store.id)));
        setCandidates(details); setPhase('candidates');
      } else {
        setPhase('nomatch');
      }
    } catch (err) {
      setPhase('error');
    }
  };

  if (phase === 'candidates') return <div className="stack"><h2 className="section-title">이 가게가 맞나요?</h2><p>간판 인식 결과를 확인하고 맞는 가게를 눌러 주세요.</p>
    <ul className="store-list">{candidates.map((store) => {
      const km = getDistanceKm(location, store.location);
      return <li key={store.id}><StoreCard store={store} distanceText={km === null ? '거리 확인 전' : formatDistance(km)} onClick={onRecognized} /></li>;
    })}</ul><PhotoButton onPick={handleFile}>다시 찍기</PhotoButton><BigButton variant="secondary" onClick={onSwitchToManual}>가게 탭에서 검색</BigButton><BigButton variant="secondary" onClick={onSwitchToNumber}>가게 번호 입력</BigButton></div>;

  if (phase === 'loading') {
    return (
      <>
        <div className="photo-preview">
          {previewUrl && <img src={previewUrl} alt="방금 찍은 간판 사진" />}
          <div className="photo-preview__overlay" aria-hidden="true">
            <Spinner large />
          </div>
        </div>
        <div role="status" className="progress-text">
          <p className="progress-text__title">인식하는 중이에요...</p>
          <p className="progress-text__body">화면을 끄지 말고 잠시만 기다려 주세요.</p>
        </div>
      </>
    );
  }

  if (phase === 'nomatch' || phase === 'error') {
    const fail = FAIL[phase];
    const isNoMatch = phase === 'nomatch';

    return (
      <>
        <MessageBox tone="error" icon={fail.icon} title={fail.title} body={fail.body} />
        {(
          <>
            <div className="tip-box">
              <Icon name="lightbulb" />
              간판에 적힌 가게 이름으로 찾아볼 수 있어요.
            </div>
            <BigButton size="lg" icon="search" onClick={onSwitchToManual}>
              가게 탭에서 검색
            </BigButton>
          </>
        )}
        <PhotoButton onPick={handleFile} variant={isNoMatch ? 'secondary' : 'primary'}>
          다시 찍기
        </PhotoButton>
        <BigButton variant="secondary" onClick={onSwitchToNumber}>가게 번호 입력</BigButton>
      </>
    );
  }

  return (
    <>
      <div className="stack">
        <h2 className="lead">
          가게 간판을
          <br />
          사진으로 찍어주세요
        </h2>
        <p className="lead-sub">어떤 가게인지 찾아드릴게요.</p>
      </div>
      <ExamplePhoto />
      <ol className="tips">
        <li>
          <span className="tips__num">1</span>간판 글씨가 다 보이게
        </li>
        <li>
          <span className="tips__num">2</span>정면에서, 흔들리지 않게
        </li>
      </ol>
      <PhotoButton onPick={handleFile} large>
        사진 찍기
      </PhotoButton>
    </>
  );
};

export default CameraCapture;
