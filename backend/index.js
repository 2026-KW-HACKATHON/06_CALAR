const express = require('express');

const app = express();

//port number
const PORT = 3000;

app.get('/',(req,res) => {
    res.send('06_CALAR 백엔드 서버 동작 중.');
});

app.listen(PORT,() => {
    console.log(`서버 실행됨: https://localhost:${PORT}`);
});

