-- 0003_add_users_store_profile_columns.sql
-- The seller "Store" settings page reads/writes several store-profile
-- fields that were never added to the users table — only store_name and
-- store_description existed. Saving any of these fails with:
--   "no such column: store_category: SQLITE_ERROR"
-- (and would fail again for the next missing column after that one is
-- patched, since none of them exist yet).

ALTER TABLE users ADD COLUMN store_category   TEXT;
ALTER TABLE users ADD COLUMN store_state      TEXT;
ALTER TABLE users ADD COLUMN store_city       TEXT;
ALTER TABLE users ADD COLUMN store_whatsapp   TEXT;
ALTER TABLE users ADD COLUMN store_instagram  TEXT;
ALTER TABLE users ADD COLUMN store_logo_url   TEXT;
ALTER TABLE users ADD COLUMN store_banner_url TEXT;
