// 업로드된 파일의 앞부분 바이트(매직 넘버)를 직접 읽어 진짜 이미지인지, 가로·세로가 얼마인지 확인한다.
// 클라이언트가 알려주는 Content-Type(mimetype)은 얼마든지 속일 수 있어서 믿지 않는다.
// 지원 형식: jpeg, png, webp (그 외 형식이나 깨진 헤더는 null)

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// JPEG에서 가로·세로가 들어있는 SOF(Start Of Frame) 마커들
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function pngInfo(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegInfo(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // 채움(fill) 바이트
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2; // 길이 없는 마커
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // SOF 전에 이미지 끝/본문 시작 → 깨진 파일

    const length = buf.readUInt16BE(i + 2);
    if (length < 2) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (i + 9 > buf.length) return null;
      return { type: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + length;
  }
  return null;
}

function webpInfo(buf) {
  if (buf.length < 16) return null;
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;

  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8 ' && buf.length >= 30) {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    if (buf[20] !== 0x2f) return null;
    const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]];
    return {
      type: 'webp',
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X' && buf.length >= 30) {
    return { type: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}

// Buffer → { type, width, height } 또는 null
function getImageInfo(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  const info = pngInfo(buf) ?? jpegInfo(buf) ?? webpInfo(buf);
  if (!info || info.width < 1 || info.height < 1) return null;
  return info;
}

module.exports = { getImageInfo };
