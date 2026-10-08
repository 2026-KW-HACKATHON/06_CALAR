# image-proc — 간판 사진 전처리 (Rust → WebAssembly)

> 작성: 2026-10-08

간판 사진을 OCR(tesseract.js)이 읽기 좋은 형태로 정리하는 모듈임. 백엔드의 간판 인식 API(`POST /api/stores/recognize`)가 사용함.

- Rust로 작성하고 **WebAssembly(`pkg/calar_imgproc.wasm`)로 빌드한 결과물을 저장소에 포함**함.
  - 팀원 개발 환경(Windows)과 운영 서버(Ubuntu) 모두 C/Rust 컴파일러 없이 `npm install && npm start`만으로 동작함.
  - 외부 함수 호출(import)이 없는 순수 계산 모듈이라 파일 시스템·네트워크에 접근할 수 없음.
- 백엔드의 OCR 전용 자식 프로세스(`backend/services/ocrProcess.js`) 안에서 실행됨. 이상한 사진으로 문제가 생겨도 메인 서버는 영향 없음.
- wasm 파일이 없거나 사진을 해석하지 못하면 원본 사진을 예전 방식으로 읽음 (기능 저하만 있고 오류는 없음).

---

## 1. 처리 단계

| 단계 | 내용 | 해결하는 문제 |
|---|---|---|
| 1. 디코딩 | JPEG / PNG / WebP (순수 Rust 디코더) | - |
| 2. EXIF 회전 보정 | 사진 속 방향 정보대로 세움 | 휴대폰이 픽셀은 눕혀 저장하고 "돌려서 보여줘"만 기록한 사진. tesseract.js는 빅엔디언(아이폰식) EXIF만 읽고 리틀엔디언(안드로이드식)은 무시함 |
| 3. 투명 배경 합성 | 투명 부분을 흰색으로 | PNG 투명 배경이 검게 읽히는 문제 |
| 4. 크기 정규화 | 긴 변 1600px 초과 시 축소, 1000px 미만 시 확대(최대 3배) | 큰 사진에서 OCR이 수십 초 걸리는 문제, 작은 글자 인식 |
| 5. 흑백 채널 선택 | 휘도와 색 주성분(PCA) 중 글자/바탕이 더 잘 나뉘는 쪽 (Otsu 분리도 비교) | 빨강 바탕 초록 글씨처럼 밝기는 같고 색만 다른 간판 |
| 6. 명암 늘리기 + 3x3 중간값 필터 | 하위·상위 0.5%를 0·255로 펼치고 점 잡음 제거 | 흐린 날·역광, 센서 잡음 |
| 7. 극성 정규화 | 글자를 검게, 바탕을 희게. 주변 창과 비교해 판단 | 흰 글씨 간판. 사진 전체 밝기로 판단하면 그림자에 속음 |
| 8. 조명 평탄화 | 바탕 밝기를 추정(최댓값 필터 + 평균)해 나눔 | 간판 한쪽에 진 그림자, 밝기 기울기 |
| 9. Sauvola 적응형 이진화 + 작은 점 제거 | 지역 평균·표준편차로 흑백 결정 후 잡음 덩어리 삭제 | 남은 잡음을 OCR이 글자로 읽으며 시간을 크게 쓰는 문제 |

- 결과: `gray`(8단계까지), `binary`(9단계) 두 장. 압축 없는 PGM 형식이라 인코딩 비용이 거의 없고 tesseract가 바로 읽음.
- 영상 처리 알고리즘(PCA, Otsu, Sauvola, 중간값·최댓값 필터, 연결 요소 제거 등)은 `src/ops.rs`에 외부 라이브러리 없이 직접 구현함. 이미지 디코딩만 `image` 크레이트를 사용함.

## 2. 백엔드에서 읽는 순서

`ocrProcess.js`가 사진 1장을 전처리한 뒤 아래 순서로 읽음. **가게가 매칭되면 그 자리에서 멈춤** (`signRecognizer.extractText`의 `until`).

| 순서 | 이미지 | tesseract 페이지 분할(psm) |
|---|---|---|
| 1 | binary | 3 (자동 레이아웃) |
| 2 | binary | 11 (흩어진 글자 찾기 — 거리 사진 속 작은 간판) |
| 3 | gray | 3 |
| 4 | binary | 6 (한 덩어리 글자) |

- 매칭되는 가게가 없는 사진(다른 가게 간판 등)만 4번 모두 읽음.
- 30초 제한(`OCR_TIMEOUT_MS`)은 전처리와 모든 순서를 합친 시간 기준임.

## 3. 측정 결과

**기존**: 원본 사진을 이진화 2종(Otsu, 적응형)으로 읽음, 30초 제한 (운영과 동일 조건)
**새 방식**: image-proc 전처리 + 위 순서(조기 종료)

| 사진 세트 | 기존 정답 | 새 방식 정답 | 기존 평균 / 최대 시간 | 새 방식 평균 / 최대 시간 |
|---|---|---|---|---|
| 원본 간판 9장 (`backend/test/fixtures/signs`) | 9/9 | 9/9 | 1.0초 / 1.8초 | 1.2초 / 1.7초 |
| 튜닝 세트 54장 | 16/54 (30초 초과 21건) | 54/54 | 18.4초 / 31.4초 | 1.7초 / 6.1초 |
| **검증 세트 54장 (튜닝에 사용 안 함)** | **20/54 (30초 초과 19건)** | **51/54** | 16.6초 / 31.3초 | 1.4초 / 3.6초 |

검증 세트 종류별 (기존 → 새 방식, 각 9장)

| 흐림·잡음·저화질 | EXIF 회전 | 거리 사진 속 원근 왜곡 | 멀리서 찍은 작은 간판 | 그림자·저대비 | 색만 다른 간판 |
|---|---|---|---|---|---|
| 7 → 9 | 3 → 9 | 0 → 9 | 0 → 6 | 3 → 9 | 7 → 9 |

- 정답 기준: 가게 간판은 해당 가게만, 다른 가게 간판(`x_`)은 매칭 없음. 다른 가게 간판의 오인식은 두 방식 모두 0건.
- 시간은 8코어 PC에서 7개를 동시에 돌린 값이라 단독 실행보다 느리게 나옴.
- 기존 방식의 적응형 이진화는 잡음 많은 사진에서 한 번에 10~20초 이상 걸려 30초 제한(504)에 자주 걸림. 새 방식은 잡음을 미리 제거하므로 이 문제가 없음.

**⚠️ 한계**
- 세 세트 모두 원본 간판 9장을 프로그램으로 망가뜨린 **합성 사진**임 (`examples/make_hard_fixtures.rs`). 실제 휴대폰 사진으로는 아직 검증하지 않음. 데모 전에 아래 5장 방법으로 실제 사진 확인 필요.
- 검증 세트에서 틀린 3장은 모두 "멀리서 찍은 작은 간판"임 (3000x2250 사진 속 가로 30% 크기). 간판 영역을 찾아 잘라내는 기능은 없음.
- 읽는 순서(2장)는 튜닝 세트로 고른 것이라 튜닝 세트 54/54는 과적합된 값임. 검증 세트 결과를 기준으로 판단해야 함.

## 4. 빌드

Rust 코드를 수정했을 때만 필요함. 백엔드는 `pkg/calar_imgproc.wasm`을 읽으므로 **빌드 후 이 파일도 함께 커밋**해야 함.

```bash
rustup target add wasm32-unknown-unknown   # 최초 1회
node image-proc/scripts/build-wasm.cjs     # → image-proc/pkg/calar_imgproc.wasm (약 640KB)
```

- JS ↔ wasm 함수 규약은 `src/lib.rs` 상단 주석 참고. 규약을 바꾸면 `ABI_VERSION`과 `backend/services/imageProc.js`의 `ABI_VERSION`을 같이 올림 (다르면 백엔드가 wasm을 쓰지 않고 예전 방식으로 동작함).
- 다른 위치의 wasm을 시험하려면 환경변수 `IMAGE_PROC_WASM`에 경로 지정.

## 5. 테스트와 검증

```bash
cd image-proc && cargo test                 # Rust 단위 테스트 (알고리즘, 디코딩, 회전, 투명 배경, 깨진 입력)
cd backend && npm test                      # 백엔드 전체 (wasm 래퍼, 합성 사진 인식, wasm 없을 때 대체 동작 포함)
```

**실제 휴대폰 사진 인식률 확인**
1. 사진을 한 폴더에 모으고 파일 이름을 가게 번호로 시작하게 저장함. 예: `3_햇살미용실_정면.jpg`, `3_햇살미용실_비스듬히.jpg`
2. 다른 가게 간판(매칭되면 안 되는 사진)은 `x_`로 시작하게 저장함. 예: `x_편의점.jpg`
3. 실행:
   ```bash
   cd backend
   npm run evaluate:signs -- ../간판사진폴더
   ```
4. 사진별 인식 결과·시간과 정답률이 출력됨. 가게 목록은 서버 DB(`CALAR_DB_PATH`, 기본 `backend/06_calar.sqlite`)를 사용함.
   - 인식이 안 되는 가게는 사진 문제보다 `signKeywords`(간판에 실제 쓰인 단어)가 부족한 경우가 많음.

**합성 사진 세트 만들기** (측정 재현용)
```bash
cd image-proc
cargo run --release --example make_hard_fixtures -- ../backend/test/fixtures/signs target/hard        # 튜닝 세트
cargo run --release --example make_hard_fixtures -- ../backend/test/fixtures/signs target/holdout 7   # 검증 세트 (시드 7)
```
- 만든 세트에 `cd backend && npm run evaluate:signs -- ../image-proc/target/holdout`을 실행하면 새 방식의 정답률·시간을 재현할 수 있음 (파일 이름이 가게 번호/`x_`로 시작함).
- 그중 작은 4장은 백엔드 회귀 테스트용으로 `backend/test/fixtures/signs-hard/`에 포함함.

## 6. 사용한 오픈소스

| 크레이트 | 용도 | 라이선스 |
|---|---|---|
| [image](https://github.com/image-rs/image) | JPEG/PNG/WebP 디코딩, EXIF 방향, 크기 조절 | MIT OR Apache-2.0 |
| zune-jpeg, png, image-webp, flate2, miniz_oxide 등 (image가 사용) | 각 형식 디코더 | MIT / Apache-2.0 / Zlib / BSD-3-Clause 중 택일 |

- 전체 목록: `cargo tree -e normal --target wasm32-unknown-unknown --format "{p} {l}"`
