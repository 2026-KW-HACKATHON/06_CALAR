import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import RecommendationCard from '../../components/recommendation/RecommendationCard';
import { getRecommendedStores } from '../../services/storeService';
import { ROUTES } from '../../constants/routes';
import useGeolocation from '../../hooks/useGeolocation';

const Recommendation = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const [stores, setStores] = useState([]);

  useEffect(() => {
    getRecommendedStores({ lat: latitude, lng: longitude }).then(setStores);
  }, [latitude, longitude]);

  return (
    <div>
      <Header title="오늘의 동네 추천" showBackButton />

      {stores.map((store) => (
        <RecommendationCard
          key={store.id}
          store={store}
          userLocation={{ latitude, longitude }}
          onClick={(id) => navigate(ROUTES.storeDetail(id))}
        />
      ))}
    </div>
  );
};

export default Recommendation;
