import { useRef, useState } from 'react';

// 카메라 스트림 제어 훅
const useCamera = () => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('카메라 접근 권한이 필요합니다.');
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach((track) => track.stop());
  };

  // 현재 화면을 사진 파일(Blob)로 캡처
  const capturePhoto = () => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  };

  return { videoRef, startCamera, stopCamera, capturePhoto, error };
};

export default useCamera;
