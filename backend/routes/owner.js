const express = require('express');
const auth = require('./auth');
const managementService = require('../services/managementService');
const orderService = require('../services/orderService');
const HttpError = require('../utils/httpError');
const { parseId, optionalQueryString } = require('../utils/validate');

const router = express.Router();
router.use(auth.requireUser, auth.requireRole('owner'));
const photoService = require('../services/photoService');
const videoService = require('../services/videoService');
const videoUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0 } }).single('video');
const upload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }).single('image');
function photoAccess(req, res, next) {
  managementService.assertStoreAccess(req.user, idParam(req, 'storeId'));
  next();
}
function uploadPhoto(req, res, next) {
  upload(req, res, (error) => {
    if (error) return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, '사진 한 장(10MB 이하)을 선택해 주세요.'));
    next();
  });
}
router.post(['/stores/:storeId/videos', '/stores/:storeId/menus/:menuId/video'], photoAccess, (req, res, next) => {
  videoUpload(req, res, (error) => {
    if (error) return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, '동영상 한 개(50MB 이하)를 선택해 주세요.'));
    next();
  });
}, (req, res) => res.status(201).json(videoService.save(idParam(req, 'storeId'), req.params.menuId ? idParam(req, 'menuId') : null, req.file)));
router.delete('/stores/:storeId/videos/:uuid', photoAccess, (req, res) => {
  videoService.remove(idParam(req, 'storeId'), req.params.uuid); res.status(204).end();
});
router.post(['/stores/:storeId/photos', '/stores/:storeId/menus/:menuId/photo'], photoAccess, uploadPhoto, (req, res) => {
  res.status(201).json(photoService.save(idParam(req, 'storeId'), req.params.menuId ? idParam(req, 'menuId') : null, req.file));
});
router.post('/stores/:storeId/portrait', photoAccess, uploadPhoto, (req, res) => res.status(201).json(photoService.save(idParam(req, 'storeId'), null, req.file, true)));
router.delete('/stores/:storeId/photos/:uuid', photoAccess, (req, res) => {
  photoService.remove(idParam(req, 'storeId'), req.params.uuid);
  res.status(204).end();
});

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
