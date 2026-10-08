const app = require('./app');
const signRecognizer = require('./services/signRecognizer');

//port number
const PORT = Number(process.env.PORT) || 8008;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

app.listen(PORT, HOST, (err) => {
    if (err) {
        // Express 5는 포트 충돌 같은 실행 실패를 여기로 넘겨준다
        console.error(
            err.code === 'EADDRINUSE'
                ? `포트 ${PORT}번이 이미 사용 중입니다. 다른 서버를 끄거나 PORT=다른번호 npm start 로 실행하세요.`
                : err
        );
        process.exit(1);
    }
    console.log(`서버 실행됨: http://localhost:${PORT}`);
    signRecognizer.warmUp();
});
