const express = require('express');
const cors = require('cors');
const storesRouter = require('./routes/stores');
const ordersRouter = require('./routes/orders');
const HttpError = require('./utils/httpError');

const app = express();

app.use(cors()); // 프론트(다른 포트)에서 호출 허용
app.use(express.json()); // JSON body -> req.body (최대 100kb)

app.get('/',(req,res) => {
    res.send('06_CALAR 백엔드 서버 동작 중.');
});

app.use('/api/stores', storesRouter);
app.use('/api/orders', ordersRouter);

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
