import { useEffect, useState } from 'react';
import Header from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const tabs = [['overview', '운영 요약'], ['store', '가게 정보'], ['menus', '메뉴 관리'], ['coupons', '쿠폰 관리'], ['orders', '주문 관리']];

const OwnerDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [menus, setMenus] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editingMenu, setEditingMenu] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [editingStore, setEditingStore] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [{ data: dashboard }, { data: categoryList }] = await Promise.all([
        api.get('/api/owner/dashboard'),
        api.get('/api/owner/categories'),
      ]);
      setData(dashboard);
      setCategories(categoryList);
      setSelectedId((current) => dashboard.stores.some((store) => String(store.id) === current)
        ? current
        : String(dashboard.stores[0]?.id || ''));
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '점주 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const store = data?.stores.find((item) => String(item.id) === selectedId);
  const creatingStore = editingStore === 'new';
  const formStore = creatingStore ? null : store;

  useEffect(() => {
    if (!store || !['menus', 'coupons', 'orders'].includes(tab)) return;
    const endpoint = `/api/owner/stores/${store.id}`;
    const load = tab === 'menus' ? api.get(`${endpoint}/menus`).then(({ data: result }) => setMenus(result))
      : tab === 'coupons' ? api.get(`${endpoint}/coupons`).then(({ data: result }) => setCoupons(result))
        : api.get(`${endpoint}/orders`).then(({ data: result }) => setOrders(result));
    load.catch((requestError) => setError(requestError.response?.data?.error || '관리 정보를 불러오지 못했습니다.'));
  }, [store?.id, tab]);

  const saveStore = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.categoryId = Number(body.categoryId);
    body.locationLat = body.locationLat === '' ? null : Number(body.locationLat);
    body.locationLng = body.locationLng === '' ? null : Number(body.locationLng);
    try {
      const response = store && !creatingStore
        ? await api.patch(`/api/owner/stores/${store.id}`, body)
        : await api.post('/api/owner/stores', body);
      setSelectedId(String(response.data.id));
      setEditingStore(false);
      setNotice('가게 정보를 저장했습니다.');
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.error || '가게 정보를 저장하지 못했습니다.');
    }
  };

  const saveMenu = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.price = Number(body.price);
    try {
      if (editingMenu?.id) await api.patch(`/api/owner/stores/${store.id}/menus/${editingMenu.id}`, body);
      else await api.post(`/api/owner/stores/${store.id}/menus`, body);
      setEditingMenu(null);
      setMenus((await api.get(`/api/owner/stores/${store.id}/menus`)).data);
      setNotice('메뉴를 저장했습니다.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '메뉴를 저장하지 못했습니다.');
    }
  };

  const saveCoupon = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.discountRate = body.discountRate === '' ? null : Number(body.discountRate);
    body.isActive = event.currentTarget.elements.isActive.checked;
    body.validFrom ||= null;
    body.validUntil ||= null;
    try {
      if (editingCoupon?.id) await api.patch(`/api/owner/stores/${store.id}/coupons/${editingCoupon.id}`, body);
      else await api.post(`/api/owner/stores/${store.id}/coupons`, body);
      setEditingCoupon(null);
      setCoupons((await api.get(`/api/owner/stores/${store.id}/coupons`)).data);
      setNotice('쿠폰을 저장했습니다.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '쿠폰을 저장하지 못했습니다.');
    }
  };

  const remove = async (path, reload) => {
    if (!window.confirm('삭제할까요?')) return;
    try {
      await api.delete(path);
      await reload();
      setNotice('삭제했습니다.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '삭제하지 못했습니다.');
    }
  };

  const changeStatus = async (order, status) => {
    try {
      await api.patch(`/api/owner/orders/${order.id}/status`, { status });
      setOrders((await api.get(`/api/owner/stores/${store.id}/orders`)).data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || '주문 상태를 바꾸지 못했습니다.');
    }
  };

  if (loading) return <main className="loading-state">점주 정보를 불러오고 있어요.</main>;

  const business = data?.business;
  const isVerified = business?.status === 'verified';
  const menuList = () => <section className="panel">
    <div className="section-toolbar"><div><p className="eyebrow">MENU CATALOG</p><h3>{store?.name || '메뉴'} 관리</h3></div><button className="primary-button compact-button" disabled={!store} onClick={() => setEditingMenu({})}>메뉴 추가</button></div>
    {editingMenu && <form className="inline-form" onSubmit={saveMenu}><label>메뉴명<input name="name" defaultValue={editingMenu.name || ''} required maxLength="120" /></label><label>가격<input name="price" type="number" min="0" step="1" defaultValue={editingMenu.price ?? ''} required /></label><button className="primary-button" type="submit">저장</button><button className="quiet-button" type="button" onClick={() => setEditingMenu(null)}>취소</button></form>}
    {menus.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>메뉴</th><th>가격</th><th>작업</th></tr></thead><tbody>{menus.map((menu) => <tr key={menu.id}><td>{menu.name}</td><td>{menu.price.toLocaleString()}원</td><td><button className="quiet-button" onClick={() => setEditingMenu(menu)}>수정</button><button className="danger-button" onClick={() => remove(`/api/owner/stores/${store.id}/menus/${menu.id}`, async () => setMenus((await api.get(`/api/owner/stores/${store.id}/menus`)).data))}>삭제</button></td></tr>)}</tbody></table></div> : <p className="empty-state">등록된 메뉴가 없습니다.</p>}
  </section>;

  const couponList = () => <section className="panel">
    <div className="section-toolbar"><div><p className="eyebrow">LOCAL BENEFITS</p><h3>쿠폰 관리</h3></div><button className="primary-button compact-button" disabled={!store} onClick={() => setEditingCoupon({ isActive: true })}>쿠폰 추가</button></div>
    {editingCoupon && <form className="inline-form" onSubmit={saveCoupon}><label>쿠폰명<input name="title" defaultValue={editingCoupon.title || ''} required /></label><label>할인율<input name="discountRate" type="number" min="0" max="100" step="any" defaultValue={editingCoupon.discountRate ?? ''} /></label><label>시작일<input name="validFrom" type="date" defaultValue={editingCoupon.validFrom || ''} /></label><label>종료일<input name="validUntil" type="date" defaultValue={editingCoupon.validUntil || ''} /></label><label className="check-field"><input name="isActive" type="checkbox" defaultChecked={Boolean(editingCoupon.isActive)} /> 사용 중</label><label className="wide-field">설명<textarea name="description" defaultValue={editingCoupon.description || ''} /></label><button className="primary-button" type="submit">저장</button><button className="quiet-button" type="button" onClick={() => setEditingCoupon(null)}>취소</button></form>}
    {coupons.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>쿠폰</th><th>할인율</th><th>기간</th><th>상태</th><th>작업</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td>{coupon.title}</td><td>{coupon.discountRate == null ? '정액/기타' : `${coupon.discountRate}%`}</td><td>{coupon.validFrom || '상시'}–{coupon.validUntil || '기한 없음'}</td><td>{coupon.isActive ? '사용 중' : '중지'}</td><td><button className="quiet-button" onClick={() => setEditingCoupon(coupon)}>수정</button><button className="danger-button" onClick={() => remove(`/api/owner/stores/${store.id}/coupons/${coupon.id}`, async () => setCoupons((await api.get(`/api/owner/stores/${store.id}/coupons`)).data))}>삭제</button></td></tr>)}</tbody></table></div> : <p className="empty-state">등록된 쿠폰이 없습니다.</p>}
  </section>;

  return <main className="app-shell">
    <Header title="점주 공간" />
    <div className="content-wrap">
      <section className="section-heading"><p className="eyebrow">OWNER DESK</p><h2>{data?.user.displayName}님의 가게</h2><p>사업자 정보부터 메뉴와 주문까지 관리합니다.</p></section>
      <nav className="portal-tabs" aria-label="점주 관리 메뉴">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success">{notice}</p>}
      {!isVerified ? <section className="verification-panel"><p className="eyebrow">BUSINESS REVIEW</p><h3>{business?.status === 'rejected' ? '사업자 정보 보완이 필요합니다' : '사업자 승인 대기 중'}</h3><p>{business?.legalName} · {business?.address}</p>{business?.rejectionReason && <p className="form-error">{business.rejectionReason}</p>}<p>사업자 등록 사실을 관리자가 확인하면 가게 관리 기능이 열립니다.</p><a className="quiet-button" href="/account">계정 정보 보기</a></section> : <>
        <div className="portal-toolbar"><label>관리할 가게<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">가게를 선택하세요</option>{data.stores.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{tab === 'store' && <button className="primary-button" onClick={() => setEditingStore(true)}>가게 추가</button>}</div>
        {tab === 'overview' && <div className="metric-row"><div className="metric-card"><span>운영 가게</span><strong>{data.stores.length}</strong></div><div className="metric-card"><span>대기 주문</span><strong>{data.pendingOrders}</strong></div><div className="metric-card"><span>사업자 상태</span><strong>승인 완료</strong></div><div className="metric-card"><span>사업장 주소</span><strong>{business.address}</strong></div>{data.stores.map((item) => <section className="panel store-summary" key={item.id}><div><p className="eyebrow">{item.category}</p><h3>{item.name}</h3><p>{item.address}</p></div><button className="quiet-button" onClick={() => { setSelectedId(String(item.id)); setTab('store'); }}>정보 관리</button></section>)}</div>}
        {tab === 'store' && <section className="panel"><div className="section-toolbar"><div><p className="eyebrow">STORE PROFILE</p><h3>{creatingStore ? '새 가게 등록' : store ? store.name : '가게 정보'}</h3></div>{store && !creatingStore && <button className="quiet-button" onClick={() => remove(`/api/owner/stores/${store.id}`, refresh)}>가게 삭제</button>}</div>{(editingStore || !store) && <form className="management-form" onSubmit={saveStore}><label>가게명<input name="name" defaultValue={formStore?.name || ''} required /></label><label>업종<select name="categoryId" defaultValue={categories.find((item) => item.name === formStore?.category)?.id || categories[0]?.id || ''} required>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>주소<input name="address" defaultValue={formStore?.address || business.address || ''} required /></label><label>연락처<input name="phone" type="tel" defaultValue={formStore?.phone || ''} /></label><label>영업시간<input name="openHours" defaultValue={formStore?.openHours || '09:00-18:00'} placeholder="09:00-18:00" required /></label><label>주문 방식<select name="orderType" defaultValue={formStore?.orderType || 'preorder'}><option value="preorder">사전 주문</option><option value="reservation">예약</option><option value="none">주문 받지 않음</option></select></label><label>위도<input name="locationLat" type="number" step="any" defaultValue={formStore?.location?.lat ?? ''} /></label><label>경도<input name="locationLng" type="number" step="any" defaultValue={formStore?.location?.lng ?? ''} /></label><label className="wide-field">가게 소개<textarea name="description" defaultValue={formStore?.description || ''} /></label><div className="form-actions"><button className="primary-button" type="submit">저장</button>{store && <button className="quiet-button" type="button" onClick={() => setEditingStore(null)}>취소</button>}</div></form>}{store && !editingStore && <div className="store-info-lines"><p><span>사업장 주소</span>{business.address}</p><p><span>가게 주소</span>{store.address}</p><button className="quiet-button" onClick={() => setEditingStore(true)}>가게 정보 수정</button></div>}</section>}
        {tab === 'menus' && menuList()}
        {tab === 'coupons' && couponList()}
        {tab === 'orders' && <section className="panel"><div className="section-toolbar"><div><p className="eyebrow">ORDER DESK</p><h3>들어온 주문</h3></div></div>{orders.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>픽업</th><th>연락처</th><th>메뉴</th><th>금액</th><th>상태</th><th>처리</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.pickupTime.replace('T', ' ')}</td><td>{order.customerPhone}</td><td>{order.items.map((item) => `${store?.menu.find((entry) => entry.id === item.menuId)?.name || `메뉴 ${item.menuId}`} × ${item.quantity}`).join(', ')}</td><td>{order.totalPrice.toLocaleString()}원</td><td>{order.status}</td><td>{order.status === 'pending' ? <><button className="primary-button compact-button" onClick={() => changeStatus(order, 'accepted')}>접수</button><button className="danger-button" onClick={() => changeStatus(order, 'rejected')}>거절</button></> : order.status === 'accepted' ? <button className="primary-button compact-button" onClick={() => changeStatus(order, 'done')}>완료</button> : ''}</td></tr>)}</tbody></table></div> : <p className="empty-state">현재 들어온 주문이 없습니다.</p>}</section>}
      </>}
    </div>
  </main>;
};

export default OwnerDashboard;