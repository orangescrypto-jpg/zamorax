-- 0016: auto-confirm support for shipped orders that the buyer never confirms.
-- auto_confirm_at: when the sweep will move the order to inspection.
-- auto_confirm_reminded_at: set once the pre-auto-confirm reminder was sent.
ALTER TABLE orders ADD COLUMN auto_confirm_at TEXT;
ALTER TABLE orders ADD COLUMN auto_confirm_reminded_at TEXT;
