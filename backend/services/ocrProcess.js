// OCR 전용 자식 프로세스 (signRecognizer.js가 fork로 실행한다)
//
// 왜 따로 프로세스로 돌리나?
// tesseract.js는 (1) 인식 실패 시 에러를 한 번 더 throw 해 프로세스를 죽이거나
// (2) 언어 데이터 로딩에 실패하면 영원히 대기하는 문제가 있다 (라이브러리 내부 동작).
// 별도 프로세스로 분리하면 무슨 일이 생겨도 메인 서버는 멀쩡하고, 이 프로세스만 강제 종료 후 새로 띄우면 된다.
// image-proc(WebAssembly) 전처리도 여기서 돌리므로 같은 이유로 안전하다.
//
// 메인 서버와 주고받는 메시지 (사진 1장 = prepare 1번 + pass 여러 번)
//   받음: { type: 'prepare', image: Uint8Array }  → 보냄: { type: 'prepared', passes: 읽기 횟수 }
//   받음: { type: 'pass', index }                 → 보냄: { type: 'result', text }
//   그 외 보냄: { type: 'ready' } / { type: 'error', message }
// 메인 서버는 pass 결과마다 가게가 매칭되는지 보고, 매칭되면 남은 pass를 건너뛴다.
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const LANGS = ['kor', 'eng'];
const LANG_DIR = path.join(__dirname, '..', '.ocr-cache');

// image-proc 결과를 읽는 순서. 앞에서 가게가 매칭되면 메인 서버가 멈추므로 대부분 1~2번만 읽는다.
// 페이지 분할 방식(psm)마다 잘 읽는 사진이 달라서 섞는다 (image-proc/README.md 의 측정 결과)
// - 3: 자동 레이아웃 / 11: 흩어진 글자 찾기(거리 사진 속 작은 간판) / 6: 한 덩어리 글자
const PASSES = [
  { image: 'binary', psm: '3' },
  { image: 'binary', psm: '11' },
  { image: 'gray', psm: '3' },
  { image: 'binary', psm: '6' },
];
// image-proc를 쓸 수 없을 때(wasm 파일 없음, 디코딩 실패): 원본 사진을 이진화 방식 2가지로 읽는다 (예전 방식)
// - 0 (Otsu): 대부분 잘 읽지만 노란 바탕 + 검은 글씨 같은 조합은 못 읽음 / 1 (LeptonicaOtsu, 적응형): 그런 간판용
const FALLBACK_PASSES = [
  { image: 'original', psm: '6', thresholding: '0' },
  { image: 'original', psm: '6', thresholding: '1' },
];

let imageProc = null;
try {
  imageProc = require('./imageProc');
  imageProc.load();
} catch (err) {
  imageProc = null;
  console.error('[image-proc] 사용 안 함 (원본 사진으로만 인식):', err.message);
}

let prepared = null; // 지금 인식 중인 사진 { images, passes }

function prepare(image) {
  if (imageProc) {
    try {
      const { gray, binary } = imageProc.preprocess(image);
      return { images: { gray, binary }, passes: PASSES };
    } catch (err) {
      console.error('[image-proc] 전처리 실패, 원본으로 인식:', err.message);
    }
  }
  return { images: { original: image }, passes: FALLBACK_PASSES };
}

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
  try {
    if (msg?.type === 'prepare') {
      prepared = prepare(Buffer.from(msg.image.buffer, msg.image.byteOffset, msg.image.byteLength));
      process.send({ type: 'prepared', passes: prepared.passes.length });
    } else if (msg?.type === 'pass') {
      const pass = prepared?.passes[msg.index];
      if (!pass) throw new Error(`No prepared pass ${msg.index}`);
      const worker = await workerPromise;
      await worker.setParameters({ tessedit_pageseg_mode: pass.psm, thresholding_method: pass.thresholding ?? '0' });
      const { data } = await worker.recognize(prepared.images[pass.image]);
      process.send({ type: 'result', text: data.text });
    }
  } catch (err) {
    process.send({ type: 'error', message: String(err) });
  }
});
