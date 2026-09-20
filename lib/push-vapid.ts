// lib/push-vapid.ts
// Resolves the VAPID key pair used for Web Push.
// Order of precedence: push_vapid_keys row in D1 (set by admin in
// /admin/push-settings) -> NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
// env vars as a fallback. This lets an admin generate or paste keys from
// the dashboard without a redeploy, while still working out of the box
// if env vars are already set and the admin never touches the setting.

import { d1Query } from "@/lib/d1"

export interface VapidKeyPair {
  publicKey: string
  privateKey: string
  subject: string
  source: "database" | "env" | "none"
}

export async function getVapidKeys(nativeDB?: unknown): Promise<VapidKeyPair> {
  try {
    await d1Query(
      `CREATE TABLE IF NOT EXISTS push_vapid_keys (
        id TEXT PRIMARY KEY DEFAULT 'default',
        public_key TEXT, private_key TEXT, subject TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      [],
      nativeDB,
    )
    const rows = await d1Query(
      "SELECT public_key, private_key, subject FROM push_vapid_keys WHERE id = 'default' LIMIT 1",
      [],
      nativeDB,
    )
    const row = rows?.results?.[0] as
      | { public_key?: string; private_key?: string; subject?: string }
      | undefined

    if (row?.public_key && row?.private_key) {
      return {
        publicKey: row.public_key,
        privateKey: row.private_key,
        subject: row.subject || process.env.VAPID_SUBJECT || "mailto:support@zamorax.com",
        source: "database",
      }
    }
  } catch (err) {
    console.error("[push-vapid] DB lookup failed, falling back to env:", err)
  }

  const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const envPrivate = process.env.VAPID_PRIVATE_KEY
  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
      subject: process.env.VAPID_SUBJECT || "mailto:support@zamorax.com",
      source: "env",
    }
  }

  return { publicKey: "", privateKey: "", subject: "", source: "none" }
}

// Public key only -- safe to expose to the browser so it can subscribe.
export async function getPublicVapidKey(nativeDB?: unknown): Promise<string> {
  const keys = await getVapidKeys(nativeDB)
  return keys.publicKey
}
