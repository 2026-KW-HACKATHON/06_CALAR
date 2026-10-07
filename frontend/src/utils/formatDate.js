// 날짜/시간/금액 표시용 변환 함수
// 백엔드의 pickupTime, createdAt 은 "YYYY-MM-DDTHH:mm" (한국 시간, 시간대 표시 없음) 형식입니다.
// → 시간대 변환을 하지 않고 적힌 숫자 그대로 읽습니다.

const pad = (n) => String(n).padStart(2, '0');

export const parseLocal = (value) => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// 15:30 -> "오후 3:30"
export const formatClock = (date) => {
  const h = date.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오전' : '오후'} ${h12}:${pad(date.getMinutes())}`;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// 오늘이면 0, 내일이면 1 ...
export const dayDiff = (date, now = new Date()) =>
  Math.round((startOfDay(date) - startOfDay(now)) / 86400000);

const dayLabel = (date, now) => {
  const diff = dayDiff(date, now);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

// 픽업/예약 시간 -> "오늘 오후 3:30" / "내일 오전 10:00" / "10월 8일 오후 12:30"
export const formatPickup = (value, now = new Date()) => {
  const d = parseLocal(value);
  if (!d) return value || '';
  return `${dayLabel(d, now)} ${formatClock(d)}`;
};

// 신청 시각 -> 오늘이면 "오후 2:52", 아니면 "10월 6일 오후 2:52"
// withDate=true 면 오늘이어도 날짜를 붙입니다. (예: "10월 6일 오후 3:02")
export const formatCreated = (value, { withDate = false, now = new Date() } = {}) => {
  const d = parseLocal(value);
  if (!d) return value || '';
  if (!withDate && dayDiff(d, now) === 0) return formatClock(d);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${formatClock(d)}`;
};

// 금액 -> "13,000원"
export const formatWon = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
