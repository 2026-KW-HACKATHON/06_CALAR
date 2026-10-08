import { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CustomerModeContext from '../../context/CustomerModeContext';
import api from '../../services/api';
import { clearToken, getToken, getRole } from '../../services/session';
import Icon from './Icon';

// 공통 헤더
// props
//  - title          : 화면 제목
//  - showBackButton : true 면 왼쪽에 "뒤로" 버튼 (아이콘 + 글자)
//  - variant        : 'brand' 면 Home 처럼 큰 주황색 로고 제목
const Header = ({ title, showBackButton = false, variant = 'default', showRoleSwitch = false, onBack }) => {
  const navigate = useNavigate();
  const customerMode = useContext(CustomerModeContext);
  const location = useLocation();
  const logout = async () => {
    try { await api.post('/api/auth/logout'); }
    finally { clearToken(); window.dispatchEvent(new Event('calar-session-expired')); navigate(getRole() === 'owner' ? '/owner/login' : '/customer/me', { replace: true }); }
  };

  const classes = ['header', showBackButton ? 'header--back' : '', variant === 'brand' ? 'header--brand' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <header className={classes}>
      {showBackButton && (
        <button type="button" className="header__back" onClick={() => onBack ? onBack() : navigate(-1)}>
          <Icon name="chevron_left" />
          뒤로
        </button>
      )}
      <h1 className="header__title">{title}</h1>
      {customerMode && showRoleSwitch && <Link className="header__favorite" to="/customer/favorites" aria-label="내가 찜한 가게"><Icon name="favorite_border" /></Link>}
      {showRoleSwitch && !customerMode && <Link className="header__role-switch" to="/roles">역할 선택</Link>}
      {showRoleSwitch && !customerMode && getToken() && <button type="button" className="header__role-switch" onClick={() => logout().catch(() => {})}>로그아웃</button>}
      {customerMode && location.pathname !== '/customer/inquiries' && (
        <Link className="header__inquiry" to="/customer/inquiries" state={{ returnTo: location.pathname + location.search }}>
          <span className="header__inquiry-icon" aria-hidden="true"><Icon name="chat_bubble" fill /></span>
          <span className="header__inquiry-label">문의하기</span>
        </Link>
      )}
    </header>
  );
};

export default Header;
