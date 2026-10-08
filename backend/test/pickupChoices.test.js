const test = require('node:test');
const assert = require('node:assert/strict');
test('unavailable today is disabled and the first available day is tomorrow or later', async () => {
  const { pickupAvailableDays } = await import('../../frontend/src/utils/pickupChoices.js');
  const closed = pickupAvailableDays(Date.parse('2026-10-08T21:00:00+09:00'), '11:00-21:00');
  assert.equal(closed[0].disabled, true);
  assert.equal(closed.find(day => !day.disabled).label, '내일');
  const lead = pickupAvailableDays(Date.parse('2026-10-08T20:30:00+09:00'), '11:00-21:00', 60);
  assert.equal(lead[0].disabled, true);
  assert.equal(lead[1].disabled, false);
  const later = pickupAvailableDays(Date.parse('2026-10-08T12:00:00+09:00'), '11:00-21:00', 2880);
  assert.equal(later.find(day => !day.disabled).label, '모레');
  const open = pickupAvailableDays(Date.parse('2026-10-08T12:00:00+09:00'), '11:00-21:00');
  assert.equal(open[0].disabled, false);
});

test('pickup wheels use KST, five-minute choices, business hours and the 30-day limit', async () => {
  const { pickupDays, pickupTimes } = await import('../../frontend/src/utils/pickupChoices.js');
  const now = Date.parse('2026-10-08T03:00:30Z');
  const days = pickupDays(now);
  assert.deepEqual(days.slice(0, 3).map(item => item.label), ['오늘', '내일', '모레']);
  const times = pickupTimes(days[0].value, '11:00-21:00', now);
  assert.deepEqual(times.slice(0, 3).map(item => item.label), ['5분 뒤', '10분 뒤', '15분 뒤']);
  assert.equal(times[0].value, '2026-10-08T12:05');
  const delayed = pickupTimes(days[0].value, '11:00-21:00', now, 30);
  assert.equal(delayed[0].value, '2026-10-08T12:35');
  assert.ok(delayed.every(choice => Date.parse(choice.value + '+09:00') >= now + 30 * 60000));
  assert.equal(pickupTimes(days[0].value, '00:00-24:00', now, 1440).length, 0);
  assert.equal(times.at(-1).value, '2026-10-08T20:55');
  const tomorrow = pickupTimes(days[1].value, '11:00-21:00', now);
  assert.equal(tomorrow[0].value, '2026-10-09T11:00');
  assert.equal(tomorrow[0].label, '11:00');
  for (const choice of pickupTimes(days[30].value, '00:00-24:00', now)) {
    assert.ok(Date.parse(choice.value + '+09:00') <= now + 30 * 86400000);
  }
  const late = Date.parse('2026-10-08T23:50:00+09:00');
  assert.equal(pickupTimes('2026-10-08', '11:00-21:00', late).length, 0);
  const overnight = pickupTimes('2026-10-09', '18:00-02:00', late);
  assert.equal(overnight[0].value, '2026-10-09T00:00');
  assert.equal(overnight.at(-1).value, '2026-10-09T23:55');
  assert.equal(pickupDays(Date.parse('2026-10-08T16:00:00Z'))[0].value, '2026-10-09');
});
