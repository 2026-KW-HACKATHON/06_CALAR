// 상태 코드를 담은 에러. throw 하면 index.js의 에러 핸들러가 { error: message } 형태로 응답한다.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = HttpError;
