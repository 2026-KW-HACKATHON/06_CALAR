const express = require('express');
const multer = require('multer');
const storeService = require('../services/storeService');
const orderService = require('../services/orderService');
const signRecognizer = require('../services/signRecognizer');
const HttpError = require('../utils/httpError');
const { getImageInfo } = require('../utils/imageInfo');
const { parseId, optionalQueryString, parseLocation } = require('../utils/validate');
const auth = require('./auth');
const managementService = require('../services/managementService');

const router = express.Router();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_PIXELS = 50 * 1000 * 1000; // 5천만 화소. 파일은 작아도 해상도가 거대한 이미지(압축 폭탄) 방지

// 업로드된 사진은 디스크에 저장하지 않고 메모리(Buffer)로만 받는다
// 형식 검사는 여기서(mimetype) 하지 않고, 받은 뒤 파일 내용으로 직접 한다 (utils/imageInfo.js)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 10, fieldSize: 10 * 1024, parts: 20 },
}).single('image');

// multer 에러를 명세 형식의 에러로 바꿔주는 래퍼
function uploadImage(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'File too large'));
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return next(new HttpError(400, "Send exactly one image file in the 'image' field"));
      }
    }
    next(new HttpError(400, 'Invalid multipart body')); // 경계(boundary)가 깨진 요청 등
  });
}

// ⚠️ '/recommendations', '/recognize' 는 반드시 '/:id' 보다 위에 있어야 한다.
//    아래에 두면 "recommendations"가 가게 id로 인식돼버린다.

// 가게 목록 조회
router.get('/', (req, res) => {
  const category = optionalQueryString(req.query, 'category');
  const keyword = optionalQueryString(req.query, 'keyword');
  const { lat, lng } = parseLocation(req.query);
  res.json(storeService.getAllStores({ category, keyword, lat, lng }));
});

// 오늘의 동네 추천 목록
router.get('/recommendations', (req, res) => {
  res.json(storeService.getRecommendedStores(parseLocation(req.query)));
});

// 간판 인식 (multipart/form-data, 필드명 image)
router.post('/recognize', uploadImage, async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, 'Image file is required');
  }

  const info = getImageInfo(req.file.buffer);
  if (!info) {
    throw new HttpError(400, 'Unsupported file type');
  }
  if (info.width * info.height > MAX_IMAGE_PIXELS) {
    throw new HttpError(413, 'Image dimensions too large');
  }

  // text 필드는 개발/테스트용: 글자를 보내면 OCR 대신 이 글자로 매칭한다 (비어 있으면 OCR 실행)
  const override = req.body?.text;
  if (override !== undefined && typeof override !== 'string') {
    throw new HttpError(400, 'text must be a single string');
  }
  const text = override?.trim() ? override : await signRecognizer.extractText(req.file.buffer);

  const stores = storeService.matchStoresByText(text);
  res.json({ matched: stores.length > 0, stores });
});

// 가게 상세 조회 (GET만 방문수 집계. HEAD 요청이나 같은 사용자의 반복 조회는 세지 않음)
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  const visitorKey = req.method === 'GET' ? `${req.ip}|${req.get('user-agent') ?? ''}` : undefined;
  const store = id && storeService.getStoreById(id, { visitorKey });
  if (!store) {
    throw new HttpError(404, 'Store not found');
  }
  res.json(store);
});

// 가게로 들어온 주문 목록 조회 (점주용)
router.get('/:id/orders', auth.requireUser, auth.requireRole('owner', 'admin'), (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    throw new HttpError(404, 'Store not found');
  }
  const status = optionalQueryString(req.query, 'status');
  res.json(req.user.role === 'admin'
    ? orderService.getOrdersByStore(id, status)
    : managementService.ownerOrders(req.user, id, status));
});

module.exports = router;
