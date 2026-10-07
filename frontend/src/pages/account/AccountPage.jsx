import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const AccountPage = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/auth/orders').then(({ data }) => setOrders(data)).catch((requestError) => setError(requestError.response?.data?.error || '주문 내역을 불러오지 못했습니다.'));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api.patch('/api/auth/profile', values);
      setMessage('계정 정보를 저장했습니다.');
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || '저장하지 못했습니다.');
    }
  };

  return <main className="app-shell"><Header title="내 계정" showBackButton />
    <div className="content-wrap">
      <section className="section-heading"><p className="eyebrow">ACCOUNT</p><h2>{user.displayName}님, 반가워요</h2><p>연락처와 주소를 저장하면 주문할 때 편리합니다.</p></section>
      <div className="account-grid">
        <form className="panel form-stack" onSubmit={saveProfile}>
          <h3>계정 정보</h3>
          <label>이름<input name="displayName" defaultValue={user.displayName} required maxLength="80" /></label>
          <label>연락처<input name="phone" type="tel" defaultValue={user.phone || ''} /></label>
          <label>내 주소<input name="address" defaultValue={user.address || ''} autoComplete="street-address" /></label>
          {message && <p className="form-success">{message}</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">정보 저장</button>
          <button className="quiet-button" type="button" onClick={() => logout()}>로그아웃</button>
        </form>
        <section className="panel">
          <div className="section-heading compact"><p className="eyebrow">ORDER HISTORY</p><h3>내 주문</h3></div>
          {orders.length ? <ul className="order-history">{orders.map((order) => <li key={order.id}><div><strong>주문 #{order.id}</strong><span>{order.pickupTime.replace('T', ' ')} · {order.totalPrice.toLocaleString()}원</span></div><span className={`status-tag ${order.status}`}>{order.status}</span></li>)}</ul> : <p className="empty-state">아직 주문 내역이 없습니다.</p>}
        </section>
      </div>
      {user.role === 'owner' && <section className="panel business-summary"><div><p className="eyebrow">BUSINESS REVIEW</p><h3>사업자 승인 상태</h3><p>{user.business?.legalName || '사업자 정보'} · {user.business?.address || '주소 미등록'}</p></div><span className={`status-tag ${user.business?.status}`}>{user.business?.status === 'verified' ? '승인 완료' : user.business?.status === 'rejected' ? '보완 요청' : '승인 대기'}</span><Link className="quiet-button" to="/owner">점주 관리 열기</Link></section>}
    </div>
  </main>;
};

export default AccountPage;