import { Link, Outlet, useLocation } from 'react-router-dom';
import Icon from './common/Icon';
export default function CustomerLayout() {
  const { pathname } = useLocation();
  const personal = ['/customer/me', '/customer/orders', '/customer/wallet', '/customer/payment-result'].includes(pathname);
  return <div className="customer-layout"><Outlet /><nav className="customer-nav" aria-label="고객 메뉴">
    <Link to="/customer" className={`customer-nav__link${!personal ? ' is-active' : ''}`} aria-current={!personal ? 'page' : undefined}><Icon name="home" /><span>홈</span></Link>
    <Link to="/customer/me" className={`customer-nav__link${personal ? ' is-active' : ''}`} aria-current={personal ? 'page' : undefined}><Icon name="person" /><span>내 정보</span></Link>
  </nav></div>;
}
