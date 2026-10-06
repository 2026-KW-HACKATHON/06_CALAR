import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import BigButton from '../../components/common/BigButton';
import { getStores } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';
import useGeolocation from '../../hooks/useGeolocation';

const Home = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const [stores, setStores] = useState([]);

  useEffect(() => {
    getStores({ lat: latitude, lng: longitude }).then(setStores);
  }, [latitude, longitude]);

  return (
    <div>
      <Header title="월계" />

      <BigButton label="간판 찍고 가게 찾기" onClick={() => navigate(ROUTES.camera)} />
      <BigButton label="오늘의 동네 추천 보기" onClick={() => navigate(ROUTES.recommendation)} />

      <h2>주변 가게</h2>
      <ul>
        {stores.map((store) => (
          <li key={store.id}>
            <button onClick={() => navigate(ROUTES.storeDetail(store.id))}>
              {store.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
