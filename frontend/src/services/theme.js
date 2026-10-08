const KEY = 'calar.theme';
export function readTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}
export function applyTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'dark' ? '#171512' : '#B4400F');
  return value;
}
export function setTheme(theme) {
  const value = applyTheme(theme); let saved = true;
  try { localStorage.setItem(KEY, value); } catch { saved = false; }
  window.dispatchEvent(new CustomEvent('calar-theme', { detail: value }));
  return saved;
}
export function initializeTheme() {
  applyTheme(readTheme());
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) {
      const value = applyTheme(readTheme());
      window.dispatchEvent(new CustomEvent('calar-theme', { detail: value }));
    }
  });
}
