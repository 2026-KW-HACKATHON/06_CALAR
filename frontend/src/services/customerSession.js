import api from './api';
import { rememberRole, saveToken } from './session';

let pending;

// Share a request across pages and React StrictMode mounts to avoid duplicate accounts.
export function ensureCustomerSession() {
  if (!pending) {
    const options = { headers: { 'X-Calar-Browser-Session': '1' } };
    pending = api.post('/api/auth/customer/session', {}, options).catch((error) => {
      // The API interceptor removes an expired token before retrying anonymously.
      if (error.response?.status === 401) return api.post('/api/auth/customer/session', {}, options);
      throw error;
    }).then(({ data }) => {
      const previousId = localStorage.getItem('calar.customerId');
      if (previousId !== String(data.user.id)) {
        for (const key of ['calar.locationConsent', 'calar.hiddenRecommendations', 'calar.favorites', 'calar.region', 'calar.mileageGoal', 'calar.guideSeen']) localStorage.removeItem(key);
        window.dispatchEvent(new CustomEvent('calar-location-consent', { detail: { accepted: null } }));
        window.dispatchEvent(new CustomEvent('calar-notification-settings', { detail: { enabled: false } }));
      }
      localStorage.setItem('calar.customerId', String(data.user.id));
      saveToken(data.token);
      rememberRole('customer');
      return data.user;
    }).finally(() => { pending = undefined; });
  }
  return pending;
}
