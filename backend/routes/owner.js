const express = require('express');
const auth = require('./auth');
const managementService = require('../services/managementService');
const orderService = require('../services/orderService');
const HttpError = require('../utils/httpError');
const { parseId, optionalQueryString } = require('../utils/validate');

const router = express.Router();
router.use(auth.requireUser, auth.requireRole('owner'));

function idParam(req, key) {
  const id = parseId(req.params[key]);
  if (!id) throw new HttpError(404, 'Resource not found');
  return id;
}

router.get('/dashboard', (req, res) => res.json(managementService.getOwnerDashboard(req.user)));
router.patch('/profile', (req, res) => res.json({ user: managementService.updateProfile(req.user.id, req.body) }));
router.get('/categories', (req, res) => res.json(managementService.listCategories()));

router.get('/stores', (req, res) => res.json(managementService.listStores(req.user)));
router.post('/stores', (req, res) => res.status(201).json(managementService.createStore(req.user, req.body)));
router.get('/stores/:storeId', (req, res) => {
  const storeId = idParam(req, 'storeId');
  const store = managementService.listStores(req.user).find((entry) => entry.id === storeId);
  if (!store) throw new HttpError(404, 'Store not found');
  res.json(store);
});
router.patch('/stores/:storeId', (req, res) => res.json(managementService.updateStore(req.user, idParam(req, 'storeId'), req.body)));
router.delete('/stores/:storeId', (req, res) => {
  managementService.deleteStore(req.user, idParam(req, 'storeId'));
  res.status(204).end();
});

router.get('/stores/:storeId/menus', (req, res) => res.json(managementService.listMenus(req.user, idParam(req, 'storeId'))));
router.post('/stores/:storeId/menus', (req, res) => res.status(201).json(managementService.createMenu(req.user, idParam(req, 'storeId'), req.body)));
router.patch('/stores/:storeId/menus/:menuId', (req, res) => res.json(managementService.updateMenu(req.user, idParam(req, 'storeId'), idParam(req, 'menuId'), req.body)));
router.delete('/stores/:storeId/menus/:menuId', (req, res) => {
  managementService.deleteMenu(req.user, idParam(req, 'storeId'), idParam(req, 'menuId'));
  res.status(204).end();
});

router.get('/stores/:storeId/coupons', (req, res) => res.json(managementService.listCoupons(req.user, idParam(req, 'storeId'))));
router.post('/stores/:storeId/coupons', (req, res) => res.status(201).json(managementService.createCoupon(req.user, idParam(req, 'storeId'), req.body)));
router.patch('/stores/:storeId/coupons/:couponId', (req, res) => res.json(managementService.updateCoupon(req.user, idParam(req, 'storeId'), idParam(req, 'couponId'), req.body)));
router.delete('/stores/:storeId/coupons/:couponId', (req, res) => {
  managementService.deleteCoupon(req.user, idParam(req, 'storeId'), idParam(req, 'couponId'));
  res.status(204).end();
});

router.get('/stores/:storeId/orders', (req, res) => {
  const status = optionalQueryString(req.query, 'status');
  res.json(managementService.ownerOrders(req.user, idParam(req, 'storeId'), status));
});
router.patch('/orders/:orderId/status', (req, res) => {
  const orderId = idParam(req, 'orderId');
  managementService.assertOrderAccess(req.user, orderId);
  res.json(orderService.updateOrderStatus(orderId, req.body));
});

module.exports = router;