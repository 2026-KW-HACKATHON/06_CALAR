import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import { readTheme, setTheme } from '../../services/theme';
export default function ThemeSwitch() {
  const [theme, updateTheme] = useState(readTheme); const [notice, setNotice] = useState('');
  useEffect(() => { const changed = (event) => updateTheme(event.detail); window.addEventListener('calar-theme', changed); return () => window.removeEventListener('calar-theme', changed); }, []);
  return <section className="stack"><h2 className="section-title">화면 설정</h2><div className="settings-switch-row"><Icon name="dark_mode" /><div><h3>다크모드</h3><p>어두운 배경으로 편하게 보세요.</p></div><button type="button" className="settings-toggle" role="switch" aria-label="다크모드" aria-checked={theme === 'dark'} onClick={() => { const saved = setTheme(theme === 'dark' ? 'light' : 'dark'); setNotice(saved ? '' : '화면에 적용했어요. 이 브라우저에 저장하지 못했어요.'); }}><span className="settings-toggle__track"><span /></span><strong>{theme === 'dark' ? '켜짐' : '꺼짐'}</strong></button></div>{notice && <p role="status">{notice}</p>}</section>;
}
