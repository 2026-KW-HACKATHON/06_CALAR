import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { clearToken, getToken, getRole } from '../../services/session';
import Icon from './Icon';

// 공통 헤더
// props
//  - title          : 화면 제목
//  - showBackButton : true 면 왼쪽에 "뒤로" 버튼 (아이콘 + 글자)
//  - variant        : 'brand' 면 Home 처럼 큰 주황색 로고 제목
const Header = ({ title, showBackButton = false, variant = 'default', showRoleSwitch = false }) => {
  const navigate = useNavigate();
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
        <button type="button" className="header__back" onClick={() => navigate(-1)}>
          <Icon name="chevron_left" />
          뒤로
        </button>
      )}
      <h1 className="header__title">{title}</h1>
      {showRoleSwitch && <Link className="header__role-switch" to="/roles">역할 선택</Link>}
      {showRoleSwitch && getToken() && <button type="button" className="header__role-switch" onClick={() => logout().catch(() => {})}>로그아웃</button>}
    </header>
  );
};

export default Header;
