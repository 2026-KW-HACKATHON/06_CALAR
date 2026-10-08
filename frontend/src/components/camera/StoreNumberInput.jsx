import { useState } from 'react';
import BigButton from '../common/BigButton';
import { getStoreDetail } from '../../services/storeService';
export default function StoreNumberInput({ onSelect }) {
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !/^[1-9]\d*$/.test(number)) return;
    setBusy(true); setError('');
    try { onSelect(await getStoreDetail(Number(number))); }
    catch (err) { setError(err.response?.status === 404 ? '이 번호의 가게를 찾지 못했어요. 번호를 확인해 주세요.' : '가게를 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  return <form className="stack" onSubmit={submit}><label className="field"><span>가게 번호 입력</span><input className="input" inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="예: 1" /></label><p>가게에 안내된 번호를 입력해 주세요.</p>{error && <p role="alert">{error}</p>}<BigButton type="submit" loading={busy} disabled={!/^[1-9]\d*$/.test(number)}>가게 확인하기</BigButton></form>;
}
