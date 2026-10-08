import Header from '../../components/common/Header';
import { useNavigate } from 'react-router-dom';
import BigButton from '../../components/common/BigButton';
import SettingsSwitches from '../../components/customer/SettingsSwitches';
import ThemeSwitch from '../../components/customer/ThemeSwitch';
// Future settings use { id, title, content } entries.
const SETTINGS_SECTIONS = [];
export default function Settings() {
  const navigate = useNavigate();
  return <div className="screen"><Header title="설정" /><main className="screen__body">
    <SettingsSwitches />
    <ThemeSwitch />
    <section className="stack"><h2 className="section-title">이용 역할</h2><BigButton variant="secondary" icon="switch_account" onClick={() => navigate('/roles')}>역할 선택</BigButton></section>
    {SETTINGS_SECTIONS.length ? SETTINGS_SECTIONS.map((section) => <section className="stack" key={section.id}><h2>{section.title}</h2>{section.content}</section>)
      : null}
  </main></div>;
}
