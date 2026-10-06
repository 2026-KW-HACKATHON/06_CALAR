// 사진 업로드 전 리사이징 (긴 변 기준 maxSize, JPEG로 변환)
// 백엔드 업로드 제한(10MB) 대응 + 인식 속도 개선 + HEIC(아이폰) 사진도 JPEG로 자동 변환됨
export const resizeImage = (fileOrBlob, maxSize = 1600, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      let { width, height } = img;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error('이미지 변환에 실패했습니다.'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };

    img.src = objectUrl;
  });
};
