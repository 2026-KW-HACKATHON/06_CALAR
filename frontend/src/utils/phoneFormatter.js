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

// 입력칸에 쓰는 "타자 치는 중" 자동 하이픈 (예: 0101234 -> 010-1234, 01012345678 -> 010-1234-5678)
export const formatPhoneInput = (raw) => {
  const digits = String(raw || '').replace(/[^0-9]/g, '').slice(0, 11);

  if (digits.startsWith('02')) {
    // 서울 지역번호 (최대 10자리)
    const d = digits.slice(0, 10);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }

  if (digits.startsWith('01')) {
    // 휴대폰: 3-4-4
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  // 그 외 지역번호 (031 등): 3-3(4)-4
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

// 백엔드(PHONE_PATTERN)와 같은 규칙으로 미리 검사: 하이픈 있어도/없어도 됨
export const isValidPhone = (value) => /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(String(value || '').trim());
