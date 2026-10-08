PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_ids (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS email_credentials (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS customer_users (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS owner_users (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE VIEW IF NOT EXISTS users AS
SELECT p.deleted_at, p.user_id, a.uuid, c.email, c.email_verified_at,
  c.password_hash, p.display_name, p.phone, p.address, 'customer' AS role,
  p.is_active, p.credit, p.created_at
FROM customer_users p JOIN account_ids a ON a.user_id = p.user_id
LEFT JOIN email_credentials c ON c.user_id = p.user_id
UNION ALL
SELECT p.deleted_at, p.user_id, a.uuid, c.email, c.email_verified_at,
  c.password_hash, p.display_name, p.phone, p.address, 'owner' AS role,
  p.is_active, p.credit, p.created_at
FROM owner_users p JOIN account_ids a ON a.user_id = p.user_id
LEFT JOIN email_credentials c ON c.user_id = p.user_id
UNION ALL
SELECT p.deleted_at, p.user_id, a.uuid, c.email, c.email_verified_at,
  c.password_hash, p.display_name, p.phone, p.address, 'admin' AS role,
  p.is_active, p.credit, p.created_at
FROM admin_users p JOIN account_ids a ON a.user_id = p.user_id
LEFT JOIN email_credentials c ON c.user_id = p.user_id;

CREATE TRIGGER IF NOT EXISTS users_insert INSTEAD OF INSERT ON users BEGIN
  SELECT CASE WHEN COALESCE(NEW.role, 'customer') NOT IN ('customer', 'owner', 'admin') THEN RAISE(ABORT, 'Invalid role') END;
  INSERT INTO account_ids (user_id, uuid) VALUES (NEW.user_id, COALESCE(NEW.uuid, lower(hex(randomblob(16)))));
  INSERT INTO customer_users (deleted_at, user_id, display_name, phone, address, is_active, credit, created_at)
  SELECT NEW.deleted_at, last_insert_rowid(), NEW.display_name, NEW.phone, NEW.address,
    COALESCE(NEW.is_active, 1), COALESCE(NEW.credit, 0), COALESCE(NEW.created_at, datetime('now'))
  WHERE COALESCE(NEW.role, 'customer') = 'customer';
  INSERT INTO owner_users (deleted_at, user_id, display_name, phone, address, is_active, credit, created_at)
  SELECT NEW.deleted_at, last_insert_rowid(), NEW.display_name, NEW.phone, NEW.address,
    COALESCE(NEW.is_active, 1), COALESCE(NEW.credit, 0), COALESCE(NEW.created_at, datetime('now'))
  WHERE COALESCE(NEW.role, 'customer') = 'owner';
  INSERT INTO admin_users (deleted_at, user_id, display_name, phone, address, is_active, credit, created_at)
  SELECT NEW.deleted_at, last_insert_rowid(), NEW.display_name, NEW.phone, NEW.address,
    COALESCE(NEW.is_active, 1), COALESCE(NEW.credit, 0), COALESCE(NEW.created_at, datetime('now'))
  WHERE COALESCE(NEW.role, 'customer') = 'admin';
  INSERT INTO email_credentials (user_id, email, password_hash, email_verified_at)
  SELECT last_insert_rowid(), NEW.email, NEW.password_hash, NEW.email_verified_at WHERE NEW.email IS NOT NULL;
END;

CREATE TRIGGER IF NOT EXISTS users_update INSTEAD OF UPDATE ON users BEGIN
  SELECT CASE WHEN NEW.role NOT IN ('customer', 'owner', 'admin') OR NEW.role IS NULL OR NEW.user_id != OLD.user_id THEN RAISE(ABORT, 'Invalid account update') END;
  UPDATE account_ids SET uuid = NEW.uuid WHERE user_id = OLD.user_id;
  DELETE FROM email_credentials WHERE user_id = OLD.user_id AND NEW.email IS NULL;
  INSERT INTO email_credentials (user_id, email, password_hash, email_verified_at)
  SELECT NEW.user_id, NEW.email, NEW.password_hash, NEW.email_verified_at WHERE NEW.email IS NOT NULL
  ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash, email_verified_at = excluded.email_verified_at;
  DELETE FROM customer_users WHERE user_id = OLD.user_id AND NEW.role != 'customer';
  DELETE FROM owner_users WHERE user_id = OLD.user_id AND NEW.role != 'owner';
  DELETE FROM admin_users WHERE user_id = OLD.user_id AND NEW.role != 'admin';
  INSERT INTO customer_users (deleted_at, user_id, display_name, phone, address, is_active, credit, created_at)
  SELECT NEW.deleted_at, NEW.user_id, NEW.display_name, NEW.phone, NEW.address, NEW.is_active, NEW.credit, NEW.created_at WHERE NEW.role = 'customer'
  ON CONFLICT(user_id) DO UPDATE SET deleted_at = excluded.deleted_at, display_name = excluded.display_name, phone = excluded.phone, address = excluded.address, is_active = excluded.is_active, credit = excluded.credit, created_at = excluded.created_at;
  INSERT INTO owner_users (deleted_at, user_id, display_name, phone, address, is_active, credit, created_at)
  SELECT NEW.deleted_at, NEW.user_id, NEW.display_name, NEW.phone, NEW.address, NEW.is_active, NEW.credit, NEW.created_at WHERE NEW.role = 'owner'
  ON CONFLICT(user_id) DO UPDATE SET deleted_at = excluded.deleted_at, display_name = excluded.display_name, phone = excluded.phone, address = excluded.address, is_active = excluded.is_active, credit = excluded.credit, created_at = excluded.created_at;
  INSERT INTO admin_users (deleted_at, user_id, display_name, phone, address, is_active, credit, created_at)
  SELECT NEW.deleted_at, NEW.user_id, NEW.display_name, NEW.phone, NEW.address, NEW.is_active, NEW.credit, NEW.created_at WHERE NEW.role = 'admin'
  ON CONFLICT(user_id) DO UPDATE SET deleted_at = excluded.deleted_at, display_name = excluded.display_name, phone = excluded.phone, address = excluded.address, is_active = excluded.is_active, credit = excluded.credit, created_at = excluded.created_at;
END;

CREATE TRIGGER IF NOT EXISTS users_delete INSTEAD OF DELETE ON users BEGIN
  DELETE FROM account_ids WHERE user_id = OLD.user_id;
END;

CREATE TABLE IF NOT EXISTS business_registrations (
	deleted_at TEXT,
	registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	user_id INTEGER NOT NULL UNIQUE REFERENCES account_ids(user_id) ON DELETE CASCADE,
	business_number TEXT NOT NULL UNIQUE,
	legal_name TEXT NOT NULL,
	representative_name TEXT NOT NULL,
	address TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
	rejection_reason TEXT,
	verified_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
	session_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	user_id INTEGER NOT NULL REFERENCES account_ids(user_id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  reset_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES account_ids(user_id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  verification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES account_ids(user_id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phone_identities (
  phone TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES account_ids(user_id),
  verified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phone_verification_requests (
  uuid TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
	deleted_at TEXT,
	category_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	name TEXT NOT NULL UNIQUE,
	parent_id INTEGER DEFAULT NULL REFERENCES categories(category_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stores (
  min_order_minutes INTEGER NOT NULL DEFAULT 0 CHECK (min_order_minutes BETWEEN 0 AND 43200),
  is_virtual INTEGER NOT NULL DEFAULT 0 CHECK (is_virtual IN (0, 1)),
	deleted_at TEXT,
	store_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	owner_id INTEGER REFERENCES account_ids(user_id) ON DELETE SET NULL,
	name TEXT,
	category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
	description TEXT,
	phone TEXT,
	address TEXT,
	location_lat REAL,
	location_lng REAL,
	open_hours TEXT,
	order_type TEXT DEFAULT 'none' CHECK (order_type IN ('preorder', 'reservation', 'none')),
	visits INTEGER DEFAULT 0,
	created_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
	deleted_at TEXT,
    coupon_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,

    store_id INTEGER NOT NULL
        REFERENCES stores(store_id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,

	discount_rate REAL
		CHECK (discount_rate IS NULL OR discount_rate BETWEEN 0 AND 100),
    target_menu_id INTEGER NOT NULL DEFAULT 0 CHECK (target_menu_id >= 0),

    valid_from TEXT,
    valid_until TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signKeyWords (
	deleted_at TEXT,
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	name TEXT NOT NULL,
	store_id INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
	UNIQUE (store_id, name)
);

CREATE TABLE IF NOT EXISTS menus (
	deleted_at TEXT,
	menu_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	name TEXT NOT NULL,
	store_id INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
	price INTEGER NOT NULL,
	rating REAL CHECK (0 <= rating AND rating <= 5)
);

CREATE TABLE IF NOT EXISTS orders (
  party_size INTEGER CHECK (party_size BETWEEN 1 AND 99),
  coupon_uuid TEXT,
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
	order_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	customer_id INTEGER REFERENCES account_ids(user_id) ON DELETE SET NULL,
	store_id INTEGER NOT NULL REFERENCES stores(store_id),
	total_price INTEGER,
	pickup_time TEXT NOT NULL,
	customer_phone TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'done', 'rejected')),
  payment_method TEXT NOT NULL DEFAULT 'onsite' CHECK (payment_method IN ('onsite', 'credit')),
  payment_reference TEXT,
	created_at TEXT DEFAULT (datetime('now')),
	is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS items (
	item_id INTEGER PRIMARY KEY AUTOINCREMENT,
	uuid TEXT,
	order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
	menu_id INTEGER NOT NULL REFERENCES menus(menu_id),
	quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
	unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS order_ratings (
  uuid TEXT NOT NULL UNIQUE,
  order_id INTEGER PRIMARY KEY REFERENCES orders(order_id),
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES account_ids(user_id),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('topup', 'payment', 'refund')),
  reference TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, kind, reference)
);

CREATE TABLE IF NOT EXISTS credit_payments (
  uuid TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES account_ids(user_id),
  request_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  cid TEXT NOT NULL,
  tid TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'approving', 'approved', 'failed', 'review')),
  redirect_pc TEXT,
  redirect_mobile TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, request_id)
);


CREATE INDEX IF NOT EXISTS idx_menus_store_id ON menus (store_id);

CREATE INDEX IF NOT EXISTS idx_stores_category_id ON stores (category_id);

CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);

CREATE INDEX IF NOT EXISTS idx_keywords_store_id ON signKeyWords(store_id);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);

CREATE INDEX IF NOT EXISTS idx_items_order_id ON items(order_id);

CREATE INDEX IF NOT EXISTS idx_items_menu_id ON items(menu_id);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_business_registrations_status ON business_registrations(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

INSERT OR IGNORE INTO categories (category_id, name) VALUES
	(1, '음식점'),
	(2, '세탁소'),
	(3, '미용실'),
	(4, '반찬'),
	(5, '카페');

INSERT OR IGNORE INTO stores
	(store_id, name, category_id, description, phone, address, location_lat, location_lng, open_hours, order_type, visits, created_at, is_virtual)
VALUES
	(1, '월계 손칼국수', 1, '직접 뽑은 면으로 끓이는 동네 칼국수집', '02-000-0001', '서울 노원구 월계1동 (가상 주소 1)', 37.6205, 127.0601, '11:00-21:00', 'preorder', 120, '2025-03-12', 1),
	(2, '새마을 세탁소', 2, '30년 경력 사장님의 수선·드라이클리닝', '02-000-0002', '서울 노원구 월계1동 (가상 주소 2)', 37.6218, 127.0587, '08:00-20:00', 'reservation', 15, '2024-11-02', 1),
	(3, '햇살 미용실', 3, '어르신 커트와 염색을 전문으로 하는 미용실', '02-000-0003', '서울 노원구 월계1동 (가상 주소 3)', 37.6192, 127.0615, '10:00-19:00', 'reservation', 40, '2026-09-20', 1),
	(4, '월계 반찬가게', 4, '매일 아침 만드는 집반찬, 미리 주문 가능', '02-000-0004', '서울 노원구 월계1동 (가상 주소 4)', 37.6227, 127.0623, '07:00-19:00', 'preorder', 8, '2026-09-25', 1),
	(5, '모퉁이 카페', 5, '9월에 새로 문을 연 골목 모퉁이 카페', '02-000-0005', '서울 노원구 월계1동 (가상 주소 5)', 37.6199, 127.0579, '09:00-22:00', 'none', 3, '2026-09-25', 1);

INSERT OR IGNORE INTO signKeyWords (id, name, store_id) VALUES
	(1, '월계', 1), (2, '손칼국수', 1), (3, '칼국수', 1),
	(4, '새마을', 2), (5, '세탁소', 2), (6, '세탁', 2),
	(7, '햇살', 3), (8, '미용실', 3),
	(9, '월계', 4), (10, '반찬', 4), (11, '반찬가게', 4),
	(12, '모퉁이', 5), (13, '카페', 5);

INSERT OR IGNORE INTO menus (menu_id, name, store_id, price) VALUES
	(101, '바지락 칼국수', 1, 8000), (102, '왕만두', 1, 6000),
	(201, '와이셔츠 세탁', 2, 3000), (202, '정장 드라이', 2, 9000), (203, '바지 기장 수선', 2, 7000),
	(301, '커트', 3, 12000), (302, '뿌리 염색', 3, 30000),
	(401, '반찬 3종 세트', 4, 10000), (402, '김치 1kg', 4, 12000),
	(501, '아메리카노', 5, 3000), (502, '카페라떼', 5, 3500);

INSERT OR IGNORE INTO coupons (coupon_id, store_id, title, discount_rate) VALUES
	(1, 1, '만두 1판 10% 할인', 10),
	(2, 3, '첫 방문 커트 2,000원 할인', NULL),
	(3, 5, '오픈 기념 음료 20% 할인', 20);

INSERT OR IGNORE INTO orders
	(order_id, store_id, total_price, pickup_time, customer_phone, status, created_at)
VALUES
	(1, 1, 16000, '2026-10-08T12:30', '010-0000-0001', 'pending', '2026-09-30T11:50'),
	(2, 1, 14000, '2026-10-08T13:00', '010-0000-0002', 'accepted', '2026-09-30T11:55'),
	(3, 4, 10000, '2026-10-09T09:00', '010-0000-0003', 'pending', '2026-09-30T20:10');

INSERT OR IGNORE INTO items (item_id, order_id, menu_id, quantity, unit_price) VALUES
	(1, 1, 101, 2, 8000),
	(2, 2, 101, 1, 8000), (3, 2, 102, 1, 6000),
	(4, 3, 401, 1, 10000);

CREATE TABLE IF NOT EXISTS inquiry_messages (
  message_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES account_ids(user_id),
  author_id INTEGER NOT NULL REFERENCES account_ids(user_id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (customer_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_customer_messages ON inquiry_messages(customer_id, message_id);

-- Photos are kept separately so store/menu queries never load image bytes.
CREATE TABLE IF NOT EXISTS store_photos (
  photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  store_id INTEGER NOT NULL REFERENCES stores(store_id),
  menu_id INTEGER REFERENCES menus(menu_id),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_photos_store_menu ON store_photos(store_id, menu_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_photos_menu ON store_photos(menu_id) WHERE menu_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS store_videos (
  video_id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  store_id INTEGER NOT NULL REFERENCES stores(store_id),
  menu_id INTEGER REFERENCES menus(menu_id),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('video/mp4', 'video/webm')),
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_videos_store_menu ON store_videos(store_id, menu_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_videos_menu ON store_videos(menu_id) WHERE menu_id IS NOT NULL;

-- 기본 가게의 예시 이미지. PNG 파일은 frontend/public/examples에 보관합니다.
-- UUID를 고정하고 INSERT OR IGNORE를 사용하여 초기화를 반복해도 중복되지 않습니다.
CREATE TABLE IF NOT EXISTS example_photos (
  uuid TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(store_id),
  menu_id INTEGER REFERENCES menus(menu_id),
  filename TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_example_photos_store_menu ON example_photos(store_id, menu_id);
INSERT OR IGNORE INTO example_photos (uuid, store_id, menu_id, filename) VALUES
  ('bcd781a4-8b86-4eb5-930e-99796baa0001', 1, NULL, 'sign.png'),
  ('bcd781a4-8b86-4eb5-930e-99796baa0002', 1, NULL, 'store.png'),
  ('bcd781a4-8b86-4eb5-930e-99796baa0003', 1, 101, 'food.png'),
  ('bcd781a4-8b86-4eb5-930e-99796baa0004', 2, 201, 'clothes.png'),
  ('bcd781a4-8b86-4eb5-930e-99796baa0005', 2, NULL, 'iron.png');

CREATE TABLE IF NOT EXISTS owner_portraits (
  uuid TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL UNIQUE REFERENCES stores(store_id),
  mime_type TEXT NOT NULL,
  content BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS location_consents (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id),
  accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS personal_information_consents (
  user_id INTEGER PRIMARY KEY REFERENCES account_ids(user_id),
  phone_accepted INTEGER NOT NULL DEFAULT 0 CHECK (phone_accepted IN (0, 1)),
  contacts_accepted INTEGER NOT NULL DEFAULT 0 CHECK (contacts_accepted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
