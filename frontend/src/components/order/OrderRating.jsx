import { useState } from 'react';
import BigButton from '../common/BigButton';
import api from '../../services/api';

export default function OrderRating({ orderId, initialRating, onRated }) {
  const [rating, setRating] = useState(initialRating);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); if (!score || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/api/orders/${orderId}/rating`, { score });
      setRating(data.score); onRated?.();
    } catch (err) { setError(err.response?.status === 409 ? '이미 평가했거나 아직 완료되지 않은 주문이에요. 주문 내역을 새로고침해 주세요.' : '평점을 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  if (rating) return <p>내가 남긴 평점: <span aria-label={`${rating}점`}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span> ({rating}점)</p>;
  return <form className="stack card" onSubmit={submit}>
    <h3>이용은 어떠셨나요?</h3><p>완료한 주문에 한 번 평점을 남길 수 있어요.</p>
    <div role="group" aria-label="별점 선택" style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value}점`} aria-pressed={score === value} disabled={busy} onClick={() => setScore(value)} style={{ fontSize: 32, color: value <= score ? '#b77900' : '#667085', padding: 8 }}>{value <= score ? '★' : '☆'}</button>)}
    </div><p>{score ? `${score}점 선택` : '별점을 선택해 주세요.'}</p>
    <BigButton type="submit" disabled={!score || busy} loading={busy}>평점 남기기</BigButton>
    {error && <p role="alert">{error}</p>}
  </form>;
}
