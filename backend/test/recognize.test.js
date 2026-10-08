// 간판 인식 API 테스트: 업로드 검증, 매칭(text), 실제 OCR, 깨진 이미지에도 서버가 살아있는지

// OCR 프로세스를 테스트에서 강제 종료할 수 있게, signRecognizer가 불러가기 전에 fork를 감싸둔다
const childProcess = require('child_process');
const spawned = [];
const originalFork = childProcess.fork;
childProcess.fork = (...args) => {
  const proc = originalFork(...args);
  spawned.push(proc);
  return proc;
};

const test = require('node:test');
const assert = require('node:assert/strict');
const signRecognizer = require('../services/signRecognizer');
const { startServer, imageForm, whitePng, corruptPng, pngHeader, jpegHeader, webpHeader } = require('./helpers');

let server;
test.before(async () => {
  server = await startServer();
});
test.after(async () => {
  await server.close();
  await signRecognizer.shutdown();
});

const recognize = (body, headers) => server.request('POST', '/api/stores/recognize', { body, headers });

async function expectError(res, status, error) {
  const r = await res;
  assert.equal(r.status, status, JSON.stringify(r.body));
  assert.deepEqual(r.body, { error });
}

test('text 필드로 매칭 (OCR 없이)', async () => {
  const res = await recognize(imageForm(whitePng(), { text: '월계 손칼국수' }));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { matched: true, stores: [{ id: 1, name: '월계 손칼국수' }] });

  const miss = await recognize(imageForm(whitePng(), { text: '월계부동산' }));
  assert.deepEqual(miss.body, { matched: false, stores: [] });

  await expectError(recognize(imageForm(whitePng(), { text: ['월계', '칼국수'] })), 400, 'text must be a single string');
});

test('업로드 검증: 파일 누락·형식·용량·해상도', async () => {
  await expectError(recognize(), 400, 'Image file is required');
  await expectError(server.request('POST', '/api/stores/recognize', { json: { image: 'x' } }), 400, 'Image file is required');
  const textOnly = new FormData();
  textOnly.append('image', 'not a file');
  await expectError(recognize(textOnly), 400, 'Image file is required');

  // 형식은 mimetype이 아니라 파일 내용으로 판단
  await expectError(recognize(imageForm(Buffer.from('hello'), { type: 'image/png' })), 400, 'Unsupported file type');
  await expectError(recognize(imageForm(Buffer.alloc(0), { type: 'image/png' })), 400, 'Unsupported file type');
  await expectError(
    recognize(imageForm(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0mif1heic', 'latin1'), { type: 'image/heic', filename: 'a.heic' })),
    400,
    'Unsupported file type'
  );

  // 파일은 작지만 해상도가 거대한 이미지 (압축 폭탄) → OCR 전에 차단
  await expectError(recognize(imageForm(pngHeader(30000, 30000))), 413, 'Image dimensions too large');
  await expectError(recognize(imageForm(jpegHeader(10000, 6000), { type: 'image/jpeg' })), 413, 'Image dimensions too large');
  // 헤더만 있는 정상 해상도 JPEG/WebP는 형식 검사를 통과 (text로 OCR 생략)
  for (const [buf, type] of [[jpegHeader(4000, 3000), 'image/jpeg'], [webpHeader('VP8X', 1280, 960), 'image/webp']]) {
    assert.equal((await recognize(imageForm(buf, { type, text: '햇살 미용실' }))).status, 200);
  }

  const big = Buffer.concat([whitePng(), Buffer.alloc(10 * 1024 * 1024)]);
  await expectError(recognize(imageForm(big)), 413, 'File too large');
});

test('업로드 검증: multipart 형식 오류', async () => {
  const wrongField = imageForm(whitePng(), { field: 'photo' });
  await expectError(recognize(wrongField), 400, "Send exactly one image file in the 'image' field");

  const two = imageForm(whitePng());
  two.append('image', new Blob([whitePng()], { type: 'image/png' }), 'b.png');
  await expectError(recognize(two), 400, "Send exactly one image file in the 'image' field");

  const broken = '--XYZ\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\n\r\npartial';
  await expectError(
    recognize(broken, { 'content-type': 'multipart/form-data; boundary=XYZ' }),
    400,
    'Invalid multipart body'
  );
});

test('실제 OCR: 흰 이미지는 매칭 없음, 공백 text는 OCR 실행', async () => {
  const res = await recognize(imageForm(whitePng()));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { matched: false, stores: [] });

  const blankText = await recognize(imageForm(whitePng(), { text: '   ' }));
  assert.deepEqual(blankText.body, { matched: false, stores: [] });
});

test('실제 OCR: 간판 사진 인식 (png/jpg/webp, 기울기, 노란 바탕)', async () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, 'fixtures', 'signs');
  const expected = {
    '1_kalguksu.png': [1],
    '1_kalguksu_tilt.jpg': [1],
    '2_laundry.jpg': [2],
    '3_salon.webp': [3],
    '4_banchan.png': [4],
    '5_cafe.png': [5],
    // 다른 가게 간판 → 매칭 없어야 함
    'x_other_kalguksu.png': [],
    'x_realestate.png': [],
    'x_starbucks.png': [],
  };
  const types = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
  for (const [file, ids] of Object.entries(expected)) {
    const type = types[file.split('.').pop()];
    const res = await recognize(imageForm(fs.readFileSync(path.join(dir, file)), { type, filename: file }));
    assert.equal(res.status, 200, file);
    assert.deepEqual(res.body.stores.map((s) => s.id), ids, file);
    assert.equal(res.body.matched, ids.length > 0, file);
  }
});

test('실제 OCR: 휴대폰 사진 조건 (EXIF 회전, 흐림·잡음·저화질, 색만 다른 간판)', async () => {
  // 가게 간판 3장은 image-proc 없이 원본만 읽던 예전 방식으로는 매칭하지 못했던 사진,
  // 마지막 장은 예전 방식으로 24초 걸리던 사진 (image-proc/examples/make_hard_fixtures.rs 로 만든 합성 사진,
  // 측정 결과는 image-proc/README.md)
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, 'fixtures', 'signs-hard');
  const expected = {
    '2_laundry__exif.jpg': [2], // 눕혀 저장 + 리틀엔디언 EXIF 회전 정보
    '3_salon__blur.jpg': [3], // 흔들림 + 잡음 + JPEG 저화질
    '1_kalguksu__isolum.png': [1], // 글자와 바탕 밝기가 같고 색만 다름
    'x_starbucks__blur.jpg': [], // 망가진 사진이어도 다른 가게 간판은 매칭 안 됨
  };
  for (const [file, ids] of Object.entries(expected)) {
    const type = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const res = await recognize(imageForm(fs.readFileSync(path.join(dir, file)), { type, filename: file }));
    assert.equal(res.status, 200, file);
    assert.deepEqual(res.body.stores.map((s) => s.id), ids, file);
  }
});

test('실제 OCR: 내용이 깨진 이미지 → 400, 서버와 OCR은 계속 동작', async () => {
  await expectError(recognize(imageForm(corruptPng())), 400, 'Invalid image file');
  await expectError(recognize(imageForm(corruptPng(), { type: 'application/octet-stream' })), 400, 'Invalid image file');

  assert.equal((await server.request('GET', '/api/stores')).status, 200);
  const after = await recognize(imageForm(whitePng()));
  assert.equal(after.status, 200);
});

test('인식 도중 OCR 프로세스가 죽으면 500, 다음 요청은 새 프로세스로 정상 처리', async () => {
  await signRecognizer.extractText(whitePng()); // 프로세스 준비
  const before = spawned.length;
  const victim = spawned[spawned.length - 1];

  const job = signRecognizer.extractText(whitePng());
  victim.kill('SIGKILL');
  await assert.rejects(job, { status: 500, message: 'Sign recognition failed' });

  assert.equal(typeof (await signRecognizer.extractText(whitePng())), 'string');
  assert.equal(spawned.length, before + 1); // 새로 띄움
});

test('동시에 너무 많이 요청하면 503 (대기열 상한 5)', async () => {
  const jobs = Array.from({ length: 5 }, () => signRecognizer.extractText(whitePng()));
  await assert.rejects(signRecognizer.extractText(whitePng()), {
    status: 503,
    message: 'Sign recognition is busy, please try again',
  });
  const texts = await Promise.all(jobs); // 앞의 5개는 순서대로 정상 처리
  assert.equal(texts.length, 5);
  assert.equal(typeof (await signRecognizer.extractText(whitePng())), 'string'); // 끝나면 다시 받음
});
