// lib/buyback/settings.ts
// Defaults and merge logic for the admin-editable Sell for Cash content.
// The public form and the settings API both import this, so wording is
// always defined even before an admin saves anything.

export interface ConfirmationItem {
  /** Stable key stored with each request, e.g. "owner". Never rename. */
  key: string
  /** Text the seller sees next to the checkbox. Admin-editable. */
  label: string
}

export interface TrustPoint {
  title: string
  text: string
}

export interface BuybackSettings {
  heading: string
  subheading: string

  noticeTitle: string
  /** Bullet lines shown in the notice before the form. */
  noticeLines: string[]
  listItYourselfText: string

  /** Checkboxes the seller must tick before submitting. */
  confirmations: ConfirmationItem[]

  /** Categories shown on the form. Slug must match buyback_pricing. */
  categoryLabels: Record<string, string>
  /** Category slugs hidden from the form. */
  disabledCategories: string[]

  minPhotos: number
  maxPhotos: number
  photoHelp: string

  descriptionLabel: string
  descriptionHelp: string
  descriptionPlaceholder: string

  successTitle: string
  successMessage: string

  trustPoints: TrustPoint[]
}

export const DEFAULT_BUYBACK_SETTINGS: BuybackSettings = {
  heading: "Sell for Cash",
  subheading:
    "Tell us about your device, see your offer straight away, and we will arrange to inspect it and pay you.",

  noticeTitle: "Before you continue",
  noticeLines: [
    "This is a request to sell now. Please do not submit if you only want to check a price or you are not ready to sell.",
    "The device must belong to you. Bring your receipt or other proof of purchase to the meet-up, where we verify ownership in person.",
    "Devices that are lost, stolen or blocked cannot be bought.",
    "Your offer is an estimate and is confirmed after we inspect the device.",
  ],
  listItYourselfText:
    "Want to set your own price? List the device yourself on Zamorax.",

  confirmations: [
    { key: "owner", label: "I am the legal owner of this device." },
    { key: "not_stolen", label: "The device is not lost, stolen or blocked." },
    { key: "ready_to_sell", label: "I am ready to sell this device now." },
    {
      key: "subject_to_inspection",
      label: "I understand the offer is subject to inspection.",
    },
  ],

  categoryLabels: {
    "phones-tablets": "Phones & Tablets",
    computing: "Computers",
    electronics: "Electronics",
  },
  disabledCategories: [],

  minPhotos: 1,
  maxPhotos: 8,
  photoHelp: "Add clear photos of the front, back and any damage.",

  descriptionLabel: "Describe your device",
  descriptionHelp:
    "Tell us anything worth knowing, such as scratches, repairs, battery health, missing accessories or anything that does not work.",
  descriptionPlaceholder: "e.g. Small scratch on the back, battery lasts a full day, comes with box and charger",

  successTitle: "Request submitted",
  successMessage:
    "We will contact you shortly to arrange the handover. Please bring your receipt or other proof of purchase to the meet-up. Payment is made after your device is inspected.",

  trustPoints: [
    { title: "Paid after inspection", text: "You are paid once we have checked the device." },
    { title: "Clear offers", text: "See your estimate before you share contact details." },
    { title: "Safe handover", text: "Drop off at a warehouse or meet at a place you choose." },
  ],
}

const str = (v: unknown, fallback: string) =>
  typeof v === "string" && v.trim() ? v : fallback

const strList = (v: unknown, fallback: string[]) =>
  Array.isArray(v) && v.length > 0
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : fallback

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

/** Merges saved (possibly partial or malformed) values over the defaults. */
export function mergeBuybackSettings(saved: Record<string, unknown> | null | undefined): BuybackSettings {
  const d = DEFAULT_BUYBACK_SETTINGS
  const s = saved ?? {}

  const confirmations = Array.isArray(s.confirmations)
    ? (s.confirmations as any[])
        .filter(c => c && typeof c.key === "string" && typeof c.label === "string" && c.label.trim())
        .map(c => ({ key: String(c.key), label: String(c.label) }))
    : []

  const trustPoints = Array.isArray(s.trustPoints)
    ? (s.trustPoints as any[])
        .filter(t => t && typeof t.title === "string" && t.title.trim())
        .map(t => ({ title: String(t.title), text: String(t.text ?? "") }))
    : null

  const categoryLabels =
    s.categoryLabels && typeof s.categoryLabels === "object"
      ? Object.fromEntries(
          Object.entries(s.categoryLabels as Record<string, unknown>).filter(
            ([, v]) => typeof v === "string" && v.trim(),
          ),
        ) as Record<string, string>
      : {}

  const minPhotos = num(s.minPhotos, d.minPhotos, 1, 20)
  const maxPhotos = Math.max(minPhotos, num(s.maxPhotos, d.maxPhotos, 1, 20))

  return {
    heading: str(s.heading, d.heading),
    subheading: str(s.subheading, d.subheading),
    noticeTitle: str(s.noticeTitle, d.noticeTitle),
    noticeLines: strList(s.noticeLines, d.noticeLines),
    listItYourselfText: str(s.listItYourselfText, d.listItYourselfText),
    confirmations: confirmations.length > 0 ? confirmations : d.confirmations,
    categoryLabels: Object.keys(categoryLabels).length > 0 ? categoryLabels : d.categoryLabels,
    disabledCategories: Array.isArray(s.disabledCategories)
      ? (s.disabledCategories as unknown[]).filter((x): x is string => typeof x === "string")
      : d.disabledCategories,
    minPhotos,
    maxPhotos,
    photoHelp: str(s.photoHelp, d.photoHelp),
    descriptionLabel: str(s.descriptionLabel, d.descriptionLabel),
    descriptionHelp: str(s.descriptionHelp, d.descriptionHelp),
    descriptionPlaceholder: str(s.descriptionPlaceholder, d.descriptionPlaceholder),
    successTitle: str(s.successTitle, d.successTitle),
    successMessage: str(s.successMessage, d.successMessage),
    trustPoints: trustPoints && trustPoints.length > 0 ? trustPoints : d.trustPoints,
  }
}
