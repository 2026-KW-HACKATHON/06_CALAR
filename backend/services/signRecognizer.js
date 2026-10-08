// 간판 사진 -> 글자 추출 (OCR)
//
// image-proc(Rust → WebAssembly)로 사진을 정리한 뒤 tesseract.js(한국어+영어)로 글자를 읽는다.
// 전처리와 OCR은 자식 프로세스(ocrProcess.js)에서 돌리고, 여기서는 그 프로세스를 관리한다.
// 한 장을 여러 방식으로 읽되(pass), 읽을 때마다 until(지금까지 글자)로 확인해 충분하면 멈춘다.
const path = require('path');
const { fork } = require('child_process');
const HttpError = require('../utils/httpError');

// 환경변수로 바꿀 수 있는 설정 (보통은 기본값 그대로 쓰면 된다)
// - OCR_INIT_TIMEOUT_MS: OCR 프로세스 준비(언어 데이터 로딩) 시간 제한
// - OCR_TIMEOUT_MS: 사진 1장 인식 시간 제한 (전처리 + 모든 pass 합계)
// - OCR_LANG_PATH: 언어 데이터 위치(URL/폴더). 기본은 npm으로 설치된 @tesseract.js-data 패키지
const INIT_TIMEOUT_MS = Number(process.env.OCR_INIT_TIMEOUT_MS) || 30 * 1000;
const RECOGNIZE_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 30 * 1000;
const MAX_PENDING_JOBS = 5; // 대기 포함 최대 동시 요청 수. 넘으면 503

let current = null; // 지금 쓰는 OCR 프로세스 { proc, ready, job }
let pendingJobs = 0;
let queue = Promise.resolve(); // 한 번에 한 장씩 처리하도록 줄 세우기

// 코드가 붙은 에러 (OCR_IMAGE: 이 사진을 못 읽음 / OCR_PROCESS: 프로세스 문제)
function ocrError(code, message) {
  return Object.assign(new Error(message), { code });
}

// promise가 ms 안에 끝나지 않으면 onTimeout()이 만든 에러로 reject
function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// OCR 프로세스를 새로 띄운다
function spawnProcess() {
  const proc = fork(path.join(__dirname, 'ocrProcess.js'), [], { serialization: 'advanced' });
  const state = { proc, job: null };

  state.ready = new Promise((resolve, reject) => {
    proc.on('message', (msg) => {
      if (msg?.type === 'ready') return resolve();
      const job = state.job;
      if (!job) return;
      state.job = null;
      if (msg?.type === 'error') job.reject(ocrError('OCR_IMAGE', msg.message));
      else job.resolve(msg);
    });
    proc.on('error', (err) => {
      console.error('[OCR] 프로세스 오류:', err);
      reject(err);
      proc.kill('SIGKILL');
    });
    proc.on('exit', (code, signal) => {
      const err = ocrError('OCR_PROCESS', `OCR process exited (${signal ?? code})`);
      reject(err);
      if (state.job) {
        state.job.reject(err);
        state.job = null;
      }
      if (current === state) current = null;
    });
  });
  state.ready.catch(() => {}); // 아무도 안 기다릴 때 unhandled rejection 방지
  return state;
}

function getProcess() {
  if (!current) current = spawnProcess();
  return current;
}

// 멈췄거나 이상한 프로세스는 강제 종료 (다음 요청 때 새로 띄움)
function killProcess(state) {
  if (current === state) current = null;
  state.proc.kill('SIGKILL');
}

// OCR 프로세스에 메시지 하나를 보내고 답을 기다린다 (deadline까지 안 오면 504)
function ask(state, message, deadline) {
  const job = new Promise((resolve, reject) => {
    state.job = { resolve, reject };
    state.proc.send(message, (err) => {
      if (err && state.job) {
        state.job = null;
        reject(ocrError('OCR_PROCESS', err.message));
      }
    });
  });
  return withTimeout(job, Math.max(deadline - Date.now(), 0), () => new HttpError(504, 'Sign recognition timed out'));
}

// 사진 1장 인식 (queue를 통해 한 번에 하나씩만 실행됨)
async function recognizeOnce(imageBuffer, until) {
  const state = getProcess();

  try {
    await withTimeout(state.ready, INIT_TIMEOUT_MS, () => ocrError('OCR_PROCESS', 'OCR init timeout'));
  } catch (err) {
    console.error('[OCR] 준비 실패:', err.message);
    killProcess(state);
    throw new HttpError(503, 'Sign recognition is temporarily unavailable');
  }

  const deadline = Date.now() + RECOGNIZE_TIMEOUT_MS;
  try {
    const { passes } = await ask(state, { type: 'prepare', image: imageBuffer }, deadline);
    let text = '';
    for (let index = 0; index < passes; index += 1) {
      const result = await ask(state, { type: 'pass', index }, deadline);
      text = text ? `${text}\n${result.text}` : result.text;
      if (until?.(text)) break;
    }
    return text;
  } catch (err) {
    if (err.code === 'OCR_IMAGE') {
      throw new HttpError(400, 'Invalid image file'); // 헤더는 정상인데 내용이 깨진 이미지 등
    }
    killProcess(state); // 시간 초과 / 프로세스가 죽음 → 버리고 다음에 새로 띄운다
    if (err instanceof HttpError) throw err;
    console.error('[OCR] 인식 중 프로세스 오류:', err.message);
    throw new HttpError(500, 'Sign recognition failed');
  }
}

// 이미지 Buffer를 받아 인식된 글자(string)를 돌려준다
// until(text): 지금까지 읽은 글자로 충분하면 true → 남은 pass를 건너뛴다 (예: 가게가 매칭됨)
async function extractText(imageBuffer, { until } = {}) {
  if (pendingJobs >= MAX_PENDING_JOBS) {
    throw new HttpError(503, 'Sign recognition is busy, please try again');
  }

  pendingJobs += 1;
  const job = queue.then(() => recognizeOnce(imageBuffer, until));
  queue = job.catch(() => {}); // 앞 요청이 실패해도 다음 요청은 계속 처리
  try {
    return await job;
  } finally {
    pendingJobs -= 1;
  }
}

// 서버 시작 시 미리 OCR 프로세스를 띄워 둔다 (첫 요청이 느리지 않게)
function warmUp() {
  const state = getProcess();
  withTimeout(state.ready, INIT_TIMEOUT_MS, () => new Error('timeout'))
    .then(() => console.log('간판 인식(OCR) 준비 완료'))
    .catch((err) => {
      console.error('간판 인식(OCR) 준비 실패 — 첫 인식 요청 때 다시 시도합니다:', err.message);
      killProcess(state);
    });
}

// OCR 프로세스 종료 (테스트 종료 시 사용)
async function shutdown() {
  const state = current;
  current = null;
  if (!state || state.proc.exitCode !== null || state.proc.signalCode !== null) return;
  const exited = new Promise((resolve) => state.proc.once('exit', resolve));
  state.proc.kill('SIGKILL');
  await exited;
}

module.exports = { extractText, warmUp, shutdown };
