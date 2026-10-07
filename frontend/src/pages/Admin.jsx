import { useEffect, useState } from 'react';
import api from '../services/api';
import { getToken, saveToken, clearToken } from '../services/session';
import BigButton from '../components/common/BigButton';

const SECTIONS = {
  users: { title: '사용자', sample: { role: 'customer', isActive: 1 }, create: false },
  businesses: { title: '사업자 승인', sample: { status: 'verified' }, create: false, remove: false },
  stores: { title: '가게', sample: { name: '', categoryId: 1, address: '', phone: '', description: '', openHours: '09:00-18:00', orderType: 'preorder', ownerId: null } },
  categories: { title: '업종', sample: { name: '' } },
  menus: { title: '메뉴', sample: { name: '', price: 0 }, nested: true },
  coupons: { title: '쿠폰', sample: { title: '', description: '', discountRate: 10, isActive: true }, nested: true },
};

export default function Admin() {
  const [auth, setAuth] = useState('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [section, setSection] = useState('users');
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editing, setEditing] = useState(null);
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tick, setTick] = useState(0);
  const config = SECTIONS[section];
  const endpoint = config.nested ? `/api/admin/stores/${storeId}/${section}` : `/api/admin/${section}`;
  useEffect(() => {
    let active = true;
    const expired = () => { setAuth('login'); setRows([]); };
    window.addEventListener('calar-session-expired', expired);
    if (!getToken()) setAuth('login');
    else api.get('/api/auth/me').then(({ data }) => {
      if (active) setAuth(data.user.role === 'admin' ? 'ready' : 'login');
    }).catch(() => { if (active) setAuth('login'); });
    return () => { active = false; window.removeEventListener('calar-session-expired', expired); };
  }, []);
  useEffect(() => {
    if (auth !== 'ready') return;
    let active = true;
    setRows([]); setEditing(null); setError('');
    if (config.nested && !/^[1-9]\d*$/.test(storeId)) return;
    setLoading(true);
    Promise.all([api.get(endpoint), api.get('/api/admin/dashboard')]).then(([list, dashboard]) => {
      if (active) { setRows(list.data); setSummary(dashboard.data); }
    }).catch((err) => { if (active) setError(err.response?.data?.error || '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth, section, storeId, tick]);
  const login = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      if (data.user.role !== 'admin') {
        await api.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${data.token}` } });
        setError('관리자 계정으로 로그인해 주세요.'); return;
      }
      saveToken(data.token); setPassword(''); setAuth('ready');
    } catch { setError('로그인하지 못했습니다. 계정 정보와 서버 연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const mutate = async (method, id, body) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.request({ method, url: `${endpoint}${id == null ? '' : `/${id}`}`, data: body });
      setNotice('DB에 반영했습니다.'); setEditing(null); setTick((value) => value + 1);
    } catch (err) { setError(err.response?.data?.error || err.message || '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const openEditor = (row) => {
    setEditing({ id: row?.id ?? null });
    const body = { ...config.sample };
    if (row) {
      for (const key of Object.keys(body)) if (row[key] !== undefined) body[key] = row[key];
      if (section === 'stores' && row.categoryId === undefined) delete body.categoryId;
      if (section === 'users') body.isActive = row.isActive ?? 1;
      if (section === 'businesses' && row.status === 'pending') body.status = 'verified';
    }
    setJson(JSON.stringify(body, null, 2)); setError('');
  };
  const save = (event) => {
    event.preventDefault();
    try {
      const body = JSON.parse(json);
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
      mutate(editing.id === null ? 'post' : 'patch', editing.id, body);
    } catch { setError('올바른 JSON 객체를 입력해 주세요.'); }
  };
  return <div className="admin-screen">
    <header className="admin-header"><h1>월계 관리자</h1><a href="/">앱으로 이동</a>
      {auth === 'ready' && <button disabled={busy} onClick={async () => {
        setBusy(true);
        try { await api.post('/api/auth/logout'); } catch { /* Clear local session even if the server is offline. */ }
        finally { clearToken(); setAuth('login'); setRows([]); setSummary(null); setBusy(false); }
      }}>로그아웃</button>}
    </header>
    {error && <p className="owner-login__error" role="alert">{error}</p>}
    <p>???? deleted_at? ??? ???? ???? ????. ?? ???? ?? ??? ?????.</p>
    {notice && <p role="status">{notice}</p>}
    {auth === 'checking' && <p>관리자 권한 확인 중…</p>}
    {auth === 'login' && <form className="stack owner-login admin-login" onSubmit={login}>
      <h2>관리자 로그인</h2>
      <label className="stack">이메일<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="stack">비밀번호<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <BigButton type="submit" loading={busy}>로그인</BigButton>
      <a href="/reset-password">비밀번호 재설정</a>
    </form>}
    {auth === 'ready' && <>
      {summary && <div className="admin-summary"><span>사용자 {summary.users}</span><span>가게 {summary.stores}</span><span>승인 대기 {summary.pendingBusinesses}</span><span>주문 대기 {summary.pendingOrders}</span></div>}
      <nav className="admin-tabs" aria-label="관리할 데이터">{Object.entries(SECTIONS).map(([key, item]) =>
        <button key={key} disabled={busy} aria-pressed={section === key} onClick={() => { setSection(key); setNotice(''); }}>{item.title}</button>)}</nav>
      <div className="admin-toolbar"><h2>{config.title}</h2>
        {config.nested && <label>가게 ID <input type="number" min="1" value={storeId} disabled={busy} onChange={(e) => setStoreId(e.target.value)} /></label>}
        <button disabled={busy || loading} onClick={() => setTick((value) => value + 1)}>새로고침</button>
        {config.create !== false && <button disabled={busy || loading || (config.nested && !/^[1-9]\d*$/.test(storeId))} onClick={() => openEditor(null)}>새로 등록</button>}
      </div>
      {section === 'businesses' && <p>pending은 승인 대기, verified는 승인 완료, rejected는 반려 상태입니다.</p>}
      {config.nested && !storeId && <p>관리할 가게 ID를 입력해 주세요.</p>}
      {loading ? <p>불러오는 중…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>DB 데이터</th><th>작업</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id}><td>{row.id}</td><td><pre>{JSON.stringify(row, null, 2)}</pre></td><td>
          {section === 'businesses' && <>
            <button disabled={busy || row.status === 'verified'} onClick={() => mutate('patch', row.id, { status: 'verified' })}>승인</button>
            <button disabled={busy || row.status === 'rejected'} onClick={() => {
              const rejectionReason = window.prompt('반려 사유를 입력해 주세요.');
              if (rejectionReason !== null) {
                if (!rejectionReason.trim() || rejectionReason.length > 500) { setError('반려 사유를 1~500자로 입력해 주세요.'); return; }
                mutate('patch', row.id, { status: 'rejected', reason: rejectionReason });
              }
            }}>반려</button>
          </>}
          <button disabled={busy} onClick={() => openEditor(row)}>수정</button>
          {config.remove !== false && <button disabled={busy} onClick={() => {
            if (window.confirm(`${config.title} ID ${row.id} 데이터를 삭제할까요?`)) mutate('delete', row.id);
          }}>삭제</button>}
        </td></tr>)}
        {!rows.length && <tr><td colSpan={3}>표시할 데이터가 없습니다.</td></tr>}
      </tbody></table></div>}
      {editing && <form className="stack admin-editor" onSubmit={save}><h3>{editing.id === null ? '새로 등록' : `ID ${editing.id} 수정`}</h3>
        <label className="stack">저장할 필드 (JSON)<textarea rows={14} value={json} disabled={busy} onChange={(e) => setJson(e.target.value)} /></label>
        <BigButton type="submit" loading={busy}>DB에 저장</BigButton><button type="button" disabled={busy} onClick={() => setEditing(null)}>취소</button>
      </form>}
    </>}
  </div>;
}
