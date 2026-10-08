import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getNotificationSettings } from '../../services/notificationSettings';
const STATUS = { accepted: '수락되었어요', rejected: '거절되었어요', done: '완료되었어요' };
export default function CustomerNotifications() {
  const [enabled, setEnabled] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    getNotificationSettings().then((data) => { if (alive) setEnabled(data.enabled); }).catch(() => {});
    const changed = (event) => { setEnabled(event.detail.enabled); if (!event.detail.enabled) setMessage(''); };
    window.addEventListener('calar-notification-settings', changed);
    return () => { alive = false; window.removeEventListener('calar-notification-settings', changed); };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true; let previous = null; let loading = false;
    const poll = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const { data } = await api.get('/api/orders/mine');
        if (!alive) return;
        if (previous) {
          const changed = data.find((order) => previous.has(order.id) && previous.get(order.id) !== order.status && STATUS[order.status]);
          if (changed) setMessage(`${changed.storeName} ${changed.partySize ? '예약' : '주문'}이 ${STATUS[changed.status]}`);
        }
        previous = new Map(data.map((order) => [order.id, order.status]));
      } catch { /* Keep polling after transient network failures. */ }
      finally { loading = false; }
    };
    poll(); const timer = setInterval(poll, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled]);
  return message ? <aside className="customer-notification" role="status"><Link to="/customer/orders">{message}</Link><button type="button" onClick={() => setMessage('')} aria-label="알림 닫기">닫기</button></aside> : null;
}
