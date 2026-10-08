// image-proc(WebAssembly) 전처리 래퍼 테스트: 결과 형식, EXIF 회전, 깨진 입력, 오류 뒤 재사용
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const imageProc = require('../services/imageProc');
const { corruptPng } = require('./helpers');

const fixture = (...parts) => fs.readFileSync(path.join(__dirname, 'fixtures', ...parts));
const pgmHeader = (buf) => buf.subarray(0, buf.indexOf(0x0a)).toString('latin1');

test('간판 사진 → gray/binary PGM과 처리 요약', () => {
  for (const file of ['1_kalguksu.png', '2_laundry.jpg', '3_salon.webp']) {
    const out = imageProc.preprocess(fixture('signs', file));
    assert.equal(pgmHeader(out.gray), 'P5 1200 400 255', file);
    assert.equal(pgmHeader(out.binary), 'P5 1200 400 255', file);
    assert.equal(out.gray.length, 'P5 1200 400 255\n'.length + 1200 * 400);
    assert.equal(out.info.orientation, 1);
    assert.ok(['luma', 'pca'].includes(out.info.channel));
  }
  // 흰 글자 + 짙은 빨강 바탕 → 반전해서 검은 글자로 맞춘다
  assert.equal(imageProc.preprocess(fixture('signs', '1_kalguksu.png')).info.inverted, true);
});

test('EXIF 회전(안드로이드식 리틀엔디언)을 적용해 바로 세운다', () => {
  // 픽셀은 세로(400x1200)로 눕혀 저장, EXIF Orientation=6
  const out = imageProc.preprocess(fixture('signs-hard', '2_laundry__exif.jpg'));
  assert.equal(out.info.orientation, 6);
  assert.deepEqual([out.info.width, out.info.height], [1200, 400]);
});

test('이미지가 아니거나 깨진 파일은 ImageProcError, 그 뒤에도 정상 동작', () => {
  assert.throws(() => imageProc.preprocess(Buffer.from('hello')), imageProc.ImageProcError);
  assert.throws(() => imageProc.preprocess(corruptPng()), imageProc.ImageProcError);
  assert.throws(() => imageProc.preprocess(Buffer.alloc(0)), imageProc.ImageProcError);
  assert.equal(pgmHeader(imageProc.preprocess(fixture('signs', '4_banchan.png')).gray), 'P5 1200 400 255');
});
