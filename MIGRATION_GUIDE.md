# Zamorax — Service Abstraction Layer
## Migration Guide

---

## What Was Built

```
src/
  types/
    index.ts                         ← All shared types, zero Firebase imports
  services/
    index.ts                         ← Barrel: import everything from here
    auth.ts                          ← Interface + provider switch
    listings.ts                      ← Interface + provider switch
    orders.ts                        ← Interface + provider switch
    users.ts                         ← Interface + provider switch
    storage.ts                       ← Interface + provider switch
    chat.ts                          ← Interface + provider switch
    disputes.ts                      ← Interface + provider switch
    offers.ts                        ← Interface + provider switch
    wallet.ts                        ← Interface + provider switch
    notifications.ts                 ← Interface + provider switch
    referrals.ts                     ← Interface + provider switch
    providers/
      firebase/
        auth.ts                      ← Firebase implementation
        listings.ts
        orders.ts
        users.ts
        storage.ts
        chat.ts
        disputes.ts
        offers.ts
        wallet.ts
        notifications.ts
        referrals.ts
hooks/
  useListings.ts                     ← Updated (no firebase imports)
  useChat.ts                         ← Updated (no firebase imports)
store/
  authStore.ts                       ← Updated (no firebase imports)
```

---

## How to Switch Backends Later

### Option A — Swap everything (e.g. Firebase → Supabase)

1. Create `src/services/providers/supabase/` with implementations
2. In each `src/services/*.ts`, change **one line**:

```ts
// Before:
export { AuthService } from "@/src/services/providers/firebase/auth"

// After:
export { AuthService } from "@/src/services/providers/supabase/auth"
```

That's it. **Zero changes to pages, components, or hooks.**

### Option B — Swap one service (e.g. keep Firebase Auth, move storage to S3)

Only change `src/services/storage.ts`. Everything else untouched.

---

## Step-by-Step Migration (fixing the remaining 130 files)

### Step 1 — Copy these files into your project

Drop all files from this zip into your project root, matching the paths.

### Step 2 — Update `lib/firebase/config.ts`

Add the `storage` export (see `lib/firebase/config.NOTE.ts`).

### Step 3 — Update `types/` files

Replace the Firebase-coupled types with `src/types/index.ts`.
Delete or update:
- `types/order.ts` → remove `Timestamp` import, timestamps become `string`
- `types/dispute.ts` → same
- `types/wallet.ts` → same
- `types/offer.ts` → same
- `types/notification.ts` → same
- `types/listing.ts` → same

Or simply re-export from `src/types`:
```ts
// types/order.ts
export type { Order, OrderType } from "@/src/types"
```

### Step 4 — Migrate hooks (5 files)

Pattern for every hook:

```ts
// BEFORE — direct firebase
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

// AFTER — service layer
import { ListingsService } from "@/src/services"
```

Files to update:
- `hooks/useListings.ts` ✅ (done — see this zip)
- `hooks/useChat.ts` ✅ (done — see this zip)
- `hooks/useCategories.ts`
- `hooks/usePushNotifications.ts`
- `hooks/usePaginatedCollection.ts`

### Step 5 — Migrate store

- `store/authStore.ts` ✅ (done — see this zip)

### Step 6 — Migrate components (~55 files)

Each component that currently imports from `firebase/*` should instead:

```ts
// BEFORE
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

await updateDoc(doc(db, "listings", id), { ... })

// AFTER
import { ListingsService } from "@/src/services"

await ListingsService.updateListing(id, { ... })
```

### Step 7 — Migrate pages (~60 files)

Same pattern as components. Admin pages that call Firestore directly
should go through `UsersService`, `ListingsService`, `DisputesService`, etc.

### Step 8 — Delete `lib/firebase/` service files

Once all consumers are migrated, delete:
- `lib/firebase/auth.ts`
- `lib/firebase/firestore.ts`
- `lib/firebase/adminDisputes.ts`
- `lib/firebase/adminListings.ts`
- `lib/firebase/adminUsers.ts`
- `lib/firebase/offers.ts`
- `lib/firebase/flashDeals.ts`
- `lib/firebase/referrals.ts`

Keep only:
- `lib/firebase/config.ts` ← the only Firebase bootstrap allowed

---

## The Rule Going Forward

> **Only `src/services/providers/firebase/*.ts` may import from `firebase/*`.**
> **Everything else imports from `src/services/`.**

To enforce this, add to your ESLint config:

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["firebase/*"],
        "message": "Import from @/src/services instead of firebase directly."
      }]
    }]
  },
  "overrides": [{
    "files": ["src/services/providers/**/*"],
    "rules": { "no-restricted-imports": "off" }
  }]
}
```

This makes the compiler enforce the rule — no accidental leaks.

---

## Timestamp Note

All timestamps are now **ISO strings** (`string`) instead of Firestore `Timestamp` objects.
The `toIso()` helper in each provider converts Firestore Timestamps automatically.

In your UI, use:
```ts
new Date(order.createdAt).toLocaleDateString()
// instead of
order.createdAt.toDate().toLocaleDateString()
```
