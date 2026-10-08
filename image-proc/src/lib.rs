//! CALAR image-proc: 간판 사진 전처리
//!
//! 백엔드(Node.js)는 이 크레이트를 WebAssembly로 빌드한 `pkg/calar_imgproc.wasm`을 불러
//! OCR(tesseract.js) 전에 사진을 정리한다. 자세한 내용은 README.md 참고.
//!
//! WebAssembly 함수 규약 (JS ↔ wasm, 모든 길이는 바이트)
//! - `calar_abi_version() -> u32`               규약 버전. 바뀌면 백엔드 래퍼도 같이 바꾼다
//! - `calar_alloc(len) -> ptr` / `calar_dealloc(ptr, len)`  입력 사진을 넣을 메모리
//! - `calar_preprocess(ptr, len) -> i32`         성공 시 결과 개수(2), 실패 시 -1
//! - `calar_output_ptr(i)`, `calar_output_len(i)` 결과 i번 (0: gray PGM, 1: binary PGM)
//! - `calar_info_ptr()`, `calar_info_len()`       처리 요약 JSON (크기, EXIF 방향, 채널, 반전 여부)
//! - `calar_error_ptr()`, `calar_error_len()`     실패 사유 문자열
//! - `calar_clear()`                              결과 메모리 해제

pub mod ops;
pub mod pipeline;

pub use pipeline::{preprocess, Channel, Error, Processed};

use std::cell::RefCell;

const ABI_VERSION: u32 = 2;

#[derive(Default)]
struct State {
    outputs: Vec<Vec<u8>>,
    info: String,
    error: String,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

#[no_mangle]
pub extern "C" fn calar_abi_version() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub extern "C" fn calar_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// # Safety
/// `ptr`, `len`은 `calar_alloc(len)`이 돌려준 값이어야 한다.
#[no_mangle]
pub unsafe extern "C" fn calar_dealloc(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len.max(1)));
}

/// # Safety
/// `ptr`부터 `len` 바이트가 읽을 수 있는 메모리여야 한다.
#[no_mangle]
pub unsafe extern "C" fn calar_preprocess(ptr: *const u8, len: usize) -> i32 {
    let input = std::slice::from_raw_parts(ptr, len);
    let result = preprocess(input);
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        *state = State::default();
        match result {
            Ok(out) => {
                state.info = out.info_json();
                state.outputs = vec![out.gray, out.binary];
                state.outputs.len() as i32
            }
            Err(err) => {
                state.error = err.to_string();
                -1
            }
        }
    })
}

#[no_mangle]
pub extern "C" fn calar_output_ptr(index: u32) -> *const u8 {
    STATE.with(|s| s.borrow().outputs.get(index as usize).map_or(std::ptr::null(), |o| o.as_ptr()))
}

#[no_mangle]
pub extern "C" fn calar_output_len(index: u32) -> usize {
    STATE.with(|s| s.borrow().outputs.get(index as usize).map_or(0, |o| o.len()))
}

#[no_mangle]
pub extern "C" fn calar_info_ptr() -> *const u8 {
    STATE.with(|s| s.borrow().info.as_ptr())
}

#[no_mangle]
pub extern "C" fn calar_info_len() -> usize {
    STATE.with(|s| s.borrow().info.len())
}

#[no_mangle]
pub extern "C" fn calar_error_ptr() -> *const u8 {
    STATE.with(|s| s.borrow().error.as_ptr())
}

#[no_mangle]
pub extern "C" fn calar_error_len() -> usize {
    STATE.with(|s| s.borrow().error.len())
}

#[no_mangle]
pub extern "C" fn calar_clear() {
    STATE.with(|s| *s.borrow_mut() = State::default());
}
