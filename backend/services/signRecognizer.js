// 간판 사진 -> 글자 추출 (OCR)
//
// 임시 구현: tesseract.js(한국어+영어)로 사진 속 글자를 읽는다.
// 나중에 image-proc(C/Rust) 쪽 인식기가 완성되면 extractText 함수 내용만 바꾸면 되고,
// 라우트/매칭 로직(storeService.matchStoresByText)은 그대로 쓸 수 있다.
const { createWorker } = require('tesseract.js');

let workerPromise = null;

// OCR 워커는 만들 때 느리므로(언어 데이터 로딩) 처음 한 번만 만들고 재사용
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['kor', 'eng']).catch((err) => {
      workerPromise = null; // 실패하면 다음 요청 때 다시 시도
      throw err;
    });
  }
  return workerPromise;
}

// 이미지 Buffer를 받아 인식된 글자(string)를 돌려준다
async function extractText(imageBuffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBuffer);
  return data.text;
}

module.exports = { extractText };
