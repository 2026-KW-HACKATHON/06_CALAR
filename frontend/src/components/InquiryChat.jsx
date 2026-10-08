import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { ensureCustomerSession } from '../services/customerSession';
import Icon from './common/Icon';

export default function InquiryChat({ customerId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const log = useRef(null);
  const userId = useRef(null);
  const pending = useRef(null);
  const endpoint = `/api/inquiries/${customerId || 'mine'}`;
  useEffect(() => {
    let active = true;
    let polling = false;
    setReady(false); setError(''); setMessages([]);
    const load = async () => {
      if (polling) return;
      polling = true;
      try {
        if (!userId.current) {
          const user = customerId ? (await api.get('/api/auth/me')).data.user : await ensureCustomerSession();
          userId.current = user.id;
        }
        const { data } = await api.get(endpoint);
        if (active) { setMessages(data); setReady(true); setError(''); }
      } catch { if (active) setError('채팅을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
      finally { polling = false; }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [endpoint, customerId, attempt]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.at(-1)?.id]);
  const send = async event => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy || !ready) return;
    if (pending.current?.body !== body) pending.current = { body, requestId: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const { data } = await api.post(endpoint, pending.current);
      setMessages(data); setDraft(''); pending.current = null;
    } catch { setError('메시지를 보내지 못했어요. 작성한 내용은 남아 있어요. 다시 보내주세요.'); }
    finally { setBusy(false); }
  };
  return <section className="inquiry-chat">
    <div className="inquiry-chat__welcome"><span className="inquiry-chat__avatar"><Icon name="support_agent" /></span><div><strong>{customerId ? '고객 문의' : '무엇을 도와드릴까요?'}</strong><p>{customerId ? '고객에게 답변을 보내주세요.' : '궁금한 내용을 남겨주세요. 관리자가 확인하고 답변해 드려요.'}</p></div></div>
    <div className="inquiry-chat__messages" ref={log} role="log" aria-live="polite" aria-label="문의 대화">
      {!messages.length && <p className="inquiry-chat__empty">{ready ? '아직 대화가 없어요. 아래에 내용을 적어 보내주세요.' : '채팅을 연결하고 있어요…'}</p>}
      {messages.map(message => <div key={message.id} className={`inquiry-chat__message${message.authorId === userId.current ? ' is-mine' : ''}`}>
        <small>{message.authorId === userId.current ? '나' : customerId ? '고객' : '관리자'}</small>
        <p>{message.body}</p><time>{new Date(message.createdAt.replace(' ', 'T') + 'Z').toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</time>
      </div>)}
    </div>
    {error && <div className="inquiry-chat__error" role="alert">{error} {!ready && <button type="button" onClick={() => { userId.current = null; setAttempt(value => value + 1); }}>다시 연결</button>}</div>}
    <form className="inquiry-chat__composer" onSubmit={send}>
      <label className="sr-only" htmlFor="inquiry-message">문의 내용</label>
      <textarea id="inquiry-message" rows={2} maxLength={2000} placeholder="여기에 문의 내용을 적어주세요" disabled={!ready || busy} value={draft} onChange={event => setDraft(event.target.value)} />
      <button type="submit" disabled={!ready || busy || !draft.trim()}><Icon name="send" />{busy ? '보내는 중' : '보내기'}</button>
    </form>
  </section>;
}
