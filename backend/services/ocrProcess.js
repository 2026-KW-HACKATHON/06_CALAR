// OCR 전용 자식 프로세스 (signRecognizer.js가 fork로 실행한다)
//
// 왜 따로 프로세스로 돌리나?
// tesseract.js는 (1) 인식 실패 시 에러를 한 번 더 throw 해 프로세스를 죽이거나
// (2) 언어 데이터 로딩에 실패하면 영원히 대기하는 문제가 있다 (라이브러리 내부 동작).
// 별도 프로세스로 분리하면 무슨 일이 생겨도 메인 서버는 멀쩡하고, 이 프로세스만 강제 종료 후 새로 띄우면 된다.
//
// 메인 서버와 주고받는 메시지
//   받음: { type: 'recognize', image: Uint8Array }
//   보냄: { type: 'ready' } / { type: 'result', text } / { type: 'error', message }
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const LANGS = ['kor', 'eng'];
const LANG_DIR = path.join(__dirname, '..', '.ocr-cache');

// 이진화(흑백 변환) 방식마다 잘 읽는 간판이 달라서 두 방식으로 읽고 결과를 합친다
// - 0 (Otsu, 기본): 대부분 잘 읽지만 노란 바탕 + 검은 글씨 같은 조합은 전혀 못 읽음
// - 1 (LeptonicaOtsu, 적응형): 그런 간판은 읽지만 다른 간판을 놓치기도 함
// 매칭은 키워드를 중복 없이 세므로 합쳐도 점수가 부풀지 않는다
const THRESHOLDING_METHODS = ['0', '1'];

// npm으로 설치된 언어 데이터(@tesseract.js-data/*)를 한 폴더에 모은다 (tesseract.js는 langPath 하나만 받음)
// → 실행 중에 인터넷에서 받을 일이 없다
function prepareLangDir() {
  fs.mkdirSync(LANG_DIR, { recursive: true });
  for (const lang of LANGS) {
    const src = require.resolve(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`);
    const dest = path.join(LANG_DIR, `${lang}.traineddata.gz`);
    if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(src).size) {
      const tmp = `${dest}.${process.pid}.tmp`;
      fs.copyFileSync(src, tmp);
      fs.renameSync(tmp, dest); // 복사 도중 종료돼도 반쪽 파일이 남지 않게
    }
  }
  return LANG_DIR;
}

// 메인 서버가 종료되면 같이 종료 (고아 프로세스 방지)
process.on('disconnect', () => process.exit(0));

const workerPromise = createWorker(LANGS, 1, {
  langPath: process.env.OCR_LANG_PATH || prepareLangDir(), // 환경변수로 다른 위치(URL/폴더) 지정 가능
  cacheMethod: 'none',
  // errorHandler가 없으면 인식 실패 때 tesseract.js가 에러를 다시 throw 해서 이 프로세스가 죽는다
  errorHandler: (err) => console.error('[OCR]', err),
});

workerPromise.then(
  async (worker) => {
    // "Estimating resolution..." 같은 tesseract 내부 로그 숨기기 (tesseract 가상 파일시스템 경로라 OS 무관)
    await worker.setParameters({ debug_file: '/dev/null' });
    process.send({ type: 'ready' });
  },
  (err) => {
    console.error('[OCR] 준비 실패:', err);
    process.exit(1); // 메인 서버가 종료를 감지하고 503으로 응답, 다음 요청 때 새로 띄운다
  }
);

process.on('message', async (msg) => {
  if (msg?.type !== 'recognize') return;
  try {
    const worker = await workerPromise;
    const image = Buffer.from(msg.image.buffer, msg.image.byteOffset, msg.image.byteLength);
    const texts = [];
    for (const method of THRESHOLDING_METHODS) {
      await worker.setParameters({ thresholding_method: method });
      const { data } = await worker.recognize(image);
      texts.push(data.text);
    }
    process.send({ type: 'result', text: texts.join('\n') });
  } catch (err) {
    process.send({ type: 'error', message: String(err) });
  }
});
