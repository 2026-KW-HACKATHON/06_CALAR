import { formatClock, dayDiff } from './formatDate';

const pad = (n) => String(n).padStart(2, '0');

// Date -> "YYYY-MM-DDTHH:mm" (백엔드 pickupTime 형식, 시간대 변환 없이 현재 기기 시각 그대로)
export const toPickupValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

// 백엔드 isOpenAt 과 같은 규칙: "11:00-21:00", 자정 넘김("18:00-02:00"), 24시간("00:00-00:00") 지원
// 형식을 읽을 수 없으면 true(= 막지 않고 서버 검사에 맡김)
export const isOpenAtTime = (openHours, date) => {
  if (typeof openHours !== 'string') return true;
  const parts = openHours.split('-');
  if (parts.length !== 2) return true;
  const open = toMinutes(parts[0]);
  const closeRaw = toMinutes(parts[1]);
  if (open === null || closeRaw === null) return true;

  const close = closeRaw % (24 * 60);
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (open === close) return true;
  return open < close ? minutes >= open && minutes < close : minutes >= open || minutes < close;
};

// 5분 단위로 올림 (예: 14:52 -> 14:55)
const roundUp5 = (date) => {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + ((5 - (d.getMinutes() % 5)) % 5));
  return d;
};

const plusMinutes = (now, minutes) => roundUp5(new Date(now.getTime() + minutes * 60000));

// "30분 뒤 / 1시간 뒤 / 2시간 뒤 / 내일 아침" 4개 선택지를 만든다.
// 영업시간 밖이면 disabled: true (서버가 400 으로 거절하는 시간을 미리 막는다)
export const buildPickupOptions = (openHours, now = new Date()) => {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
  const candidates = [
    ['30분 뒤', plusMinutes(now, 30)],
    ['1시간 뒤', plusMinutes(now, 60)],
    ['2시간 뒤', plusMinutes(now, 120)],
    ['내일 아침', tomorrow],
  ];

  return candidates.map(([label, date]) => {
    const tomorrowPrefix = dayDiff(date, now) === 1 && label !== '내일 아침' ? '내일 ' : '';
    return {
      label,
      sub: `${tomorrowPrefix}${formatClock(date)}`,
      value: toPickupValue(date),
      disabled: !isOpenAtTime(openHours, date),
    };
  });
};

// 직접 고르기 입력칸의 최소/최대값 (지금 ~ 30일 뒤)
export const pickupRange = (now = new Date()) => ({
  min: toPickupValue(now),
  max: toPickupValue(new Date(now.getTime() + 30 * 86400000)),
});

// 서버 오류 메시지(영어)를 어르신이 읽을 수 있는 한국어로
export const toKoreanOrderError = (serverMessage) => {
  const msg = String(serverMessage || '');
  if (msg.includes('outside business hours')) return '그 시간에는 가게가 문을 닫아요. 다른 시간을 골라주세요.';
  if (msg.includes('must not be in the past')) return '지난 시간은 고를 수 없어요. 다른 시간을 골라주세요.';
  if (msg.includes('within') && msg.includes('days')) return '30일 안의 날짜만 고를 수 있어요.';
  if (msg.includes('customerPhone')) return '전화번호를 다시 확인해 주세요.';
  if (msg.includes('does not accept orders')) return '이 가게는 지금 주문을 받지 않아요.';
  return '주문에 실패했어요. 다시 시도해주세요.';
};
