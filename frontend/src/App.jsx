import { Routes, Route, Navigate } from 'react-router-dom';
import { getRole } from './services/session';
import OwnerGuard from './components/OwnerGuard';
import OwnerLogin from './pages/owner/OwnerLogin';
import OwnerRegister from './pages/owner/OwnerRegister';
import OwnerStoreRegister from './pages/owner/OwnerStoreRegister';
import Admin from './pages/Admin';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import { ROUTES } from './constants/routes';

import Home from './pages/customer/Home';
import Wallet from './pages/customer/Wallet';
import MyOrders from './pages/customer/MyOrders';
import MyInfo from './pages/customer/MyInfo';
import CustomerLayout from './components/CustomerLayout';
import PaymentResult from './pages/customer/PaymentResult';
import RoleSelect from './pages/RoleSelect';
import OwnerStoreSelect from './pages/owner/OwnerStoreSelect';
import Camera from './pages/customer/Camera';
import StoreDetail from './pages/customer/StoreDetail';
import Order from './pages/customer/Order';
import Recommendation from './pages/customer/Recommendation';

import OwnerHome from './pages/owner/OwnerHome';
import OwnerMenuManage from './pages/owner/OwnerMenuManage';
import OwnerOrderManage from './pages/owner/OwnerOrderManage';

const App = () => {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      {/* 고객용 */}
      <Route path={ROUTES.home} element={getRole() === 'customer' ? <Navigate to={ROUTES.customerHome} replace /> : getRole() === 'owner' ? <Navigate to={ROUTES.ownerSelect} replace /> : <RoleSelect />} />
      <Route path="/roles" element={<RoleSelect />} />
      <Route path="/owner/login" element={<OwnerLogin />} />
      <Route path="/owner/register" element={<OwnerRegister />} />
      <Route element={<CustomerLayout />}>
      <Route path={ROUTES.customerHome} element={<Home />} />
      <Route path="/customer/me" element={<MyInfo />} />
      <Route path="/customer/wallet" element={<Wallet />} />
      <Route path="/customer/orders" element={<MyOrders />} />
      <Route path="/customer/payment-result" element={<PaymentResult />} />
      <Route path={ROUTES.camera} element={<Camera />} />
      <Route path={ROUTES.storeDetailPath} element={<StoreDetail />} />
      <Route path={ROUTES.orderPath} element={<Order />} />
      <Route path={ROUTES.recommendation} element={<Recommendation />} />
      </Route>

      {/* 점주용 */}
      <Route element={<OwnerGuard />}>
        <Route path="/owner/:storeId/menus" element={<OwnerMenuManage />} />
        <Route path="/owner/stores/new" element={<OwnerStoreRegister />} />
        <Route path={ROUTES.ownerSelect} element={<OwnerStoreSelect />} />
        <Route path={ROUTES.ownerHomePath} element={<OwnerHome />} />
        <Route path={ROUTES.ownerOrderManagePath} element={<OwnerOrderManage />} />
      </Route>
    </Routes>
  );
};

export default App;
