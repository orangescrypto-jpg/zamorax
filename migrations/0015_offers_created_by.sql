-- 0015_offers_created_by.sql
-- Records who created each offer row so the D1 proxy can enforce that an offer
-- is accepted by the OTHER party (a buyer can no longer create an offer and
-- accept it themselves at any price). Existing rows keep created_by NULL and
-- stay usable; only rows created after this migration are protected.
ALTER TABLE offers ADD COLUMN created_by TEXT;
