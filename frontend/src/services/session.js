const ROLE_KEY = 'calar.role';
const TOKEN_KEY = 'calar.ownerToken';

export const getRole = () => localStorage.getItem(ROLE_KEY);
export const rememberRole = (role) => localStorage.setItem(ROLE_KEY, role);
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
