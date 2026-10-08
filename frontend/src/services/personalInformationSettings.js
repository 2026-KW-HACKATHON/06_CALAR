import api from './api';
import { ensureCustomerSession } from './customerSession';
export async function getPersonalInformationSettings() {
  await ensureCustomerSession();
  return (await api.get('/api/auth/personal-information-settings')).data;
}
export async function setPersonalInformationSettings(key, accepted) {
  await ensureCustomerSession();
  const { data } = await api.patch('/api/auth/personal-information-settings', { [key]: accepted });
  window.dispatchEvent(new CustomEvent('calar-personal-information-settings', { detail: data }));
  return data;
}
