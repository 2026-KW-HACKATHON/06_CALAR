import { useCallback, useEffect, useRef, useState } from 'react';

// 사용자 현재 위치 정보 취득 훅
const useGeolocation = ({ enabled = true } = {}) => {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const generation = useRef(0);
  const reset = useCallback(() => { generation.current += 1; setLocation({ latitude: null, longitude: null }); setLoading(false); setError(null); }, []);

  const request = useCallback(() => {
    const requestGeneration = ++generation.current;
    setLoading(true); setError(null);
    if (!navigator.geolocation) {
      setError('이 브라우저는 위치 정보를 지원하지 않습니다.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (generation.current !== requestGeneration) return;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      () => {
        if (generation.current !== requestGeneration) return;
        setError('위치 정보 접근 권한이 필요합니다.');
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);
  useEffect(() => { if (enabled) request(); }, [enabled, request]);

  return { ...location, error, loading, request, reset };
};

export default useGeolocation;
