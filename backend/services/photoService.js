const { randomUUID } = require('node:crypto');
const db = require('../db');
const HttpError = require('../utils/httpError');
const { getImageInfo } = require('../utils/imageInfo');
const { transaction } = require('./transaction');

function list(storeId, menuId = null) {
  return db.prepare(`SELECT uuid FROM store_photos WHERE store_id = ? AND menu_id IS ?
    UNION ALL SELECT uuid FROM example_photos e WHERE store_id = ? AND menu_id IS ? AND deleted_at IS NULL
    AND (menu_id IS NULL OR NOT EXISTS (SELECT 1 FROM store_photos p WHERE p.menu_id = e.menu_id))`).all(storeId, menuId, storeId, menuId)
    .map(({ uuid }) => ({ uuid, url: `/api/photos/${uuid}` }));
}

function save(storeId, menuId, file, portrait = false) {
  if (menuId !== null && !db.prepare('SELECT menu_id FROM menus WHERE menu_id = ? AND store_id = ? AND deleted_at IS NULL').get(menuId, storeId)) {
    throw new HttpError(404, 'Menu not found');
  }
  const info = getImageInfo(file?.buffer);
  if (!info) throw new HttpError(400, 'JPG, PNG, WEBP 사진을 선택해 주세요.');
  if (info.width * info.height > 20000000) throw new HttpError(413, '사진 해상도가 너무 커요. 2천만 화소 이하로 줄여 주세요.');
  // Decode as well as checking the header, so corrupt images are rejected.
  try { require('./imageProc').preprocess(file.buffer); }
  catch (error) {
    if (error instanceof require('./imageProc').ImageProcError) throw new HttpError(400, '사진을 읽을 수 없어요. 다른 사진을 선택해 주세요.');
    throw error;
  }
  return transaction(() => {
    if (portrait) {
      const uuid = randomUUID();
      db.prepare('INSERT INTO owner_portraits(uuid, store_id, mime_type, content) VALUES (?, ?, ?, ?) ON CONFLICT(store_id) DO UPDATE SET uuid = excluded.uuid, mime_type = excluded.mime_type, content = excluded.content').run(uuid, storeId, `image/${info.type}`, file.buffer);
      return { uuid, url: `/api/photos/${uuid}` };
    }
    if (menuId === null && list(storeId).length >= 10) throw new HttpError(409, '매장 사진은 최대 10장까지 등록할 수 있어요.');
    if (menuId !== null) {
      db.prepare('DELETE FROM store_photos WHERE store_id = ? AND menu_id = ?').run(storeId, menuId);
      db.prepare("UPDATE example_photos SET deleted_at = datetime('now') WHERE store_id = ? AND menu_id = ? AND deleted_at IS NULL").run(storeId, menuId);
    }
    const uuid = randomUUID();
    db.prepare('INSERT INTO store_photos(uuid, store_id, menu_id, mime_type, content) VALUES (?, ?, ?, ?, ?)')
      .run(uuid, storeId, menuId, `image/${info.type}`, file.buffer);
    return { uuid, url: `/api/photos/${uuid}` };
  });
}

function remove(storeId, uuid) {
  if (db.prepare('DELETE FROM owner_portraits WHERE store_id = ? AND uuid = ?').run(storeId, uuid).changes) return;
  const removed = db.prepare('DELETE FROM store_photos WHERE store_id = ? AND uuid = ?').run(storeId, uuid).changes;
  if (!removed && !db.prepare("UPDATE example_photos SET deleted_at = datetime('now') WHERE store_id = ? AND uuid = ? AND deleted_at IS NULL").run(storeId, uuid).changes) throw new HttpError(404, 'Photo not found');
}

module.exports = { list, save, remove };
