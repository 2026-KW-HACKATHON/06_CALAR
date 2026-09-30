const express = require('express');
const cors = require('cors');
const multer = require('multer');
const storesRouter = require('./routes/stores');
const ordersRouter = require('./routes/orders');

const app = express();

//port number
const PORT = process.env.PORT || 3000;

app.use(cors()); // 프론트(다른 포트)에서 호출 허용
app.use(express.json()); // JSON body -> req.body

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
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large' });
        }
        return res.status(400).json({ error: `Image must be sent in 'image' field` });
    }
    if (err.status) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT,() => {
    console.log(`서버 실행됨: http://localhost:${PORT}`);
});
