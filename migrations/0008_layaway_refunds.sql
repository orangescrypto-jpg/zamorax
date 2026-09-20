-- =====================================================================
-- Migration 0008 -- Layaway cancellation, expiry, and manual refund flow
-- Depends on 0007_layaway_and_push.sql. Run after it.
-- =====================================================================

-- ── layaway_plans: cancellation/refund tracking fields ------------------
-- status now also uses: pending_admin_confirmation (manual deposit not
-- yet confirmed), cancel_requested, expired, refund_pending, refunded,
-- refunded_confirmed (in addition to active, completed, defaulted,
-- cancelled from migration 0007).
ALTER TABLE layaway_plans ADD COLUMN exit_fee_kobo INTEGER;
ALTER TABLE layaway_plans ADD COLUMN refund_amount_kobo INTEGER;
ALTER TABLE layaway_plans ADD COLUMN refund_status TEXT;
-- refund_status values: null | awaiting_bank_details | pending_review |
-- paid | buyer_confirmed | auto_confirmed
ALTER TABLE layaway_plans ADD COLUMN refund_requested_at TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_bank_name TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_account_number TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_account_name TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_original_funding_note TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_paid_at TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_paid_by TEXT;         -- admin/moderator user id who clicked Refunded
ALTER TABLE layaway_plans ADD COLUMN refund_confirm_deadline TEXT; -- 24h after refund_paid_at
ALTER TABLE layaway_plans ADD COLUMN refund_confirmed_at TEXT;
ALTER TABLE layaway_plans ADD COLUMN refund_confirmed_by TEXT;     -- 'buyer' or 'system'
ALTER TABLE layaway_plans ADD COLUMN purge_at TEXT;                -- 12h after refund_confirmed_at, then hard delete

-- ── orders.layaway_plan_id -----------------------------------------------
-- Links an order back to its layaway plan so order-detail pages can fetch
-- and render plan progress, cancellation, and refund status directly.
ALTER TABLE orders ADD COLUMN layaway_plan_id TEXT;

CREATE INDEX IF NOT EXISTS idx_layaway_plans_refund_status ON layaway_plans(refund_status);
CREATE INDEX IF NOT EXISTS idx_layaway_plans_purge_at ON layaway_plans(purge_at);

-- ── Quantity on a layaway plan ---------------------------------------
-- No schema change needed -- quantity for a plan is carried on the
-- underlying order's line_items JSON (same field BuyNowModal already
-- uses for bulk-qty purchases), and layaway_plans.total_amount already
-- reflects unitPrice * qty. Layaway still never uses the cart: one plan
-- always covers exactly one listing, with quantity folded into that one
-- plan's total and deposit rather than combined across separate plans.
