// image-proc(Rust → WebAssembly) 간판 사진 전처리 래퍼
//
// image-proc/pkg/calar_imgproc.wasm 을 불러 OCR 전에 사진을 정리한다 (EXIF 회전, 크기, 채널 선택, 반전, 조명 평탄화, 이진화).
// OCR 프로세스(ocrProcess.js) 안에서만 쓰므로 wasm에서 문제가 생겨도 메인 서버는 영향이 없다.
// 컴파일러 없이 어떤 OS에서도 동작하도록 빌드된 .wasm 파일을 저장소에 함께 둔다 (빌드 방법: image-proc/README.md)
const fs = require('fs');
const path = require('path');

// IMAGE_PROC_WASM: 다른 위치의 wasm 파일을 쓰고 싶을 때 (테스트·개발용)
const WASM_PATH = process.env.IMAGE_PROC_WASM || path.join(__dirname, '..', '..', 'image-proc', 'pkg', 'calar_imgproc.wasm');
const ABI_VERSION = 2; // image-proc/src/lib.rs 의 ABI_VERSION 과 같아야 한다
const VARIANTS = ['gray', 'binary'];
// 큰 사진을 처리하면 wasm 메모리가 커진 채로 남는다 → 이보다 크면 인스턴스를 버리고 새로 만든다
const MAX_RETAINED_MEMORY = 256 * 1024 * 1024;

let wasmModule = null;
let instance = null;

class ImageProcError extends Error {}

function load() {
  if (!wasmModule) {
    wasmModule = new WebAssembly.Module(fs.readFileSync(WASM_PATH));
  }
  return wasmModule;
}

function getInstance() {
  if (!instance) {
    const created = new WebAssembly.Instance(load(), {});
    const version = created.exports.calar_abi_version();
    if (version !== ABI_VERSION) {
      throw new Error(`image-proc ABI version mismatch (wasm ${version}, backend ${ABI_VERSION})`);
    }
    instance = created;
  }
  return instance;
}

function readBytes(exports, ptr, len) {
  // memory.buffer는 wasm 메모리가 커지면 새 객체로 바뀌므로 매번 다시 읽고, 결과는 복사해서 돌려준다
  return Buffer.from(new Uint8Array(exports.memory.buffer, ptr, len));
}

// 사진 Buffer → { info, gray, binary } (gray/binary는 PGM Buffer)
// 이미지가 아니거나 깨졌으면 ImageProcError
function preprocess(imageBuffer) {
  const wasm = getInstance();
  const { exports } = wasm;
  const len = imageBuffer.length;
  let inputPtr = 0;
  try {
    inputPtr = exports.calar_alloc(len);
    new Uint8Array(exports.memory.buffer, inputPtr, len).set(imageBuffer);
    const count = exports.calar_preprocess(inputPtr, len);
    if (count < 0) {
      throw new ImageProcError(readBytes(exports, exports.calar_error_ptr(), exports.calar_error_len()).toString());
    }
    const result = {
      info: JSON.parse(readBytes(exports, exports.calar_info_ptr(), exports.calar_info_len()).toString()),
    };
    VARIANTS.forEach((name, i) => {
      result[name] = readBytes(exports, exports.calar_output_ptr(i), exports.calar_output_len(i));
    });
    return result;
  } catch (err) {
    if (!(err instanceof ImageProcError)) instance = null; // wasm 내부 오류(trap) 뒤에는 상태를 믿을 수 없다
    throw err;
  } finally {
    if (instance === wasm) {
      exports.calar_dealloc(inputPtr, len);
      exports.calar_clear();
      if (exports.memory.buffer.byteLength > MAX_RETAINED_MEMORY) instance = null;
    }
  }
}

module.exports = { preprocess, load, ImageProcError, WASM_PATH };
