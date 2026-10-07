import { useEffect, useState } from 'react';

// 사용자 현재 위치 정보 취득 훅
const useGeolocation = () => {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저는 위치 정보를 지원하지 않습니다.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      () => {
        setError('위치 정보 접근 권한이 필요합니다.');
        setLoading(false);
      }
    );
  }, []);

  return { ...location, error, loading };
};

export default useGeolocation;
