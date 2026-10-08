import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import InquiryChat from '../components/InquiryChat';

export default function AdminInquiries() {
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const { data } = await api.get('/api/inquiries'); if (active) { setThreads(data); setError(''); } }
      catch { if (active) setError('관리자 로그인 후 문의를 확인해 주세요.'); }
    };
    load(); const timer = setInterval(load, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <main className="admin-screen"><Link to="/admin">← 관리자 화면으로</Link><h1>고객 문의</h1>
    {error && <p role="alert">{error}</p>}
    {!error && <div className="inquiry-admin"><aside>{threads.length === 0 && <p>아직 문의가 없어요.</p>}{threads.map(thread => <button type="button" key={thread.customerId} aria-pressed={selected === thread.customerId} onClick={() => setSelected(thread.customerId)}><strong>{thread.displayName} #{thread.customerId}</strong><span>{thread.body}</span></button>)}</aside>
      {selected ? <InquiryChat key={selected} customerId={selected} /> : <p>문의할 고객을 선택해 주세요.</p>}
    </div>}
  </main>;
}
