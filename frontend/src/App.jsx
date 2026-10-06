import { Routes, Route } from 'react-router-dom';
import { ROUTES } from './constants/routes';

import Home from './pages/customer/Home';
import Camera from './pages/customer/Camera';
import StoreDetail from './pages/customer/StoreDetail';
import Order from './pages/customer/Order';
import Recommendation from './pages/customer/Recommendation';

import OwnerHome from './pages/owner/OwnerHome';
import OwnerOrderManage from './pages/owner/OwnerOrderManage';

const App = () => {
  return (
    <Routes>
      {/* 고객용 */}
      <Route path={ROUTES.home} element={<Home />} />
      <Route path={ROUTES.camera} element={<Camera />} />
      <Route path={ROUTES.storeDetailPath} element={<StoreDetail />} />
      <Route path={ROUTES.orderPath} element={<Order />} />
      <Route path={ROUTES.recommendation} element={<Recommendation />} />

      {/* 점주용 */}
      <Route path={ROUTES.ownerHomePath} element={<OwnerHome />} />
      <Route path={ROUTES.ownerOrderManagePath} element={<OwnerOrderManage />} />
    </Routes>
  );
};

export default App;
