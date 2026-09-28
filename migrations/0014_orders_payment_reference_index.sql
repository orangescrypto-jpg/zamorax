-- 0014_orders_payment_reference_index.sql
-- Payment routes and webhooks look orders up by payment_reference on every
-- call. Without an index that is a full table scan, and the routes used to
-- load the entire orders table into memory to do it. Also indexes the
-- listing_id column used by stock/offer lookups.
--
-- cart_payment_ref is intentionally NOT indexed here: it was added outside the
-- checked-in migrations, and CREATE INDEX fails if the column is missing on a
-- given environment. If it exists in production, run separately:
--   CREATE INDEX IF NOT EXISTS idx_orders_cart_payment_ref ON orders(cart_payment_ref);

CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);
