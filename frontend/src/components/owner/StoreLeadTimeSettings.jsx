import { useEffect, useState } from 'react';
import BigButton from '../common/BigButton';
import api from '../../services/api';

export default function StoreLeadTimeSettings({ store, onSaved }) {
  const [minutes, setMinutes] = useState(String(store.minOrderMinutes ?? 0));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setMinutes(String(store.minOrderMinutes ?? 0)); }, [store.minOrderMinutes]);
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await api.patch(`/api/owner/stores/${store.id}`, { minOrderMinutes: Number(minutes) });
      setMessage('최소 준비 시간을 저장했어요. 새 주문·예약부터 적용돼요.');
      onSaved();
    } catch { setError('저장하지 못했어요. 입력값과 연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  return <details className="menu-editor" style={{ margin: '16px 0' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 18 }}>주문·예약 준비 시간 설정 · {store.minOrderMinutes ?? 0}분</summary>
    <form className="stack owner-login" onSubmit={save} style={{ marginTop: 16 }}>
      <label className="stack">최소 준비 시간 (분)
        <input type="number" inputMode="numeric" min="0" max="43200" step="1" required disabled={busy} value={minutes} onChange={event => setMinutes(event.target.value)} />
      </label>
      <p>30분으로 설정하면 지금부터 30분 이후에만 방문할 수 있어요. 0분은 제한 없음이에요.</p>
      <BigButton type="submit" loading={busy} size="sm">준비 시간 저장</BigButton>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="owner-login__error">{error}</p>}
    </form>
  </details>;
}
