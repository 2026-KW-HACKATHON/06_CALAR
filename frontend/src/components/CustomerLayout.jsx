import { Link, Outlet, useLocation } from 'react-router-dom';
import Icon from './common/Icon';
import CustomerModeContext from '../context/CustomerModeContext';
import { ROUTES } from '../constants/routes';
import CustomerNotifications from './customer/CustomerNotifications';
const TABS = [[ROUTES.customerHome, '홈', 'home'], [ROUTES.nearbyStores, '가게', 'storefront'], [ROUTES.camera, '촬영', 'photo_camera'], ['/customer/me', '내 정보', 'person'], [ROUTES.settings, '설정', 'settings']];
export default function CustomerLayout() {
  const { pathname } = useLocation();
  const active = pathname.startsWith('/store/') || pathname === ROUTES.recommendation ? ROUTES.nearbyStores : ['/customer/orders', '/customer/wallet', '/customer/payment-result'].includes(pathname) ? '/customer/me' : pathname;
  return <CustomerModeContext.Provider value={true}><div className="customer-layout"><Outlet /><CustomerNotifications />{pathname !== '/customer/inquiries' && <nav className="customer-nav" aria-label="고객 메뉴">
    {TABS.map(([path, label, icon]) => <Link key={path} to={path} state={path === ROUTES.camera ? { tab: 'camera' } : undefined} className={`customer-nav__link${path === ROUTES.camera ? ' customer-nav__camera' : ''}${active === path ? ' is-active' : ''}`} aria-current={active === path ? 'page' : undefined}><span className="customer-nav__icon"><Icon name={icon} /></span><span>{label}</span></Link>)}
  </nav>}</div></CustomerModeContext.Provider>;
}
