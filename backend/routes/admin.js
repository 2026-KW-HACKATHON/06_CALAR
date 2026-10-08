const express = require('express');
const auth = require('./auth');
const managementService = require('../services/managementService');
const HttpError = require('../utils/httpError');
const { parseId, optionalQueryString } = require('../utils/validate');

const router = express.Router();
router.use(auth.requireUser, auth.requireRole('admin'));

function idParam(req, key) {
  const id = parseId(req.params[key]);
  if (!id) throw new HttpError(404, 'Resource not found');
  return id;
}

router.get('/dashboard', (req, res) => res.json(managementService.dashboard()));
router.get('/users', (req, res) => res.json(managementService.listUsers()));
router.patch('/users/:userId', (req, res) => res.json(managementService.updateUser(idParam(req, 'userId'), req.body, req.user.id)));
router.delete('/users/:userId', (req, res) => {
  managementService.deleteUser(idParam(req, 'userId'), req.user.id);
  res.status(204).end();
});

router.get('/businesses', (req, res) => res.json(managementService.listBusinesses(optionalQueryString(req.query, 'status'))));
router.patch('/businesses/:registrationId', (req, res) => res.json(managementService.reviewBusiness(idParam(req, 'registrationId'), req.body)));

router.get('/stores', (req, res) => res.json(managementService.listStores(req.user)));
router.post('/stores', (req, res) => res.status(201).json(managementService.createStore(req.user, req.body, true)));
router.patch('/stores/:storeId', (req, res) => res.json(managementService.updateStore(req.user, idParam(req, 'storeId'), req.body, true)));
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

router.get('/categories', (req, res) => res.json(managementService.listCategories()));
router.post('/categories', (req, res) => res.status(201).json(managementService.createCategory(req.body)));
router.patch('/categories/:categoryId', (req, res) => res.json(managementService.updateCategory(idParam(req, 'categoryId'), req.body)));
router.delete('/categories/:categoryId', (req, res) => {
  managementService.deleteCategory(idParam(req, 'categoryId'));
  res.status(204).end();
});

module.exports = router;