// lib/upload-policy.ts
// Decides whether an upload or delete request is allowed. Pure functions with
// no I/O, so every rule can be tested against the exact paths the app builds.
//
// Why this exists: /api/upload used to store a file at whatever key the client
// asked for. Any signed-in user could overwrite another user's listing photo,
// write into archive/ (where order and transaction archives live), or upload
// files of any type and size. Each rule below closes one of those gaps.

export type Role = "buyer" | "seller" | "admin" | "staff" | string

/** Which folders each kind of user may write to, and how the key must be shaped. */
interface Rule {
  /** Regex the whole key must match. `{uid}` is replaced with the caller's id. */
  pattern: string
  /** Who may use it. Admin is always allowed on top of this. */
  roles: "any" | "admin"
  kind: "image" | "image-or-pdf" | "video" | "any-allowed"
}

// {uid}  = the caller's own user id (they may only write under their own id)
// {seg}  = one path segment (an order id, plan id, dispute id, placement...)
const SEG = "[A-Za-z0-9_-]{1,80}"
const NAME = "[^/\\\\]{1,180}" // a file name: no slashes, no backslashes

const RULES: Rule[] = [
  { pattern: `^listings/{uid}/${NAME}$`, roles: "any", kind: "image" },
  { pattern: `^listings/videos/{uid}/${NAME}$`, roles: "any", kind: "video" },
  { pattern: `^stores/{uid}/${NAME}$`, roles: "any", kind: "image" },
  { pattern: `^verifications/{uid}/${NAME}$`, roles: "any", kind: "image" },
  { pattern: `^payment-proofs/{uid}/${NAME}$`, roles: "any", kind: "image-or-pdf" },
  { pattern: `^payout-proofs/${SEG}/${NAME}$`, roles: "admin", kind: "image-or-pdf" },
  { pattern: `^disputes/${SEG}/${NAME}$`, roles: "any", kind: "image-or-pdf" },
  { pattern: `^disputes/${SEG}/seller/${NAME}$`, roles: "any", kind: "image-or-pdf" },
  { pattern: `^orders/${SEG}/${SEG}/${NAME}$`, roles: "any", kind: "image-or-pdf" },
  { pattern: `^returns/${SEG}/${NAME}$`, roles: "any", kind: "image" },
  { pattern: `^blog/covers/${NAME}$`, roles: "admin", kind: "image" },
  { pattern: `^blog/content/${NAME}$`, roles: "admin", kind: "image" },
  { pattern: `^featured-banners/{uid}/${NAME}$`, roles: "admin", kind: "image" },
  { pattern: `^site-banners/${SEG}/{uid}/${NAME}$`, roles: "admin", kind: "any-allowed" },
  { pattern: `^uploads/{uid}/${NAME}$`, roles: "any", kind: "image-or-pdf" },
]

/** Folders no client may ever write to or delete from. */
const FORBIDDEN_PREFIXES = ["archive/"]

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]
const PDF_TYPES = ["application/pdf"]
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB (the app already shrinks photos to under 1 MB)
export const MAX_PDF_BYTES = 8 * 1024 * 1024 // 8 MB
export const MAX_ANIMATED_BYTES = 12 * 1024 * 1024 // site banners may be short videos/gifs

export interface PolicyInput {
  key: string
  uid: string
  role: Role
  contentType: string
  size: number
  videoEnabled: boolean
  /** Video size cap in bytes, from the admin platform setting. */
  maxVideoBytes: number
}

export type PolicyResult = { ok: true; rule: Rule } | { ok: false; status: number; error: string }

/** True when the key is safe to use at all, independent of who is asking. */
export function isSafeKey(key: unknown): key is string {
  if (typeof key !== "string" || key.length === 0 || key.length > 400) return false
  if (key.startsWith("/") || key.includes("\\") || key.includes("//")) return false
  if (key.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return false
  // Control characters and null bytes have no place in a key.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(key)) return false
  return true
}

function matchRule(key: string, uid: string, role: Role): Rule | null {
  const escapedUid = uid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.replace(/\{uid\}/g, escapedUid))
    if (!re.test(key)) continue
    if (rule.roles === "admin" && role !== "admin" && role !== "staff") continue
    return rule
  }
  return null
}

/** Decides whether `uid` (with `role`) may store this file at this key. */
export function checkUpload(input: PolicyInput): PolicyResult {
  const { key, uid, role, contentType, size, videoEnabled, maxVideoBytes } = input
  if (!isSafeKey(key)) return { ok: false, status: 400, error: "Invalid upload path." }
  if (FORBIDDEN_PREFIXES.some((p) => key.startsWith(p))) {
    return { ok: false, status: 403, error: "That location cannot be written to." }
  }
  const rule = matchRule(key, uid, role)
  if (!rule) return { ok: false, status: 403, error: "You are not allowed to upload to that location." }

  const type = (contentType || "").toLowerCase().split(";")[0].trim()
  if (size <= 0) return { ok: false, status: 400, error: "The file is empty." }

  switch (rule.kind) {
    case "image":
      if (!IMAGE_TYPES.includes(type)) return { ok: false, status: 415, error: "Only image files are allowed here." }
      if (size > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: "Image is too large (max 5 MB)." }
      break
    case "image-or-pdf":
      if (![...IMAGE_TYPES, ...PDF_TYPES].includes(type)) return { ok: false, status: 415, error: "Only images or PDF files are allowed here." }
      if (size > (PDF_TYPES.includes(type) ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) {
        return { ok: false, status: 413, error: "File is too large (max 5 MB for images, 8 MB for PDFs)." }
      }
      break
    case "video":
      if (!videoEnabled) return { ok: false, status: 403, error: "Video uploads are turned off." }
      if (!VIDEO_TYPES.includes(type)) return { ok: false, status: 415, error: "Only MP4, WebM or MOV video is allowed." }
      if (size > maxVideoBytes) return { ok: false, status: 413, error: `Video is too large (max ${Math.round(maxVideoBytes / 1024 / 1024)} MB).` }
      break
    case "any-allowed":
      if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(type)) return { ok: false, status: 415, error: "Only images or video are allowed here." }
      if (size > MAX_ANIMATED_BYTES) return { ok: false, status: 413, error: "File is too large (max 12 MB)." }
      break
  }
  return { ok: true, rule }
}

/**
 * Decides whether `uid` may delete this key. A user may delete only files
 * inside a folder that is theirs. Admins may delete anything except archives.
 * (The old route let any signed-in user delete any file in the bucket.)
 */
export function checkDelete(key: unknown, uid: string, role: Role): PolicyResult | { ok: true; rule: null } {
  if (!isSafeKey(key)) return { ok: false, status: 400, error: "Invalid path." }
  if (FORBIDDEN_PREFIXES.some((p) => key.startsWith(p))) {
    return { ok: false, status: 403, error: "That location cannot be deleted from." }
  }
  if (role === "admin" || role === "staff") return { ok: true, rule: null }
  // Non-admins: only their own uid-scoped folders.
  const escapedUid = uid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const own = [
    `^listings/${escapedUid}/`,
    `^listings/videos/${escapedUid}/`,
    `^stores/${escapedUid}/`,
    `^payment-proofs/${escapedUid}/`,
    `^uploads/${escapedUid}/`,
  ]
  if (own.some((p) => new RegExp(p).test(key))) return { ok: true, rule: null }
  return { ok: false, status: 403, error: "You can only delete your own files." }
}
