-- =====================================================================
-- Zamorax D1 — Baseline Schema (reverse-engineered from codebase)
-- =====================================================================
-- IMPORTANT: This was rebuilt by reading every INSERT/SELECT/UPDATE
-- against D1 across src/services/providers/cloudflare/*.ts and
-- app/api/db/**/*.ts. It is NOT pulled from a live `wrangler d1 execute
-- --command ".schema"` dump, so:
--
--   1. Run `wrangler d1 execute ZAMORAX_DB --command ".schema" --remote`
--      against your real production DB and diff it against this file.
--   2. Treat every column type below as a best-guess based on how the
--      code reads/writes it (e.g. timestamps stored as ISO strings,
--      booleans stored as 0/1 INTEGER, JSON stored as TEXT).
--   3. Any column missing here that the app references will throw the
--      "missing column" errors you've already been chasing — add it
--      to this file the moment you find one, so this becomes the
--      source of truth going forward.
--
-- From this point on: every future schema change should be a new
-- numbered file in this migrations/ folder (0002_..., 0003_...),
-- never a manual one-off ALTER TABLE typed directly into the
-- Cloudflare dashboard. Apply with:
--   wrangler d1 migrations apply ZAMORAX_DB --remote
-- =====================================================================

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  uid                  TEXT PRIMARY KEY,
  email                TEXT,
  phone                TEXT,
  full_name            TEXT,
  username             TEXT UNIQUE,
  role                 TEXT,                 -- buyer | seller | admin | logistics_agent ...
  plan                 TEXT DEFAULT 'free',
  plan_expires_at      TEXT,                  -- ISO datetime
  verification_level   TEXT,                  -- phone | nin | bvn
  nin_verified         INTEGER DEFAULT 0,
  bvn_verified         INTEGER DEFAULT 0,
  phone_verified       INTEGER DEFAULT 0,
  email_verified       INTEGER DEFAULT 0,
  is_banned            INTEGER DEFAULT 0,
  ban_reason           TEXT,
  active_listing_count INTEGER DEFAULT 0,
  seller_rating        REAL,
  total_sales          INTEGER DEFAULT 0,
  total_rentals        INTEGER DEFAULT 0,
  is_seller_ready      INTEGER DEFAULT 0,
  profile_photo        TEXT,                  -- R2 key/URL
  store_name           TEXT,
  store_description    TEXT,
  fcm_token            TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- ---------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listings (
  id                  TEXT PRIMARY KEY,
  seller_id           TEXT,
  seller_name         TEXT,
  seller_state        TEXT,
  seller_plan         TEXT,
  seller_rating       REAL,
  seller_verified     INTEGER,
  category_id         TEXT,
  category            TEXT,                   -- category slug
  slug                TEXT,
  title               TEXT,
  searchable_title     TEXT,                  -- lowercased, for search
  description         TEXT,
  listing_type        TEXT DEFAULT 'sale',     -- sale | rent
  condition           TEXT DEFAULT 'brand_new',
  price               INTEGER DEFAULT 0,       -- kobo
  price_rent_day      INTEGER,
  price_rent_week     INTEGER,
  deposit_amount      INTEGER,
  images              TEXT,                    -- JSON array of R2 keys/URLs
  verification_video  TEXT,
  attributes          TEXT,                    -- JSON object
  is_hub_verified     INTEGER DEFAULT 0,
  is_boosted          INTEGER DEFAULT 0,
  boost_type          TEXT DEFAULT 'none',
  boost_expires_at    TEXT,
  ad_boost_status     TEXT,
  status              TEXT DEFAULT 'pending',  -- pending|active|paused|rejected|sold
  rejection_reason    TEXT,
  approved_by         TEXT,
  approved_at         TEXT,
  rejected_by         TEXT,
  rejected_at         TEXT,
  nigerian_state      TEXT,
  city                TEXT,
  delivery_nationwide INTEGER DEFAULT 0,
  delivery_options    TEXT,                    -- JSON array (shipping methods)
  weight_kg           REAL,
  is_fragile          INTEGER DEFAULT 0,
  stock_qty           INTEGER DEFAULT 1,
  views               INTEGER DEFAULT 0,
  saves               INTEGER DEFAULT 0,
  inquiries           INTEGER DEFAULT 0,
  flash_deal          TEXT,                    -- JSON object {discountPercent, expiresAt, createdAt}
  is_flash_deal       INTEGER DEFAULT 0,
  vacation_mode       INTEGER DEFAULT 0,
  vacation_return_date TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_boost_expires ON listings(boost_expires_at);

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  slug        TEXT UNIQUE,
  icon        TEXT,
  image_url   TEXT,
  description TEXT,
  parent_id   TEXT,
  phase       INTEGER DEFAULT 1,
  "order"     INTEGER DEFAULT 0,
  status      TEXT DEFAULT 'active'
);

-- ---------------------------------------------------------------------
-- saved_listings  (buyer "wishlist")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_listings (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  listing_id  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saved_listings_user ON saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing ON saved_listings(listing_id);

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  listing_id          TEXT,
  buyer_id            TEXT,
  buyer_name          TEXT,
  buyer_state         TEXT,
  buyer_reviewed      INTEGER DEFAULT 0,
  seller_id           TEXT,
  seller_name         TEXT,
  seller_store_name   TEXT,
  seller_state        TEXT,
  item_title          TEXT,
  item_image          TEXT,
  item_price          INTEGER,
  total_amount        INTEGER,
  platform_fee        INTEGER DEFAULT 0,
  seller_payout       INTEGER DEFAULT 0,
  order_type          TEXT DEFAULT 'sale',     -- sale | rent
  rental_start        TEXT,
  rental_end          TEXT,
  status              TEXT DEFAULT 'pending',  -- pending|escrow_held|shipped|delivered|inspecting|completed|cancelled|disputed
  escrow_status       TEXT DEFAULT 'held',      -- held|released_to_seller|refunded
  released_to_seller  INTEGER DEFAULT 0,
  line_items          TEXT,                     -- JSON array
  delivery_street     TEXT,
  delivery_city       TEXT,
  delivery_state      TEXT,
  delivery_lga        TEXT,
  delivery_method     TEXT,
  payment_reference   TEXT,
  payment_provider    TEXT,                     -- paystack | flutterwave | manual
  delivered_at        TEXT,
  escrow_release_at   TEXT,
  completed_at        TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_escrow_release ON orders(escrow_release_at);

-- ---------------------------------------------------------------------
-- chats / messages / offers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
  id                TEXT PRIMARY KEY,
  participants      TEXT,                       -- JSON array of uids
  participant_names TEXT,                        -- JSON object
  buyer_id          TEXT,
  seller_id         TEXT,
  buyer_name        TEXT,
  seller_name       TEXT,
  listing_id        TEXT,
  listing_title     TEXT,
  listing_image     TEXT,
  order_id          TEXT,
  is_locked         INTEGER DEFAULT 1,
  last_message      TEXT,
  last_message_at   TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chats_buyer ON chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_seller ON chats(seller_id);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT,
  sender_id   TEXT,
  content     TEXT,                              -- plain text, or JSON for offer messages
  type        TEXT DEFAULT 'text',                -- text | offer
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);

CREATE TABLE IF NOT EXISTS offers (
  id              TEXT PRIMARY KEY,
  listing_id      TEXT,
  listing_title   TEXT,
  listing_image   TEXT,
  original_price  INTEGER,
  offer_amount    INTEGER,
  buyer_id        TEXT,
  buyer_name      TEXT,
  seller_id       TEXT,
  seller_name     TEXT,
  chat_id         TEXT,
  status          TEXT DEFAULT 'pending',         -- pending|accepted|rejected|expired
  expires_at      TEXT,
  responded_at    TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_expires ON offers(expires_at);

CREATE TABLE IF NOT EXISTS accepted_offers (
  id          TEXT PRIMARY KEY,        -- composite: {listingId}_{buyerId}
  listing_id  TEXT,
  buyer_id    TEXT,
  offer_amount INTEGER,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- wallets / payouts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_wallets (
  user_id         TEXT PRIMARY KEY,
  balance         INTEGER DEFAULT 0,
  total_earned    INTEGER DEFAULT 0,
  pending_balance INTEGER DEFAULT 0,
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  type          TEXT,                  -- credit | debit
  amount        INTEGER,
  balance_after INTEGER,
  description   TEXT,
  order_id      TEXT,
  reference     TEXT,
  status        TEXT DEFAULT 'completed',
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);

CREATE TABLE IF NOT EXISTS payout_requests (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT,
  amount                   INTEGER,
  bank_name                TEXT,
  account_number           TEXT,
  account_name             TEXT,
  paystack_recipient_code  TEXT,
  paystack_reference       TEXT,
  failure_reason           TEXT,
  status                   TEXT DEFAULT 'pending',  -- pending|processing|paid|failed
  processed_at             TEXT,
  created_at               TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout_requests(status);

CREATE TABLE IF NOT EXISTS refund_records (
  id          TEXT PRIMARY KEY,
  order_id    TEXT,
  amount      INTEGER,
  reason      TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_wallets (
  user_id      TEXT PRIMARY KEY,
  balance      INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS logistics_agent_wallets (
  user_id      TEXT PRIMARY KEY,
  agent_id     TEXT,
  agent_user_id TEXT,
  balance      INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS logistics_agent_transactions (
  id           TEXT PRIMARY KEY,
  agent_user_id TEXT,
  amount       INTEGER,
  type         TEXT,
  reason       TEXT,
  shipment_id  TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  type        TEXT,
  title       TEXT,
  body        TEXT,
  link        TEXT,
  is_read     INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ---------------------------------------------------------------------
-- disputes / reports / reviews
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
  id          TEXT PRIMARY KEY,
  order_id    TEXT,
  raised_by   TEXT,
  reason      TEXT,
  status      TEXT DEFAULT 'open',
  resolution  TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT,
  target_type TEXT,        -- listing | user | chat
  target_id   TEXT,
  reason      TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listing_reports (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT,
  reporter_id TEXT,
  reason      TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  order_id    TEXT,
  reviewer_id TEXT,
  reviewee_id TEXT,
  rating      INTEGER,
  comment     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listing_qna (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT,
  asker_id    TEXT,
  question    TEXT,
  answer      TEXT,
  answered_at TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- verification / ZLA (Zamorax-level agents?) / withdrawals
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_requests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  type        TEXT,         -- nin | bvn | hub
  status      TEXT DEFAULT 'pending',
  document_url TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zla_applications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  amount      INTEGER,
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- logistics / shipments / agent locations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT,
  agent_id        TEXT,
  status          TEXT DEFAULT 'pending',
  pickup_address  TEXT,
  dropoff_address TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_locations (
  agent_id    TEXT PRIMARY KEY,
  latitude    REAL,
  longitude   REAL,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- blog
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog (
  id            TEXT PRIMARY KEY,
  title         TEXT,
  slug          TEXT UNIQUE,
  content       TEXT,
  cover_image   TEXT,
  author_id     TEXT,
  status        TEXT DEFAULT 'draft',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- ad boost / boosts / bundles / featured banners
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adBoosts (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT,
  seller_id   TEXT,
  tier        TEXT,
  amount      INTEGER,
  status      TEXT DEFAULT 'pending',
  starts_at   TEXT,
  expires_at  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_adboosts_expires ON adBoosts(expires_at);

CREATE TABLE IF NOT EXISTS boosts (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT,
  type        TEXT,
  expires_at  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_boosts_expires ON boosts(expires_at);

CREATE TABLE IF NOT EXISTS bundles (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  listing_ids TEXT,        -- JSON array
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS featured_banners (
  id          TEXT PRIMARY KEY,
  image_url   TEXT,
  link        TEXT,
  position    INTEGER,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- other / engagement
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_alerts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  query       TEXT,
  filters     TEXT,         -- JSON
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  plan        TEXT,
  status      TEXT DEFAULT 'active',
  expires_at  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_payments (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT,
  reference           TEXT UNIQUE,
  purpose             TEXT,                  -- order | subscription | boost
  amount              INTEGER,
  metadata            TEXT,                   -- JSON object (orderId, boostId, subscriptionId, etc.)
  provider            TEXT DEFAULT 'manual',
  proof_url           TEXT,                   -- R2 key/URL — buyer-uploaded payment proof screenshot
  buyer_submitted_at  TEXT,                    -- when buyer attached proof / marked as paid
  admin_confirmed     INTEGER DEFAULT 0,
  admin_id            TEXT,
  confirmed_at        TEXT,
  status              TEXT DEFAULT 'pending', -- pending|awaiting_transfer|awaiting_confirmation|confirmed
  created_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_reference ON pending_payments(reference);

CREATE TABLE IF NOT EXISTS insurance_pool (
  month       TEXT PRIMARY KEY,    -- 'YYYY-MM'
  net_balance INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- generic key-value (admin settings, platform settings cache, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kv_store (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- seller follows — buyer follows a seller's store (public read via the
-- D1 proxy's PUBLIC_READ_OWNED_WRITE_TABLES, writes scoped to follower_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_follows (
  id            TEXT PRIMARY KEY,
  follower_id   TEXT NOT NULL,
  seller_id     TEXT NOT NULL,
  follower_name TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seller_follows_seller   ON seller_follows(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_follows_follower ON seller_follows(follower_id);

-- =====================================================================
-- NOTE on tables seen in queries but NOT confidently mapped:
--   "via", "x" — these showed up as table-name matches in a broad grep
--   but are almost certainly false positives (matched the word "via"
--   or "x" inside unrelated code, not real D1 tables). Ignore them.
-- =====================================================================
