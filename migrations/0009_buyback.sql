-- ---------------------------------------------------------------------
-- buyback_requests — "Sell for Cash" submissions (Path A). A guest or
-- logged-in seller submits a device for Zamorax to buy directly.
-- Public INSERT (no auth required to submit), staff-only SELECT/UPDATE
-- and DELETE (admin dashboard queue). Handled via dedicated routes
-- (app/api/buyback/*), not the generic D1 proxy.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyback_requests (
  id                  TEXT PRIMARY KEY,
  category_slug       TEXT,                      -- phones-tablets | computing | electronics
  brand               TEXT,
  model               TEXT,
  storage_variant     TEXT,                       -- e.g. "128GB", "512GB SSD" — blank if device has none
  condition           TEXT,                       -- matches buyback_pricing.condition options
  estimated_price      INTEGER,                    -- kobo — quoted at submission time
  final_price          INTEGER,                    -- kobo — set by inspector at close, may be lower than estimate
  price_adjust_reason  TEXT,                       -- inspector's note if final_price < estimated_price
  images              TEXT,                        -- JSON array of R2 keys/URLs
  known_issues        TEXT,                        -- seller-declared free text, same field also used on listings
  fulfillment_method   TEXT DEFAULT 'dropoff',      -- dropoff | meetup
  warehouse_id         TEXT,                        -- fbz_warehouses.id, set when fulfillment_method = dropoff
  meetup_address       TEXT,                        -- free text — wherever the seller wants to meet, set when fulfillment_method = meetup
  contact_name         TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  seller_id            TEXT,                        -- set only if submitted while logged in; null for guest submissions
  status               TEXT DEFAULT 'submitted',     -- submitted | accepted | rejected | paid | completed
  payment_method        TEXT,                        -- cash | bank_transfer — recorded after offline payment
  payment_reference     TEXT,
  inspected_by          TEXT,                        -- uid of admin/moderator who inspected
  inspected_at           TEXT,
  rejection_notified_at TEXT,                        -- when the rejection email was sent
  completed_by           TEXT,
  completed_at            TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_buyback_requests_status ON buyback_requests(status);
CREATE INDEX IF NOT EXISTS idx_buyback_requests_created ON buyback_requests(created_at);

-- ---------------------------------------------------------------------
-- buyback_pricing — admin-managed lookup table:
-- category + brand + model + storage_variant + condition -> base price.
-- Moderators may read this (to inspect informed), only admin writes it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyback_pricing (
  id                TEXT PRIMARY KEY,
  category_slug     TEXT,
  brand             TEXT,
  model             TEXT,
  storage_variant   TEXT,                          -- blank string = device has no storage variants
  condition         TEXT,                          -- flawless | good | fair | cracked | not_working (admin-managed labels)
  price             INTEGER,                        -- kobo
  is_active         INTEGER DEFAULT 1,
  created_by        TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_buyback_pricing_lookup ON buyback_pricing(category_slug, brand, model);

-- ---------------------------------------------------------------------
-- buyback_reviews — feedback/reviews left on the Sell for Cash page,
-- separate from order reviews. Public INSERT, public SELECT (shown on
-- the page), staff-only DELETE (moderation).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyback_reviews (
  id            TEXT PRIMARY KEY,
  reviewer_name TEXT,
  rating        INTEGER,                            -- 1-5
  comment       TEXT,
  status        TEXT DEFAULT 'published',            -- published | hidden
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_buyback_reviews_status ON buyback_reviews(status);

-- ---------------------------------------------------------------------
-- listings — used-goods trust fields (from Shopinverse/Selify review):
-- warranty duration, cosmetic defect disclosure, brand as its own
-- filterable column (was previously only inside the free-form
-- attributes JSON, so it couldn't be indexed/filtered directly).
-- ---------------------------------------------------------------------
ALTER TABLE listings ADD COLUMN warranty_days INTEGER;
ALTER TABLE listings ADD COLUMN known_issues TEXT;
ALTER TABLE listings ADD COLUMN brand TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_brand ON listings(brand);

-- ---------------------------------------------------------------------
-- contact_reveals — logs when a buyer or seller phone number was shown
-- to the other party on an order page. Reveal is gated by order status
-- and delivery method (see app/api/orders/[id]/reveal-contact/route.ts):
--   third-party pickup order, status escrow_held  -> mutual (both see)
--   third-party delivery order, status shipped     -> buyer sees seller only
--   Zamorax Direct order (isOfficial), status escrow_held -> Zamorax sees
--     buyer's contact only; buyer never sees a phone number (support chat
--     is used instead, per the Zamorax Direct Guarantee)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_reveals (
  id                     TEXT PRIMARY KEY,
  order_id               TEXT NOT NULL,
  revealed_to_user_id    TEXT NOT NULL,   -- who requested/viewed the number
  revealed_user_id       TEXT,            -- whose number was shown, null for Zamorax Direct staff reveals
  order_status_at_reveal TEXT,
  created_at             TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contact_reveals_order ON contact_reveals(order_id);
CREATE INDEX IF NOT EXISTS idx_contact_reveals_user ON contact_reveals(revealed_to_user_id);

-- ---------------------------------------------------------------------
-- listings — stock auto-expiry. When stock_qty hits 0 and stays there,
-- sellers get a restock notice and the listing is hard-deleted (D1 row
-- + R2 images) once auto_delete_after_days have passed with no restock.
-- Admin sets auto_delete_after_days globally in sub-settings.
-- out_of_stock_since is set/cleared automatically whenever stock_qty
-- crosses to/from 0.
-- ---------------------------------------------------------------------
ALTER TABLE listings ADD COLUMN out_of_stock_since TEXT;
ALTER TABLE listings ADD COLUMN restock_notice_sent_at TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_out_of_stock ON listings(out_of_stock_since);

-- ---------------------------------------------------------------------
-- orders — delivery fee recorded separately for auditability. The plan /
-- order total_amount already includes it (layaway + FBZ/ZamoraxLogic).
-- ---------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN delivery_fee_kobo INTEGER DEFAULT 0;
