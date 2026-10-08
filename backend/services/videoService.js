const { randomUUID } = require('node:crypto');
const db = require('../db');
const HttpError = require('../utils/httpError');
const { transaction } = require('./transaction');

function videoType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  // Require a complete MP4 box structure with file type, movie metadata and media data.
  let offset = 0;
  const boxes = new Set();
  while (offset + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > buffer.length) return null;
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(buffer.length)) return null;
      size = Number(large); header = 16;
    }
    if (size === 0) size = buffer.length - offset;
    if (size < header || offset + size > buffer.length) break;
    boxes.add(type); offset += size;
  }
  if (offset === buffer.length && ['ftyp', 'moov', 'mdat'].every((type) => boxes.has(type))) return 'video/mp4';
  // EBML header, WebM document type, segment and track metadata.
  if (buffer.length > 32 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
      buffer.includes(Buffer.from('webm')) && buffer.includes(Buffer.from([0x18, 0x53, 0x80, 0x67])) &&
      buffer.includes(Buffer.from([0x16, 0x54, 0xae, 0x6b]))) return 'video/webm';
  return null;
}
function list(storeId, menuId = null) {
  return db.prepare('SELECT uuid FROM store_videos WHERE store_id = ? AND menu_id IS ? ORDER BY video_id').all(storeId, menuId)
    .map(({ uuid }) => ({ uuid, url: `/api/photos/${uuid}`, kind: 'video' }));
}
function save(storeId, menuId, file) {
  if (menuId !== null && !db.prepare('SELECT menu_id FROM menus WHERE menu_id = ? AND store_id = ? AND deleted_at IS NULL').get(menuId, storeId)) throw new HttpError(404, 'Menu not found');
  const type = videoType(file?.buffer);
  if (!type) throw new HttpError(400, 'MP4 또는 WEBM 동영상을 선택해 주세요.');
  return transaction(() => {
    if (menuId === null && list(storeId).length >= 3) throw new HttpError(409, '매장 동영상은 최대 3개까지 등록할 수 있어요.');
    if (menuId !== null) db.prepare('DELETE FROM store_videos WHERE store_id = ? AND menu_id = ?').run(storeId, menuId);
    const uuid = randomUUID();
    db.prepare('INSERT INTO store_videos(uuid, store_id, menu_id, mime_type, content) VALUES (?, ?, ?, ?, ?)').run(uuid, storeId, menuId, type, file.buffer);
    return { uuid, url: `/api/photos/${uuid}`, kind: 'video' };
  });
}
function remove(storeId, uuid) {
  if (!db.prepare('DELETE FROM store_videos WHERE store_id = ? AND uuid = ?').run(storeId, uuid).changes) throw new HttpError(404, 'Video not found');
}
module.exports = { list, save, remove, videoType };
