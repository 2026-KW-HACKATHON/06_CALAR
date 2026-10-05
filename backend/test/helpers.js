// 테스트 공용 함수: 서버 띄우기, 요청 보내기, 테스트용 이미지 만들기
const zlib = require('zlib');
const { once } = require('events');

// 테스트용 서버를 빈 포트에 띄운다
async function startServer() {
  const app = require('../app');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  // 요청 보내고 { status, body(JSON이면 객체), headers } 반환
  async function request(method, path, { json, body, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };
    if (json !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(json);
    } else if (body !== undefined) {
      init.body = body;
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON이 아니면 글자 그대로
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }

  async function close() {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }

  return { base, request, close };
}

// 간판 인식 요청용 FormData
function imageForm(buffer, { filename = 'sign.png', type = 'image/png', field = 'image', text } = {}) {
  const form = new FormData();
  if (buffer) form.append(field, new Blob([buffer], { type }), filename);
  if (text !== undefined) {
    for (const t of [].concat(text)) form.append('text', t);
  }
  return form;
}

// ---------- 테스트용 이미지 ----------

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function pngHeader(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
  ]);
}

// 흰색 PNG (진짜로 열리는 이미지)
function whitePng(width = 200, height = 60) {
  const raw = Buffer.alloc((width + 1) * height, 255);
  for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0; // 각 줄 filter byte
  return Buffer.concat([
    pngHeader(width, height),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// 헤더(가로·세로)는 정상인데 내용이 깨진 PNG
function corruptPng(width = 100, height = 100) {
  return Buffer.concat([
    pngHeader(width, height),
    pngChunk('IDAT', Buffer.from('this is not deflate data at all')),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// JPEG 헤더만 (SOI + APP0 + 채움 바이트 + SOF0)
function jpegHeader(width, height) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof0 = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, Buffer.from([0xff]), sof0]);
}

// WebP 헤더만 (VP8 / VP8L / VP8X)
function webpHeader(kind, width, height) {
  const riff = (chunk) => {
    const head = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
    head.writeUInt32LE(4 + chunk.length, 4);
    return Buffer.concat([head, chunk]);
  };
  if (kind === 'VP8 ') {
    const c = Buffer.alloc(8 + 10);
    c.write('VP8 ', 0, 'latin1');
    c.writeUInt32LE(10, 4);
    c.set([0x9d, 0x01, 0x2a], 11);
    c.writeUInt16LE(width, 14);
    c.writeUInt16LE(height, 16);
    return riff(c);
  }
  if (kind === 'VP8L') {
    const c = Buffer.alloc(8 + 5);
    c.write('VP8L', 0, 'latin1');
    c.writeUInt32LE(5, 4);
    c[8] = 0x2f;
    const bits = (width - 1) | ((height - 1) << 14);
    c.writeUInt32LE(bits >>> 0, 9);
    return riff(c);
  }
  const c = Buffer.alloc(8 + 10);
  c.write('VP8X', 0, 'latin1');
  c.writeUInt32LE(10, 4);
  c.writeUIntLE(width - 1, 12, 3);
  c.writeUIntLE(height - 1, 15, 3);
  return riff(c);
}

module.exports = { startServer, imageForm, whitePng, corruptPng, pngHeader, jpegHeader, webpHeader };
