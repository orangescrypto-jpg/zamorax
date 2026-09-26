export interface SellerAddress {
  id: string
  state: string
  city: string
  label?: string
}

const STATE_NEIGHBORS: Record<string, string[]> = {
  "Abia": ["Imo", "Rivers", "Akwa Ibom", "Ebonyi", "Anambra"],
  "Adamawa": ["Borno", "Gombe", "Taraba"],
  "Akwa Ibom": ["Abia", "Rivers", "Cross River"],
  "Anambra": ["Abia", "Imo", "Enugu", "Kogi", "Delta"],
  "Bauchi": ["Kano", "Jigawa", "Yobe", "Gombe", "Taraba", "Plateau", "Kaduna"],
  "Bayelsa": ["Rivers", "Delta"],
  "Benue": ["Nasarawa", "Taraba", "Cross River", "Enugu", "Kogi"],
  "Borno": ["Yobe", "Adamawa", "Gombe"],
  "Cross River": ["Akwa Ibom", "Abia", "Benue", "Ebonyi"],
  "Delta": ["Edo", "Anambra", "Bayelsa", "Rivers", "Imo"],
  "Ebonyi": ["Enugu", "Abia", "Cross River", "Benue"],
  "Edo": ["Delta", "Ondo", "Kogi", "Anambra"],
  "Ekiti": ["Ondo", "Osun", "Kwara", "Kogi"],
  "Enugu": ["Anambra", "Abia", "Ebonyi", "Benue", "Kogi"],
  "FCT": ["Niger", "Kaduna", "Nasarawa", "Kogi"],
  "Gombe": ["Bauchi", "Borno", "Yobe", "Adamawa", "Taraba"],
  "Imo": ["Abia", "Rivers", "Anambra", "Delta"],
  "Jigawa": ["Kano", "Bauchi", "Yobe", "Katsina"],
  "Kaduna": ["Katsina", "Zamfara", "Niger", "FCT", "Nasarawa", "Plateau", "Bauchi", "Kano"],
  "Kano": ["Jigawa", "Katsina", "Kaduna", "Bauchi"],
  "Katsina": ["Zamfara", "Kaduna", "Kano", "Jigawa"],
  "Kebbi": ["Sokoto", "Zamfara", "Niger"],
  "Kogi": ["Niger", "FCT", "Nasarawa", "Benue", "Enugu", "Anambra", "Edo", "Ekiti", "Kwara"],
  "Kwara": ["Niger", "Kogi", "Ekiti", "Osun", "Oyo"],
  "Lagos": ["Ogun"],
  "Nasarawa": ["FCT", "Kaduna", "Plateau", "Taraba", "Benue", "Kogi"],
  "Niger": ["Kebbi", "Zamfara", "Kaduna", "FCT", "Kogi", "Kwara"],
  "Ogun": ["Lagos", "Oyo", "Osun", "Ondo"],
  "Ondo": ["Ogun", "Osun", "Ekiti", "Edo", "Delta"],
  "Osun": ["Oyo", "Ogun", "Ondo", "Ekiti", "Kwara"],
  "Oyo": ["Kwara", "Osun", "Ogun"],
  "Plateau": ["Kaduna", "Bauchi", "Taraba", "Nasarawa"],
  "Rivers": ["Bayelsa", "Delta", "Imo", "Abia", "Akwa Ibom"],
  "Sokoto": ["Kebbi", "Zamfara"],
  "Taraba": ["Adamawa", "Gombe", "Bauchi", "Plateau", "Nasarawa", "Benue"],
  "Yobe": ["Borno", "Bauchi", "Jigawa", "Gombe"],
  "Zamfara": ["Sokoto", "Kebbi", "Niger", "Kaduna", "Katsina"],
}

// Picks the seller address closest to the buyer's state, to show as the
// single "ships from" location on cards/detail pages. Exact state match
// wins outright; otherwise we walk outward through STATE_NEIGHBORS ring by
// ring (1st-degree neighbors, then neighbors-of-neighbors, capped) and
// return the first address whose state appears in that ring. If nothing
// resolves within the cap (or buyerState is unknown), falls back to the
// seller's first listed address so the UI always has something to show.
export function resolveNearestAddress(
  addresses: SellerAddress[] | null | undefined,
  buyerState: string | null | undefined
): SellerAddress | null {
  if (!addresses || addresses.length === 0) return null
  if (addresses.length === 1) return addresses[0]

  if (buyerState) {
    const exact = addresses.find(a => a.state === buyerState)
    if (exact) return exact

    const visited = new Set<string>([buyerState])
    let ring = STATE_NEIGHBORS[buyerState] ?? []
    const MAX_RINGS = 4

    for (let hop = 0; hop < MAX_RINGS && ring.length > 0; hop++) {
      const match = addresses.find(a => ring.includes(a.state))
      if (match) return match

      ring.forEach(s => visited.add(s))
      const nextRing = new Set<string>()
      for (const s of ring) {
        for (const n of STATE_NEIGHBORS[s] ?? []) {
          if (!visited.has(n)) nextRing.add(n)
        }
      }
      ring = Array.from(nextRing)
    }
  }

  return addresses[0]
}
