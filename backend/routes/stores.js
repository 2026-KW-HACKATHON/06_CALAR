const express = require('express');
const multer = require('multer');
const storeService = require('../services/storeService');
const orderService = require('../services/orderService');
const signRecognizer = require('../services/signRecognizer');
const HttpError = require('../utils/httpError');

const router = express.Router();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// 업로드된 사진은 디스크에 저장하지 않고 메모리(Buffer)로만 받는다
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new HttpError(400, 'Unsupported file type'));
    }
    cb(null, true);
  },
});

// lat/lng 쿼리 파싱. 둘 다 없으면 undefined, 숫자가 아니면 400
function parseLocation(query) {
  const location = {};
  for (const key of ['lat', 'lng']) {
    const raw = query[key];
    if (raw === undefined) continue;
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) {
      throw new HttpError(400, `Invalid query parameter: ${key}`);
    }
    location[key] = value;
  }
  return location;
}

// ⚠️ '/recommendations', '/recognize' 는 반드시 '/:id' 보다 위에 있어야 한다.
//    아래에 두면 "recommendations"가 가게 id로 인식돼버린다.

// 가게 목록 조회
router.get('/', (req, res) => {
  const { category, keyword } = req.query;
  const { lat, lng } = parseLocation(req.query);
  res.json(storeService.getAllStores({ category, keyword, lat, lng }));
});

// 오늘의 동네 추천 목록
router.get('/recommendations', (req, res) => {
  res.json(storeService.getRecommendedStores(parseLocation(req.query)));
});

// 간판 인식 (multipart/form-data, 필드명 image)
router.post('/recognize', upload.single('image'), async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, 'Image file is required');
  }

  // text 필드는 개발/테스트용: 보내면 OCR 대신 이 글자로 매칭한다
  const text = req.body?.text ?? (await signRecognizer.extractText(req.file.buffer));
  const stores = storeService.matchStoresByText(text);
  res.json({ matched: stores.length > 0, stores });
});

// 가게 상세 조회
router.get('/:id', (req, res) => {
  const store = storeService.getStoreById(req.params.id);
  if (!store) {
    throw new HttpError(404, 'Store not found');
  }
  res.json(store);
});

// 가게로 들어온 주문 목록 조회 (점주용)
router.get('/:id/orders', (req, res) => {
  res.json(orderService.getOrdersByStore(req.params.id, req.query.status));
});

module.exports = router;
