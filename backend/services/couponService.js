const db = require('../db');
const { nowKSTString } = require('../utils/time');

function available(storeId, uuid) {
  const today = nowKSTString().slice(0, 10);
  return db.prepare(`SELECT uuid, title, discount_rate AS discountRate, target_menu_id AS targetMenuId,
    (SELECT name FROM menus WHERE menu_id = coupons.target_menu_id) AS targetMenuName FROM coupons
    WHERE store_id = ? AND deleted_at IS NULL AND is_active = 1
      AND (target_menu_id = 0 OR EXISTS (SELECT 1 FROM menus WHERE menu_id = coupons.target_menu_id AND store_id = coupons.store_id AND deleted_at IS NULL))
      ${uuid === undefined ? '' : 'AND discount_rate > 0'}
      AND (valid_from IS NULL OR valid_from <= ?) AND (valid_until IS NULL OR valid_until >= ?)
      ${uuid === undefined ? '' : 'AND uuid = ?'}
    ORDER BY coupon_id LIMIT 1`).get(...[storeId, today, today, ...(uuid === undefined ? [] : [uuid])]);
}

module.exports = { available };
