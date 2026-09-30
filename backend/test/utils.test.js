// 유틸/서비스 단위 테스트 (서버 없이 함수만)
const test = require('node:test');
const assert = require('node:assert/strict');
const { getImageInfo } = require('../utils/imageInfo');
const { parseId, parseLocation, optionalQueryString } = require('../utils/validate');
const { parseLocalDateTime, toMinutes } = require('../utils/time');
const { isOpenAt, matchStoresByText } = require('../services/storeService');
const { whitePng, pngHeader, jpegHeader, webpHeader } = require('./helpers');

test('getImageInfo: 형식과 가로·세로를 파일 내용으로 읽는다', () => {
  assert.deepEqual(getImageInfo(whitePng(200, 60)), { type: 'png', width: 200, height: 60 });
  assert.deepEqual(getImageInfo(pngHeader(30000, 30000)), { type: 'png', width: 30000, height: 30000 });
  assert.deepEqual(getImageInfo(jpegHeader(4000, 3000)), { type: 'jpeg', width: 4000, height: 3000 });
  assert.deepEqual(getImageInfo(webpHeader('VP8 ', 640, 480)), { type: 'webp', width: 640, height: 480 });
  assert.deepEqual(getImageInfo(webpHeader('VP8L', 1000, 700)), { type: 'webp', width: 1000, height: 700 });
  assert.deepEqual(getImageInfo(webpHeader('VP8X', 5000, 4000)), { type: 'webp', width: 5000, height: 4000 });
});

test('getImageInfo: 이미지가 아니거나 깨진 헤더는 null', () => {
  assert.equal(getImageInfo(Buffer.alloc(0)), null);
  assert.equal(getImageInfo(Buffer.from('hello world, this is text')), null);
  assert.equal(getImageInfo(pngHeader(100, 100).subarray(0, 20)), null); // 잘린 PNG
  assert.equal(getImageInfo(pngHeader(0, 100)), null); // 가로 0
  assert.equal(getImageInfo(jpegHeader(0, 100)), null);
  assert.equal(getImageInfo(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02])), null); // SOF 없이 본문
  assert.equal(getImageInfo(jpegHeader(100, 100).subarray(0, 25)), null); // 잘린 JPEG
  // HEIC(아이폰 사진), GIF는 미지원
  assert.equal(getImageInfo(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0mif1heic', 'latin1')), null);
  assert.equal(getImageInfo(Buffer.from('GIF89a\x01\0\x01\0', 'latin1')), null);
  assert.equal(getImageInfo('not a buffer'), null);
});

test('parseId: 양의 정수 문자열만 허용', () => {
  assert.equal(parseId('1'), 1);
  assert.equal(parseId('42'), 42);
  for (const bad of ['0', '-1', '1.0', '0x1', '1e0', '01', ' 1', 'abc', '', '99999999999999999999', undefined]) {
    assert.equal(parseId(bad), null, `parseId(${bad})`);
  }
});

test('parseLocation: lat/lng는 함께, 숫자, 범위 안', () => {
  assert.deepEqual(parseLocation({}), {});
  assert.deepEqual(parseLocation({ lat: '37.62', lng: '127.06' }), { lat: 37.62, lng: 127.06 });
  assert.deepEqual(parseLocation({ lat: '-33.9', lng: '-151' }), { lat: -33.9, lng: -151 });
  const bad = [
    { lat: '37.62' },
    { lng: '127.06' },
    { lat: 'abc', lng: '127' },
    { lat: '', lng: '127' },
    { lat: '0x10', lng: '127' },
    { lat: '1e2', lng: '127' },
    { lat: 'Infinity', lng: '127' },
    { lat: '91', lng: '127' },
    { lat: '37', lng: '181' },
    { lat: ['1', '2'], lng: '127' },
  ];
  for (const query of bad) {
    assert.throws(() => parseLocation(query), { status: 400 }, JSON.stringify(query));
  }
});

test('optionalQueryString: 공백은 없는 것으로, 배열은 400', () => {
  assert.equal(optionalQueryString({}, 'a'), undefined);
  assert.equal(optionalQueryString({ a: '  ' }, 'a'), undefined);
  assert.equal(optionalQueryString({ a: ' 음식점 ' }, 'a'), '음식점');
  assert.throws(() => optionalQueryString({ a: ['x', 'y'] }, 'a'), { status: 400 });
});

test('parseLocalDateTime: 실제로 있는 날짜·시각만', () => {
  assert.deepEqual(parseLocalDateTime('2026-10-08T12:30'), {
    minutesOfDay: 750,
    epochMs: Date.UTC(2026, 9, 8, 3, 30), // KST 12:30 = UTC 03:30
  });
  assert.ok(parseLocalDateTime('2028-02-29T00:00')); // 윤년
  for (const bad of [
    '2026-02-29T12:00', // 윤년 아님
    '2026-02-30T12:00',
    '2026-13-01T12:00',
    '2026-00-10T12:00',
    '2026-10-32T12:00',
    '2026-10-08T24:00',
    '2026-10-08T12:60',
    '2026-10-08 12:30',
    '2026-10-8T12:30',
    '2026-10-08T12:30:00',
    '2026-10-08T12:30Z',
    20261008,
    null,
  ]) {
    assert.equal(parseLocalDateTime(bad), null, String(bad));
  }
});

test('toMinutes: 24:00은 허용, 없는 시각은 null', () => {
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('24:00'), 1440);
  for (const bad of ['24:01', '25:00', '12:60', '9:00', 'ab:cd', '']) {
    assert.equal(toMinutes(bad), null, bad);
  }
});

test('isOpenAt: 일반·자정 넘김·24시간·잘못된 형식', () => {
  const at = (h, m = 0) => h * 60 + m;
  // 11:00-21:00 → 11:00 포함, 21:00 미포함
  assert.equal(isOpenAt('11:00-21:00', at(10, 59)), false);
  assert.equal(isOpenAt('11:00-21:00', at(11)), true);
  assert.equal(isOpenAt('11:00-21:00', at(20, 59)), true);
  assert.equal(isOpenAt('11:00-21:00', at(21)), false);
  // 자정 넘김
  assert.equal(isOpenAt('18:00-02:00', at(17, 59)), false);
  assert.equal(isOpenAt('18:00-02:00', at(23)), true);
  assert.equal(isOpenAt('18:00-02:00', at(1, 59)), true);
  assert.equal(isOpenAt('18:00-02:00', at(2)), false);
  // 자정까지
  assert.equal(isOpenAt('10:00-24:00', at(23, 59)), true);
  assert.equal(isOpenAt('10:00-24:00', at(0)), false);
  // 24시간
  assert.equal(isOpenAt('00:00-00:00', at(3)), true);
  assert.equal(isOpenAt('00:00-24:00', at(3)), true);
  // 잘못된 형식은 영업 안 함으로
  for (const bad of ['', 'abc', '11:00', '11:00-21:00-22:00', '25:00-26:00', '24:00-10:00', null]) {
    assert.equal(isOpenAt(bad, at(12)), false, String(bad));
  }
});

test('matchStoresByText: 정확한 간판은 매칭', () => {
  const ids = (text) => matchStoresByText(text).map((s) => s.id);
  assert.deepEqual(ids('월계 손칼국수'), [1]);
  assert.deepEqual(ids('월계손칼국수'), [1]);
  assert.deepEqual(ids('월계·손 칼국수!!'), [1]); // 특수문자·띄어쓰기
  assert.deepEqual(ids('월계 칼국수'), [1]); // 이름 일부 + 키워드 2개
  assert.deepEqual(ids('새마을\n세탁소'), [2]); // OCR 줄바꿈
  assert.deepEqual(ids('햇살 미용실'), [3]);
  assert.deepEqual(ids('월계 반찬'), [4]);
  assert.deepEqual(ids('모퉁이 카페'), [5]);
  assert.deepEqual(ids('월계 손칼국수'.normalize('NFD')), [1]); // 자모 분리된 한글(NFD)
});

test('matchStoresByText: 흔한 단어만 보이는 다른 가게 간판은 매칭 안 함', () => {
  for (const text of [
    '월계부동산', // 동네 이름만
    '스타벅스 카페', // 업종만
    '엄마손칼국수', // '손칼국수' + 그 안의 '칼국수' → 1개로 취급
    '행복세탁소',
    '새마을금고',
    '월계 세탁 편의점',
    '',
    '   ',
    '!!!',
  ]) {
    assert.deepEqual(matchStoresByText(text), [], text);
  }
});
