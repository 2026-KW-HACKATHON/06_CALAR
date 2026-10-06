import { useNavigate } from 'react-router-dom';

const Header = ({ title, showBackButton = false }) => {
  const navigate = useNavigate();

  return (
    <header>
      {showBackButton && <button onClick={() => navigate(-1)}>뒤로</button>}
      <h1>{title}</h1>
    </header>
  );
};

export default Header;
