// 전화번호 포맷팅 유틸 (예: 01012345678 -> 010-1234-5678)
export const formatPhoneNumber = (rawNumber) => {
  if (!rawNumber) return '';
  const digits = rawNumber.replace(/[^0-9]/g, '');

  if (digits.startsWith('02')) {
    // 서울 지역번호 (02-XXX(X)-XXXX)
    if (digits.length === 9) return digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  // 휴대폰 및 그 외 지역번호 (010-XXXX-XXXX / 031-XXX-XXXX 등)
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

  return rawNumber; // 형식이 안 맞으면 원본 그대로 반환
};
