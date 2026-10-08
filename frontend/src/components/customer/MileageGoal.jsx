import { useState } from 'react';
import { readPreference, savePreference } from '../../utils/discoveryPreferences';
export default function MileageGoal() {
  const [goal, setGoal] = useState(() => { const n = readPreference('calar.mileageGoal', 1000); return Number.isSafeInteger(n) && n > 0 ? n : 1000; });
  const [input, setInput] = useState(String(goal)); const [notice, setNotice] = useState('');
  return <section className="mileage-goal stack"><div className="section-head"><h2 className="section-title">나의 마일리지 목표</h2><strong>{goal.toLocaleString()} M</strong></div><div className="mileage-goal__track" aria-label="마일리지 적립 기준 준비 중"><span /></div><p>적립 기준 준비 중 · 적립량은 기준이 정해지면 표시됩니다.</p><details><summary>목표 바꾸기</summary><form className="stack" onSubmit={(event) => { event.preventDefault(); const next = Number(input); if (!Number.isSafeInteger(next) || next < 1 || next > 10000000) { setNotice('1~10,000,000 사이의 정수를 입력해 주세요.'); return; } setGoal(next); setNotice(savePreference('calar.mileageGoal', next) ? '목표를 저장했어요.' : '이번 화면에만 적용했어요. 저장하지 못했어요.'); }}><label>목표 마일리지<input className="input" type="number" min="1" max="10000000" step="1" value={input} onChange={(event) => setInput(event.target.value)} /></label><button className="discovery-action" type="submit">목표 저장</button></form></details>{notice && <p role="status">{notice}</p>}</section>;
}
