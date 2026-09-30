// 서버가 어느 나라에서 돌든 한국 시간(KST, UTC+9) 기준으로 계산하기 위한 함수들
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 현재 한국 시간을 UTC 필드에 담은 Date (getUTC*로 읽으면 한국 시각이 나온다)
function nowKST() {
  return new Date(Date.now() + KST_OFFSET_MS);
}

// 현재 한국 시간을 자정부터 지난 분으로 반환
function nowMinutesKST() {
  const kst = nowKST();
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

// "HH:MM" -> 분
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 현재 한국 시간을 "YYYY-MM-DDTHH:mm" 형식으로 반환 (Order.createdAt 용)
function nowKSTString() {
  return nowKST().toISOString().slice(0, 16);
}

// "YYYY-MM-DD" 날짜가 오늘(한국 기준)로부터 며칠 전인지
function daysSince(dateString) {
  const today = new Date(nowKST().toISOString().slice(0, 10));
  return Math.floor((today - new Date(dateString)) / (24 * 60 * 60 * 1000));
}

module.exports = { nowMinutesKST, toMinutes, nowKSTString, daysSince };
