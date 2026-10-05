import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import CameraCapture from '../../components/camera/CameraCapture';
import QRScanner from '../../components/camera/QRScanner';
import ManualInput from '../../components/camera/ManualInput';
import { ROUTES } from '../../constants/routes';

const TABS = ['camera', 'qr', 'manual'];

const Camera = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('camera');

  const handleRecognized = (store) => {
    navigate(ROUTES.storeDetail(store.id));
  };

  return (
    <div>
      <Header title="간판 촬영/검색" showBackButton />

      <div>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            {t === 'camera' ? '카메라' : t === 'qr' ? 'QR' : '직접 검색'}
          </button>
        ))}
      </div>

      {tab === 'camera' && <CameraCapture onRecognized={handleRecognized} />}
      {tab === 'qr' && <QRScanner onRecognized={handleRecognized} />}
      {tab === 'manual' && <ManualInput onSelect={handleRecognized} />}
    </div>
  );
};

export default Camera;
