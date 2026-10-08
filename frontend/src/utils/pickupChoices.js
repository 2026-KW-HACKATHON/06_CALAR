const MINUTE = 60000;
const DAY = 86400000;
const kst = time => new Date(time + 9 * 60 * MINUTE);
const dateKey = time => kst(time).toISOString().slice(0, 10);
const timeKey = time => kst(time).toISOString().slice(11, 16);

export function pickupDays(now) {
  return Array.from({ length: 31 }, (_, index) => {
    const time = now + index * DAY;
    const date = kst(time);
    return { value: dateKey(time), label: ['오늘', '내일', '모레'][index] || `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`, sub: `${date.getUTCMonth() + 1}.${date.getUTCDate()} · ${['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]}` };
  });
}
export function pickupAvailableDays(now, openHours, minOrderMinutes = 0) {
  return pickupDays(now).map((day) => ({ ...day, disabled: pickupTimes(day.value, openHours, now, minOrderMinutes).length === 0 }));
}

export function pickupTimes(day, openHours, now, minOrderMinutes = 0) {
  const today = day === dateKey(now);
  const start = today ? Math.floor(now / MINUTE) * MINUTE + 5 * MINUTE : Date.parse(`${day}T00:00:00+09:00`);
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(openHours || '');
  const open = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  const close = match ? (Number(match[3]) * 60 + Number(match[4])) % 1440 : 0;
  const choices = [];
  for (let time = start; dateKey(time) === day && time <= now + 30 * DAY; time += 5 * MINUTE) {
    if (time < now + minOrderMinutes * MINUTE) continue;
    const date = kst(time);
    const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
    const available = !match || open === close || (open < close ? minute >= open && minute < close : minute >= open || minute < close);
    if (!available) continue;
    const offset = Math.round((time - Math.floor(now / MINUTE) * MINUTE) / MINUTE);
    choices.push({ value: `${day}T${timeKey(time)}`, label: today && offset <= 60 ? `${offset}분 뒤` : timeKey(time), sub: today && offset <= 60 ? timeKey(time) : '방문 가능' });
  }
  return choices;
}
