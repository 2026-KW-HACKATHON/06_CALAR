const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const storesRouter = require('./routes/stores');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth').router;
const ownerRouter = require('./routes/owner');
const adminRouter = require('./routes/admin');
const HttpError = require('./utils/httpError');

const app = express();
app.set('trust proxy', 'loopback');

app.use(cors()); // 프론트(다른 포트)에서 호출 허용
app.use(express.json()); // JSON body -> req.body (최대 100kb)

const frontendBuild = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendBuild)) app.use(express.static(frontendBuild, {
    setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
    },
}));
app.get('/health', (req, res) => res.send('06_CALAR 백엔드 서버 동작 중.'));

app.use('/api/stores', storesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', authRouter);
app.use('/api/owner', ownerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', require('./routes/payments'));
app.get('/mobile/payment-result', (req, res) => {
    const target = new URL('calar://payment-result');
    for (const key of ['paymentId', 'outcome', 'pg_token']) {
        if (typeof req.query[key] === 'string') target.searchParams.set(key, req.query[key]);
    }
    res.set('Cache-Control', 'no-store');
    res.redirect(target.toString());
});
app.get(['/roles', '/admin', '/reset-password', '/verify-email', '/owner', '/owner/login', '/owner/register', '/owner/stores/new', '/owner/:storeId', '/owner/:storeId/menus', '/owner/:storeId/order/:orderId', '/customer', '/customer/me', '/customer/payment-result', '/customer/wallet', '/customer/orders', '/camera', '/recommendation', '/store/:storeId', '/store/:storeId/order'], (req, res, next) => {
    if (!fs.existsSync(path.join(frontendBuild, 'index.html'))) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendBuild, 'index.html'));
});

// 없는 주소
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// 에러 핸들러: 모든 에러를 { error: "메시지" } 형태로 응답
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large' });
    }
    // 그 밖의 4xx (예: 주소의 %인코딩이 깨짐, 지원 안 하는 charset)
    const status = err?.status ?? err?.statusCode;
    if (Number.isInteger(status) && status >= 400 && status < 500) {
        return res.status(status).json({ error: err.message || 'Bad request' });
    }
    // 진짜 서버 오류: 내부 메시지는 숨기고 로그만 남긴다
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
