import api from './api';
import { ensureCustomerSession } from './customerSession';
import { savePreference } from '../utils/discoveryPreferences';
let pending;
function publish(data) {
  savePreference('calar.locationConsent', data.accepted);
  window.dispatchEvent(new CustomEvent('calar-location-consent', { detail: data }));
  return data;
}
export function getLocationConsent() {
  if (!pending) pending = ensureCustomerSession().then(() => api.get('/api/auth/location-consent')).then(({ data }) => publish(data)).finally(() => { pending = null; });
  return pending;
}
export async function setLocationConsent(accepted) {
  await getLocationConsent();
  const { data } = await api.patch('/api/auth/location-consent', { accepted });
  return publish(data);
}
