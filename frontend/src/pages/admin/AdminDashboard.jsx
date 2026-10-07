import { useEffect, useState } from 'react';
import Header from '../../components/common/Header';
import api from '../../services/api';

const tabs = [['overview', '현황'], ['businesses', '사업자 승인'], ['users', '사용자'], ['stores', '가게'], ['categories', '업종']];

const AdminDashboard = () => {
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState({});
  const [businesses, setBusinesses] = useState([]);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingStore, setEditingStore] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    try {
      const [summary, businessRows, userRows, storeRows, categoryRows] = await Promise.all([
        api.get('/api/admin/dashboard'), api.get('/api/admin/businesses'), api.get('/api/admin/users'),
        api.get('/api/admin/stores'), api.get('/api/admin/categories'),
      ]);
      setDashboard(summary.data);
      setBusinesses(businessRows.data);
      setUsers(userRows.data);
      setStores(storeRows.data);
      setCategories(categoryRows.data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '관리 정보를 불러오지 못했습니다.');
    }
  };

  useEffect(() => { refresh(); }, []);

  const review = async (business, status) => {
    const reason = status === 'rejected' ? window.prompt('보완 요청 사유를 입력하세요.') : null;
    if (status === 'rejected' && !reason?.trim()) return;
    try {
      await api.patch(`/api/admin/businesses/${business.id}`, { status, reason });
      setNotice(status === 'verified' ? '사업자 신청을 승인했습니다.' : '보완 요청을 보냈습니다.');
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.error || '사업자 정보를 변경하지 못했습니다.');
    }
  };

  const saveStore = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.categoryId = Number(body.categoryId);
    body.ownerId = body.ownerId ? Number(body.ownerId) : null;
    body.locationLat = body.locationLat === '' ? null : Number(body.locationLat);
    body.locationLng = body.locationLng === '' ? null : Number(body.locationLng);
    try {
      const path = editingStore?.id ? `/api/admin/stores/${editingStore.id}` : '/api/admin/stores';
      if (editingStore?.id) await api.patch(path, body);
      else await api.post(path, body);
      setEditingStore(null);
      setNotice('가게 정보를 저장했습니다.');
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.error || '가게 정보를 저장하지 못했습니다.');
    }
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const categoryId = form.get('categoryId');
    const body = { name: String(form.get('name') || '').trim() };
    try {
      if (categoryId) await api.patch(`/api/admin/categories/${categoryId}`, body);
      else await api.post('/api/admin/categories', body);
      formElement.reset();
      await refresh();
      setNotice('업종을 저장했습니다.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '업종을 저장하지 못했습니다.');
    }
  };

  const updateUser = async (user, patch) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, patch);
      await refresh();
      setNotice('사용자 정보를 변경했습니다.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '사용자를 변경하지 못했습니다.');
    }
  };

  const remove = async (path) => {
    if (!window.confirm('삭제할까요?')) return;
    try {
      await api.delete(path);
      await refresh();
      setNotice('삭제했습니다.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '삭제하지 못했습니다.');
    }
  };

  const storeForm = () => <section className="panel"><div className="section-toolbar"><div><p className="eyebrow">STORE DIRECTORY</p><h3>{editingStore?.id ? '가게 수정' : '가게 추가'}</h3></div><button className="quiet-button" onClick={() => setEditingStore(null)}>닫기</button></div><form className="management-form" onSubmit={saveStore}><label>가게명<input name="name" defaultValue={editingStore?.name || ''} required /></label><label>업종<select name="categoryId" defaultValue={categories.find((item) => item.name === editingStore?.category)?.id || categories[0]?.id || ''} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>담당 점주<select name="ownerId" defaultValue={editingStore?.ownerId || ''}><option value="">미배정</option>{users.filter((user) => user.role === 'owner' && user.businessStatus === 'verified').map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.email}</option>)}</select></label><label>주소<input name="address" defaultValue={editingStore?.address || ''} required /></label><label>연락처<input name="phone" defaultValue={editingStore?.phone || ''} /></label><label>영업시간<input name="openHours" defaultValue={editingStore?.openHours || '09:00-18:00'} required /></label><label>위도<input name="locationLat" type="number" step="any" defaultValue={editingStore?.location?.lat ?? ''} /></label><label>경도<input name="locationLng" type="number" step="any" defaultValue={editingStore?.location?.lng ?? ''} /></label><label>주문 방식<select name="orderType" defaultValue={editingStore?.orderType || 'preorder'}><option value="preorder">사전 주문</option><option value="reservation">예약</option><option value="none">주문 없음</option></select></label><label className="wide-field">소개<textarea name="description" defaultValue={editingStore?.description || ''} /></label><button className="primary-button" type="submit">저장</button></form></section>;

  return <main className="app-shell"><Header title="관리자" />
    <div className="content-wrap"><section className="section-heading"><p className="eyebrow">ADMINISTRATION</p><h2>동네 운영 현황</h2><p>사용자와 사업자 신청, 가게 정보를 관리합니다.</p></section>
      <nav className="portal-tabs" aria-label="관리자 메뉴">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success">{notice}</p>}
      {tab === 'overview' && <><div className="metric-row"><div className="metric-card"><span>가입 사용자</span><strong>{dashboard.users || 0}</strong></div><div className="metric-card"><span>등록 가게</span><strong>{dashboard.stores || 0}</strong></div><div className="metric-card"><span>사업자 승인 대기</span><strong>{dashboard.pendingBusinesses || 0}</strong></div><div className="metric-card"><span>대기 주문</span><strong>{dashboard.pendingOrders || 0}</strong></div></div><section className="panel"><div className="section-toolbar"><div><p className="eyebrow">REVIEW QUEUE</p><h3>승인 대기 사업자</h3></div><button className="quiet-button" onClick={() => setTab('businesses')}>전체 보기 →</button></div>{businesses.filter((item) => item.status === 'pending').map((item) => <BusinessRow key={item.id} business={item} onReview={review} />)}</section></>}
      {tab === 'businesses' && <section className="panel"><div className="section-toolbar"><div><p className="eyebrow">BUSINESS REVIEW</p><h3>사업자 신청</h3></div></div><p className="form-note">사업자번호 체크섬은 입력 오류만 검사합니다. 실제 등록 사실은 관리자 검토로 확인합니다.</p>{businesses.map((item) => <BusinessRow key={item.id} business={item} onReview={review} />)}</section>}
      {tab === 'users' && <section className="panel"><div className="section-toolbar"><div><p className="eyebrow">PEOPLE</p><h3>사용자</h3></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>계정</th><th>주소</th><th>역할</th><th>사용 상태</th><th>작업</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.displayName}<small>{user.email}</small></td><td>{user.address || '미등록'}</td><td><select value={user.role} onChange={(event) => updateUser(user, { role: event.target.value })}><option value="customer">고객</option><option value="owner">점주</option><option value="admin">관리자</option></select></td><td>{user.isActive ? '사용 중' : '정지'}</td><td><button className={user.isActive ? 'danger-button' : 'quiet-button'} onClick={() => updateUser(user, { isActive: !user.isActive })}>{user.isActive ? '정지' : '복구'}</button><button className="danger-button" onClick={() => remove(`/api/admin/users/${user.id}`)}>삭제</button></td></tr>)}</tbody></table></div></section>}
      {tab === 'stores' && <><div className="section-toolbar"><span className="eyebrow">STORE DIRECTORY</span><button className="primary-button" onClick={() => setEditingStore({})}>가게 추가</button></div>{editingStore && storeForm()}<section className="panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>가게</th><th>주소</th><th>점주</th><th>방문</th><th>작업</th></tr></thead><tbody>{stores.map((store) => <tr key={store.id}><td>{store.name}<small>{store.category}</small></td><td>{store.address}</td><td>{users.find((user) => user.id === store.ownerId)?.displayName || '미배정'}</td><td>{store.visits}</td><td><button className="quiet-button" onClick={() => setEditingStore(store)}>수정</button><button className="danger-button" onClick={() => remove(`/api/admin/stores/${store.id}`)}>삭제</button></td></tr>)}</tbody></table></div></section></>}
      {tab === 'categories' && <section className="panel"><div className="section-toolbar"><div><p className="eyebrow">TAXONOMY</p><h3>업종 관리</h3></div></div><form className="inline-form" onSubmit={saveCategory}><label>새 업종<input name="name" required maxLength="80" /></label><button className="primary-button" type="submit">추가</button></form><div className="category-list">{categories.map((category) => <div className="category-row" key={category.id}><span>{category.name}</span><div><button className="quiet-button" onClick={async () => { const name = window.prompt('업종명', category.name); if (name?.trim()) { await api.patch(`/api/admin/categories/${category.id}`, { name: name.trim() }); await refresh(); } }}>수정</button><button className="danger-button" onClick={() => remove(`/api/admin/categories/${category.id}`)}>삭제</button></div></div>)}</div></section>}
    </div>
  </main>;
};

function BusinessRow({ business, onReview }) {
  return <article className="business-row"><div><p className="eyebrow">{business.status}</p><h4>{business.legalName}</h4><p>{business.representativeName} · {business.businessNumber}</p><p>{business.displayName} · {business.email}</p><a href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`} target="_blank" rel="noreferrer">{business.address} ↗</a>{business.rejectionReason && <p className="form-error">{business.rejectionReason}</p>}</div><div className="action-stack">{business.status !== 'verified' && <button className="primary-button" onClick={() => onReview(business, 'verified')}>승인</button>}{business.status !== 'rejected' && <button className="danger-button" onClick={() => onReview(business, 'rejected')}>보완 요청</button>}</div></article>;
}

export default AdminDashboard;