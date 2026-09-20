-- =====================================================================
-- Migration 0007 -- Layaway (pure, no-credit) + Web Push notifications
-- Run this against production, then fold into migrations/0001_baseline_schema.sql
-- as instructed in that file's header.
-- =====================================================================

-- ── Layaway fields on listings -----------------------------------------
-- Seller opts in per listing. Values are always bounded by the admin's
-- platform-wide layaway settings (see sub_settings kv key), enforced
-- server side, not just in the form.
ALTER TABLE listings ADD COLUMN layaway_enabled INTEGER DEFAULT 0;
ALTER TABLE listings ADD COLUMN layaway_min_deposit_type TEXT DEFAULT 'percent'; -- 'percent' | 'flat' -- seller picks one
ALTER TABLE listings ADD COLUMN layaway_min_deposit_percent INTEGER;
ALTER TABLE listings ADD COLUMN layaway_min_deposit_flat_kobo INTEGER;
ALTER TABLE listings ADD COLUMN layaway_max_days INTEGER;

-- ── layaway_plans ---------------------------------------------------------
-- One row per buyer's layaway agreement on one order. No goods are
-- released, shipped, or marked delivered until status = 'completed'.
CREATE TABLE IF NOT EXISTS layaway_plans (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL,
  listing_id          TEXT NOT NULL,
  buyer_id            TEXT NOT NULL,
  seller_id           TEXT NOT NULL,
  total_amount        INTEGER NOT NULL,          -- kobo, price locked at plan creation
  amount_paid         INTEGER NOT NULL DEFAULT 0, -- kobo, sum of successful installments
  deposit_percent     INTEGER NOT NULL,           -- percent required to start
  status              TEXT NOT NULL DEFAULT 'active', -- active|completed|defaulted|cancelled|refunded
  forfeit_percent     INTEGER NOT NULL DEFAULT 10,    -- kept by seller if buyer defaults
  price_locked_at     TEXT NOT NULL,
  expires_at          TEXT NOT NULL,              -- deadline to reach 100%
  completed_at        TEXT,
  defaulted_at        TEXT,
  cancelled_at        TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_layaway_plans_buyer   ON layaway_plans(buyer_id);
CREATE INDEX IF NOT EXISTS idx_layaway_plans_seller  ON layaway_plans(seller_id);
CREATE INDEX IF NOT EXISTS idx_layaway_plans_order   ON layaway_plans(order_id);
CREATE INDEX IF NOT EXISTS idx_layaway_plans_status  ON layaway_plans(status);
CREATE INDEX IF NOT EXISTS idx_layaway_plans_expires ON layaway_plans(expires_at);

-- ── layaway_payments --------------------------------------------------------
-- Each successful installment. provider_ref is unique so a webhook or
-- verify call retried twice never double counts.
CREATE TABLE IF NOT EXISTS layaway_payments (
  id            TEXT PRIMARY KEY,
  plan_id       TEXT NOT NULL,
  amount        INTEGER NOT NULL,   -- kobo
  provider      TEXT NOT NULL,      -- paystack|flutterwave|manual
  provider_ref  TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'success', -- success | pending_admin_review (manual transfers)
  paid_at       TEXT DEFAULT (datetime('now')),
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_layaway_payments_plan ON layaway_payments(plan_id);

-- =====================================================================
-- Web Push (VAPID) notifications
-- =====================================================================

-- ── push_subscriptions ------------------------------------------------------
-- One row per browser subscription. A user can have more than one
-- (phone + laptop), so this is keyed by endpoint, not user_id.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- ── push_vapid_keys -----------------------------------------------------
-- Single row (id = 'default'). Admin can generate or paste keys here;
-- if this row is empty/missing, the send route falls back to the
-- NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.
CREATE TABLE IF NOT EXISTS push_vapid_keys (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  public_key    TEXT,
  private_key   TEXT,
  subject       TEXT,   -- mailto: contact required by the Web Push protocol
  updated_at    TEXT DEFAULT (datetime('now'))
);
