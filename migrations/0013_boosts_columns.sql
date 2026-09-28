-- The `boosts` table was created with only (id, listing_id, type, expires_at,
-- created_at), but the boost purchase/activation code
-- (app/(seller)/dashboard/seller/boost/page.tsx and
-- app/api/boosts/activate/route.ts) has always written seller_id, status,
-- duration, payment_reference, payment_provider, activated_at and
-- boost_ends_at. Every INSERT/UPDATE against these missing columns fails at
-- the database with "no such column" — buying and activating a listing
-- boost have both been broken outright, not just its expiry tracking.
ALTER TABLE boosts ADD COLUMN seller_id TEXT;
ALTER TABLE boosts ADD COLUMN status TEXT DEFAULT 'pending_payment';
ALTER TABLE boosts ADD COLUMN duration TEXT;
ALTER TABLE boosts ADD COLUMN payment_reference TEXT;
ALTER TABLE boosts ADD COLUMN payment_provider TEXT;
ALTER TABLE boosts ADD COLUMN activated_at TEXT;
-- The actual end-of-boost timestamp read everywhere (the existing
-- `expires_at` column is never written by any current code path). Indexed
-- since the new expiry-sweep cron scans this column.
ALTER TABLE boosts ADD COLUMN boost_ends_at TEXT;
CREATE INDEX IF NOT EXISTS idx_boosts_seller ON boosts(seller_id);
CREATE INDEX IF NOT EXISTS idx_boosts_status ON boosts(status);
CREATE INDEX IF NOT EXISTS idx_boosts_ends_at ON boosts(boost_ends_at);

-- adBoosts was created for a much smaller shape (id, listing_id, seller_id,
-- tier, amount, status, starts_at, expires_at, created_at) than what
-- AdBoostService.create() (src/services/providers/cloudflare/adBoost.ts) and
-- /api/boosts/activate actually read and write — product_id/product_title,
-- plan_type, platforms, ad_creative_url, payment_ref, amount_paid,
-- ad_spend_budget, margin_amount, start_date/end_date, week_number,
-- impressions/clicks/reach, and the activation-time payment fields. None of
-- these existed, so creating or activating an Ad Boost has also always
-- failed with "no such column".
ALTER TABLE adBoosts ADD COLUMN product_id TEXT;
ALTER TABLE adBoosts ADD COLUMN product_title TEXT;
ALTER TABLE adBoosts ADD COLUMN plan_type TEXT;
ALTER TABLE adBoosts ADD COLUMN platforms TEXT;          -- JSON array
ALTER TABLE adBoosts ADD COLUMN ad_creative_url TEXT;
ALTER TABLE adBoosts ADD COLUMN payment_ref TEXT;
ALTER TABLE adBoosts ADD COLUMN amount_paid INTEGER;
ALTER TABLE adBoosts ADD COLUMN ad_spend_budget INTEGER;
ALTER TABLE adBoosts ADD COLUMN margin_amount INTEGER;
ALTER TABLE adBoosts ADD COLUMN start_date TEXT;
ALTER TABLE adBoosts ADD COLUMN end_date TEXT;
ALTER TABLE adBoosts ADD COLUMN week_number INTEGER;
ALTER TABLE adBoosts ADD COLUMN impressions INTEGER DEFAULT 0;
ALTER TABLE adBoosts ADD COLUMN clicks INTEGER DEFAULT 0;
ALTER TABLE adBoosts ADD COLUMN reach INTEGER DEFAULT 0;
ALTER TABLE adBoosts ADD COLUMN updated_at TEXT;
-- Activation-time fields (app/api/boosts/activate/route.ts)
ALTER TABLE adBoosts ADD COLUMN payment_reference TEXT;
ALTER TABLE adBoosts ADD COLUMN payment_provider TEXT;
ALTER TABLE adBoosts ADD COLUMN activated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_adboosts_product ON adBoosts(product_id);
CREATE INDEX IF NOT EXISTS idx_adboosts_end_date ON adBoosts(end_date);

-- listings.current_ad_boost_id is written by AdBoostService.create() and
-- didn't exist either.
ALTER TABLE listings ADD COLUMN current_ad_boost_id TEXT;
