import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import CameraCapture from '../../components/camera/CameraCapture';
import QRScanner from '../../components/camera/QRScanner';
import ManualInput from '../../components/camera/ManualInput';
import { ROUTES } from '../../constants/routes';

const TABS = [
  ['camera', '카메라', 'photo_camera'],
  ['qr', 'QR', 'qr_code_scanner'],
  ['manual', '직접 검색', 'search'],
];

const Camera = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Home 의 "가게 이름으로 찾기" 버튼에서 넘어오면 처음부터 직접 검색 탭을 엽니다.
  const requestedTab = location.state?.tab;
  const [tab, setTab] = useState(TABS.some(([key]) => key === requestedTab) ? requestedTab : 'camera');

  const handleRecognized = (store) => {
    navigate(ROUTES.storeDetail(store.id));
  };

  return (
    <div className="screen">
      <Header title="간판 촬영/검색" showBackButton />

      <div className="tabs-wrap">
        <div role="tablist" aria-label="가게 찾는 방법" className="tabs">
          {TABS.map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`camera-tab-${key}`}
              aria-selected={tab === key}
              aria-controls="camera-panel"
              className="tab"
              onClick={() => setTab(key)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <main
        id="camera-panel"
        role="tabpanel"
        aria-labelledby={`camera-tab-${tab}`}
        className="screen__body screen__body--tight"
      >
        {tab === 'camera' && (
          <CameraCapture onRecognized={handleRecognized} onSwitchToManual={() => setTab('manual')} />
        )}
        {tab === 'qr' && <QRScanner onRecognized={handleRecognized} />}
        {tab === 'manual' && <ManualInput onSelect={handleRecognized} />}
      </main>
    </div>
  );
};

export default Camera;
