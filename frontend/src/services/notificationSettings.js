import api from './api';
import { ensureCustomerSession } from './customerSession';
export async function getNotificationSettings() {
  await ensureCustomerSession();
  return (await api.get('/api/auth/notification-settings')).data;
}
export async function setNotificationSettings(enabled) {
  const data = (await api.patch('/api/auth/notification-settings', { enabled })).data;
  window.dispatchEvent(new CustomEvent('calar-notification-settings', { detail: data }));
  return data;
}
