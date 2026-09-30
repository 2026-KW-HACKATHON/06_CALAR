const express = require('express');
const storeService = require('./services/storeService');

const app = express();

//port number
const PORT = 3000;

app.get('/',(req,res) => {
    res.send('06_CALAR 백엔드 서버 동작 중.');
});

// 가게 목록 조회
app.get('/api/stores', (req, res) => {
    const { category, keyword } = req.query;
    let lat;
    let lng;

    for (const key of ['lat', 'lng']) {
        const raw = req.query[key];
        if (raw === undefined) continue;
        const value = Number(raw);
        if (raw === '' || Number.isNaN(value)) {
            return res.status(400).json({ error: `Invalid query parameter: ${key}` });
        }
        if (key === 'lat') lat = value;
        else lng = value;
    }

    res.json(storeService.getAllStores({ category, keyword, lat, lng }));
});

// 가게 상세 조회
app.get('/api/stores/:id', (req, res) => {
    const store = storeService.getStoreById(req.params.id);

    if (!store) {
        return res.status(404).json({ error: 'Store not found' });
    }
    res.json(store);
});

app.listen(PORT,() => {
    console.log(`서버 실행됨: http://localhost:${PORT}`);
});

