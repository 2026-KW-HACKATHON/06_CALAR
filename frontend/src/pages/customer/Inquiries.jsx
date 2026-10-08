import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import InquiryChat from '../../components/InquiryChat';

export default function Inquiries() {
  const location = useLocation();
  const navigate = useNavigate();
  const back = () => navigate(location.state?.returnTo || '/customer', { replace: true });
  return <div className="screen inquiry-screen"><Header title="문의하기" showBackButton onBack={back} />
    <main className="inquiry-screen__body"><InquiryChat /></main>
  </div>;
}
