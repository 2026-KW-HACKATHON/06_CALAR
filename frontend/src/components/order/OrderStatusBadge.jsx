import Icon from '../common/Icon';
import { ORDER_STATUS } from '../../constants/orderStatus';

// 주문 상태 뱃지: 색 + 아이콘 + 한국어 글자 (고객 화면 / 점주 화면 공용)
const OrderStatusBadge = ({ status, large = false }) => {
  const info = ORDER_STATUS[status] || { label: status, icon: 'help' };

  return (
    <span className={`badge badge--status badge--${status}${large ? ' badge--status-lg' : ''}`}>
      <Icon name={info.icon} />
      {info.label}
    </span>
  );
};

export default OrderStatusBadge;
