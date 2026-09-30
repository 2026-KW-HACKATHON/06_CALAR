// 서버가 어느 나라에서 돌든 한국 시간(KST, UTC+9) 기준으로 계산하기 위한 함수들
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const HHMM_PATTERN = /^(\d{2}):(\d{2})$/;
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// 현재 한국 시간을 UTC 필드에 담은 Date (getUTC*로 읽으면 한국 시각이 나온다)
function nowKST() {
  return new Date(Date.now() + KST_OFFSET_MS);
}

// 현재 한국 시간을 자정부터 지난 분으로 반환
function nowMinutesKST() {
  const kst = nowKST();
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

// "HH:MM" -> 분. 형식이 틀리거나 없는 시각이면 null ("24:00"은 영업 종료 시각용으로 허용)
function toMinutes(hhmm) {
  const match = HHMM_PATTERN.exec(hhmm);
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (m > 59 || h > 24 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

// 현재 한국 시간을 "YYYY-MM-DDTHH:mm" 형식으로 반환 (Order.createdAt 용)
function nowKSTString() {
  return nowKST().toISOString().slice(0, 16);
}

// "YYYY-MM-DDTHH:mm"(한국 시간)을 검사해서 { minutesOfDay, epochMs } 반환. 없는 날짜·시각이면 null
// 예: "2026-02-30T12:00", "2026-13-01T12:00", "2026-10-08T24:00" → null
function parseLocalDateTime(text) {
  const match = typeof text === 'string' && LOCAL_DATETIME_PATTERN.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;

  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null; // 2월 30일처럼 다음 달로 넘어간 경우
  }
  return { minutesOfDay: hour * 60 + minute, epochMs: utc.getTime() - KST_OFFSET_MS };
}

// "YYYY-MM-DD" 날짜가 오늘(한국 기준)로부터 며칠 전인지. 형식이 틀리면 NaN
function daysSince(dateString) {
  const today = new Date(nowKST().toISOString().slice(0, 10));
  return Math.floor((today - new Date(dateString)) / DAY_MS);
}

module.exports = {
  DAY_MS,
  nowMinutesKST,
  toMinutes,
  nowKSTString,
  parseLocalDateTime,
  daysSince,
};
