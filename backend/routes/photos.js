const router = require('express').Router();
const db = require('../db');
const fs = require('node:fs');
const path = require('node:path');

router.get('/:uuid', (req, res) => {
  const photo = db.prepare(`SELECT p.mime_type, p.content, p.filename FROM (
    SELECT uuid, store_id, menu_id, mime_type, content, NULL AS filename FROM store_photos
    UNION ALL SELECT uuid, store_id, menu_id, mime_type, content, NULL AS filename FROM store_videos
    UNION ALL SELECT uuid, store_id, NULL, mime_type, content, NULL FROM owner_portraits
    UNION ALL SELECT uuid, store_id, menu_id, 'image/png', NULL, filename FROM example_photos WHERE deleted_at IS NULL
    ) p
    JOIN stores s ON s.store_id = p.store_id AND s.deleted_at IS NULL
    LEFT JOIN menus m ON m.menu_id = p.menu_id
    WHERE p.uuid = ? AND (p.menu_id IS NULL OR m.deleted_at IS NULL)`).get(req.params.uuid);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  let content;
  if (photo.filename) {
    if (!['sign.png', 'store.png', 'food.png', 'clothes.png', 'iron.png'].includes(photo.filename)) return res.status(404).json({ error: 'Photo not found' });
    content = fs.readFileSync(path.join(__dirname, '../../frontend/public/examples', photo.filename));
  } else content = Buffer.from(photo.content);
  res.set('Cache-Control', 'public, max-age=3600').set('X-Content-Type-Options', 'nosniff').set('Accept-Ranges', 'bytes').type(photo.mime_type);
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    let start = match?.[1] ? Number(match[1]) : 0;
    let end = match?.[2] ? Number(match[2]) : content.length - 1;
    if (match && !match[1] && match[2]) { start = Math.max(0, content.length - Number(match[2])); end = content.length - 1; }
    end = Math.min(end, content.length - 1);
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= content.length) {
      return res.status(416).set('Content-Range', `bytes */${content.length}`).end();
    }
    return res.status(206).set('Content-Range', `bytes ${start}-${end}/${content.length}`).send(content.subarray(start, end + 1));
  }
  res.send(content);
});
module.exports = router;
