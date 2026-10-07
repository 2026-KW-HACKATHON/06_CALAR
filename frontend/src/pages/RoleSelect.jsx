import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Icon from '../components/common/Icon';
import { ROUTES } from '../constants/routes';
import { rememberRole } from '../services/session';

const RoleSelect = () => {
  const navigate = useNavigate();
  const selectRole = (role) => {
    rememberRole(role);
    navigate(role === 'customer' ? ROUTES.customerHome : ROUTES.ownerSelect);
  };

  return (
    <div className="screen">
      <Header title="월계" variant="brand" />
      <main className="screen__body role-select">
        <div className="stack">
          <p className="role-select__intro">우리 동네 가게와 함께하는 월계</p>
          <h2 className="lead">어떻게 이용하시겠어요?</h2>
          <p className="role-select__intro">이용하실 역할을 선택해 주세요.</p>
        </div>
        <div className="stack">
          <button type="button" className="hero-btn hero-btn--primary" onClick={() => selectRole('customer')}>
            <span className="hero-btn__icon"><Icon name="person" /></span>
            <span className="hero-btn__text">
              <span className="hero-btn__title">고객으로 이용하기</span>
              <span className="hero-btn__desc">동네 가게를 찾고 주문·예약해요</span>
            </span>
            <Icon name="chevron_right" />
          </button>
          <button type="button" className="hero-btn hero-btn--secondary" onClick={() => selectRole('owner')}>
            <span className="hero-btn__icon"><Icon name="storefront" /></span>
            <span className="hero-btn__text">
              <span className="hero-btn__title">점주로 이용하기</span>
              <span className="hero-btn__desc">우리 가게의 주문·예약을 관리해요</span>
            </span>
            <Icon name="chevron_right" />
          </button>
        </div>
        <p className="role-select__intro">이용 중에도 역할을 다시 선택할 수 있어요.</p>
      </main>
    </div>
  );
};

export default RoleSelect;
