# Zamorax - Updated Files Only (58 files)

Extract this zip into the ROOT of your project (same folder that contains `app/`, `components/`, `src/`, `migrations/`, `lib/`, `emails/`).
Folder paths are preserved, so files simply overwrite/add in place.

Baseline = original files (Sep 22 08:45). Everything below was added/modified after that.

## Listing card (ListingCard)
- components/listings/ListingCard.tsx

## Database migrations  (RUN THESE)
- migrations/0009_buyback.sql   (new tables + columns)
- migrations/0001_baseline_schema.sql

## Sub-settings (buybackEnabled, listingAutoDeleteDays)
- src/services/subSettings.ts
- app/(admin)/admin/sub-settings/page.tsx

## Contact reveal
- app/api/orders/[id]/reveal-contact/route.ts
- components/orders/RevealContactButton.tsx
- app/(buyer)/dashboard/buyer/orders/[id]/page.tsx
- app/(seller)/dashboard/seller/orders/[id]/page.tsx
- app/(admin)/admin/orders/page.tsx

## Stock enforcement
- lib/stockManagement.ts (new shared helper)
- app/api/orders/create-layaway/route.ts
- app/api/orders/create-verified-flutterwave/route.ts
- app/api/orders/create-verified-paystack/route.ts
- app/api/admin/recover-flutterwave-order/route.ts
- app/api/cart/confirm/route.ts
- app/api/cart/create-pending-orders/route.ts
- app/api/cron/layaway-sweep/route.ts
- app/api/orders/cancel-admin/route.ts
- app/api/orders/layaway-cancel/route.ts
- app/api/webhooks/flutterwave/route.ts

## Listing auto-delete + emails
- lib/r2/client.ts (r2Delete)
- app/api/cron/listing-expiry-sweep/route.ts
- emails/RestockReminder.tsx
- emails/BuybackRejected.tsx
- app/api/email/send/route.ts
- src/services/email.ts

## Used-goods fields (brand / warranty / known issues) + brand filter
- components/listings/ListingForm/Step2Details.tsx
- components/listings/ListingForm/index.tsx
- lib/validations/listing.ts
- app/api/listings/route.ts
- app/api/listings/[id]/route.ts
- src/services/providers/cloudflare/listings.ts
- src/types/index.ts
- components/listings/ListingFilter.tsx
- app/(public)/search/page.tsx
- components/listings/ListingDetailClient.tsx (also holds the safety-tip blocks)

## Sell for Cash (buyback)
- app/(public)/sell-for-cash/page.tsx
- components/buyback/SellForCashClient.tsx
- app/api/buyback/pricing/route.ts
- app/api/buyback/submit/route.ts
- app/api/buyback/upload/route.ts
- app/api/admin/buyback/[id]/route.ts
- app/(admin)/admin/buyback/pricing/page.tsx
- app/(admin)/admin/buyback/requests/page.tsx
- app/(moderator)/moderator/buyback/pricing/page.tsx
- app/(moderator)/moderator/buyback/requests/page.tsx
- components/admin/AdminNav.tsx
- components/moderator/ModeratorNav.tsx
- components/home/SellForCashBanner.tsx
- components/home/HomeClient.tsx
- components/layout/Navbar.tsx

## D1 proxy ("Unauthorized" fix + buyback table rules)
- app/api/d1/query/route.ts

## Layaway delivery address
- components/layaway/LayawayCheckoutPanel.tsx

## Phone edit
- app/api/auth/update-phone/route.ts
- components/account/EditPhoneField.tsx
- app/(buyer)/dashboard/buyer/settings/page.tsx
- app/(seller)/dashboard/seller/settings/page.tsx

## Layaway delivery fee (FBZ / ZamoraxLogic / Zamorax Direct)
- components/layaway/LayawayCheckoutPanel.tsx
- components/listings/ListingDetailClient.tsx
- app/api/orders/create-layaway/route.ts
- app/api/orders/create-layaway-manual/route.ts
- migrations/0009_buyback.sql (adds orders.delivery_fee_kobo)
