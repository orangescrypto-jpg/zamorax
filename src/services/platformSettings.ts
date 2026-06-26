// src/services/platformSettings.ts
// Single source of truth for platform config.
// All Firestore reads go through AdminService — no direct Firebase imports.
// Components never import this directly; they use hooks/usePlatformSettings.ts.

import { AdminService } from "@/src/services"

// ─── Full settings type ────────────────────────────────────────────────────

export interface PlatformSettings {
  // Fees
  commissionSale: number
  commissionRental: number
  insuranceRate: number
  withdrawalFee: number
  // Free plan (no payment, admin-configurable limits)
  planFreeListingLimit: number           // max active listings on free plan (default 5)
  planFreeBoosts: number                 // free boosts included per month (default 0)
  planFreeLabel: string                  // badge label, e.g. "" or "🆓 Free"
  planStarterPrice: number
  planStarterBillingMonths: number
  planStarterListingLimit: number
  planStarterFreeBoosts: number
  planStarterLabel: string

  planProPrice: number
  planProBillingMonths: number
  planProListingLimit: number
  planProFreeBoosts: number
  planProLabel: string

  boostStandard: number
  boostStandardDays: number
  boostStandardLabel: string
  boostStandardDesc: string

  boostPremium: number
  boostPremiumDays: number
  boostPremiumLabel: string
  boostPremiumDesc: string

  boostCategoryTop: number
  boostCategoryTopDays: number
  boostCategoryTopLabel: string
  boostCategoryTopDesc: string

  // ── Ad Boost (external campaign feature) ─────────────────────────────────
  adBoostEnabled: boolean                  // master on/off toggle
  adBoostPriceStandard: number             // kobo — Ad Boost only (default ₦15,000)
  adBoostPriceCombined: number             // kobo — internal + Ad Boost bundle (default ₦18,000)
  adBoostAdSpendStandard: number           // kobo — portion going to actual ad spend
  adBoostMarginStandard: number            // kobo — platform margin
  adBoostAdSpendCombined: number           // kobo
  adBoostMarginCombined: number            // kobo
  adBoostMaxProductsPerCampaign: number    // max products batched per weekly campaign
  adBoostCampaignDurationDays: number      // campaign window in days (default 7)

  hubVerificationFee: number
  minPayoutAmount: number
  // Promo codes
  promoEnabled: boolean
  maxPromoDiscountPercent: number
  // AI chatbot
  chatbotEnabled: boolean
  chatbotGreeting: string
  // Image watermark
  imageWatermarkEnabled: boolean
  // Personalised feed
  personalisedFeedEnabled: boolean
  // Offer system
  offersEnabled: boolean
  makeOfferEnabled: boolean             // feature flag for the MakeOfferModal on listing pages
  minOfferPercent: number
  // Reviews
  reviewsEnabled: boolean
  reviewMinDaysAfterOrder: number
  // Return guarantee
  returnWindowDays: number
  returnGuaranteeBadgeVisible: boolean
  // Back-in-stock
  backInStockAlertsEnabled: boolean
  maxBackInStockPerUser: number
  // Safe meet
  safeMeetEnabled: boolean
  // Chat feature
  chatEnabled: boolean                // master toggle — admin can disable all buyer-seller chat
  chatEscrowLockEnabled: boolean      // contact masking before escrow is funded
  // WhatsApp support
  whatsappSupportEnabled: boolean
  whatsappSupportNumber: string
  whatsappSupportMessage: string
  // Blog
  blogEnabled: boolean
  moderatorCanPublishBlog: boolean
  // Seller trust score
  trustScoreVisible: boolean
  trustScoreNinWeight: number
  trustScoreBvnWeight: number
  // QR handshake
  qrHandshakeRequired: boolean
  // PWA install prompt
  pwaInstallPromptEnabled: boolean
  pwaInstallPromptDelaySec: number
  pwaReshowAfterDismissSec: number    // seconds before re-showing after dismiss (default: 86400)
  pwaHeadline: string                 // default: "Install Zamorax App"
  pwaSubtitle: string                 // default: "Add to home screen for faster access"
  // Push opt-in prompt
  pushNotifsEnabled: boolean
  pushPriceDropAlertsEnabled: boolean
  pushOptInPromptDelaySec: number
  // Media uploads
  maxImagesPerListing: number
  videoUploadEnabled: boolean
  maxVideoSizeMb: number
  videoMaxDurationSec: number
  videoRequiredForPlan: "none" | "starter" | "pro"
  allowedVideoTypes: string[]
  // Inspection window
  buyerInspectionWindowHours: number
  showInspectionCountdown: boolean
  // Insurance pool
  insuranceCollectionEnabled: boolean
  insuranceRequiredForRentals: boolean
  // Identity verification
  requireNinBvnBeforeListing: boolean
  requireNinBeforeOrders: boolean
  requireNinBeforeChat: boolean
  acceptNewNinSubmissions: boolean
  acceptNewBvnSubmissions: boolean
  requireSelfieForVerification: boolean
  autoApproveVerifications: boolean
  verificationReviewSlaHours: number
  verificationReviewMessage: string
  maxSelfieSizeMb: number
  emailVerificationRequired: boolean
  // Announcement bar
  announcementBarEnabled: boolean
  announcementBarMessage: string
  announcementBarColor: "info" | "warning" | "success" | "danger"
  // Platform gates
  listingCreationEnabled: boolean
  minListingPriceKobo: number
  disputeFilingEnabled: boolean
  newUserRegistrationEnabled: boolean
  maintenanceMode: boolean
  maintenanceMessage: string
  // Homepage sections
  homepageHeroBannerEnabled: boolean
  homepageFeaturedListingsEnabled: boolean
  // Group buy
  groupBuyEnabled: boolean
  groupBuyMinParticipants: number
  groupBuyDiscountPercent: number
  // Bundles
  bundlesEnabled: boolean
  // New features
  promoCodesEnabled: boolean            // seller promo codes
  shareListingEnabled: boolean          // native share sheet on listing pages
  listingDuplicationEnabled: boolean    // "Copy listing" button in seller dashboard
  stockViewAlertEnabled: boolean        // notify seller when listing hits X views with no sale
  stockViewAlertThreshold: number       // views threshold to trigger alert (e.g. 50)
  maxBundleItems: number
  maxBundleDiscountPercent: number
  // Social / contact
  socialTwitterUrl: string
  socialInstagramUrl: string
  socialLinkedInUrl: string
  socialWhatsAppNumber: string
  contactEmail: string
  // Contact page details
  contactAddress: string          // e.g. "14 Admiralty Way, Lekki Phase 1, Lagos"
  contactPhone: string            // WhatsApp display number e.g. "+234 701 234 5678"
  supportHours: string            // e.g. "Monday–Saturday: 9AM–6PM WAT"
  // Exchange rate
  usdToNgnRate: number
  // Payment
  activePaymentProvider: "manual" | "paystack" | "flutterwave"
  // Flash deals
  flashDealsEnabled: boolean
  // Auto-resolve disputes
  autoResolveEnabled: boolean
  autoResolveItemNotReceivedDays: number
  autoResolveNoTrackingDays: number
  autoResolveSellerNoResponseHours: number
  autoResolveInspectionWindowDays: number
  autoResolveLowValueThreshold: number
  // Buyer badges
  badgeVerifiedBuyerOrders: number
  badgeTrustedBuyerOrders: number
  badgePowerBuyerOrders: number
  // FBZ extended
  fbzStorageFeePerDayKobo: number
  fbzFulfillmentFeeKobo: number
  fbzWarehouseCapacity: number
  fbzAutoRejectDamagedGoods: boolean
  fbzRequireInsurance: boolean
  fbzInsuranceRatePercent: number
  fbzWarehouseAddress: string
  fbzWarehousePhone: string
  fbzWarehouseHours: string
  fbzInboundFeeKobo: number
  fbzPickPackFeeKobo: number
  fbzDeliveryPartner: string
  fbzDeliveryDaysMin: number
  fbzDeliveryDaysMax: number
  // Logistics zone fees (kobo)
  logisticsEnabled: boolean
  feeIntrastate: number
  feeSWtoSW: number
  feeSWtoSE: number
  feeSWtoSS: number
  feeSWtoNC: number
  feeSWtoNW: number
  feeSWtoNE: number
  feeSEtoSE: number
  feeSEtoSS: number
  feeSEtoNC: number
  feeNCtoNC: number
  feeNWtoNW: number
  feeNEtoNE: number
  feeFarCrossCountry: number
  doorstepSurchargeKobo: number
  // Feature flags
  rentalsEnabled: boolean
  qnaEnabled: boolean
  qnaSellerResponseSLAHours: number
  instantPayoutEnabled: boolean
  payoutProcessingHours: number
  maxSearchAlertsPerUser: number
  searchAlertCooldownHours: number
  newZlaRegistrationOpen: boolean
  // ZLA agent commissions
  zlaParcelReceivedKobo: number
  zlaParcelDispatchedKobo: number
  zlaParcelDeliveredKobo: number
  zlaDoorstepBonusKobo: number
  // Coverage
  zlaCoveredStates: string[]
  fbzCoveredStates: string[]
  // ── Multi-Cart ────────────────────────────────────────────────
  multiCartEnabled: boolean             // master toggle for multi-item cart
  maxCartItems: number                  // max distinct items in cart
  maxQtyPerItem: number                 // max quantity per listing in cart
  lowStockThreshold: number             // show "Only X left" warning below this qty
  showLowStockWarning: boolean          // toggle the low-stock warning display
  // ── Price Alerts ──────────────────────────────────────────────
  priceAlertsEnabled: boolean           // allow buyers to set price drop alerts
  // ── Recently Viewed ───────────────────────────────────────────
  recentlyViewedEnabled: boolean        // show recently viewed row on homepage
  // ── Seller Follows ────────────────────────────────────────────
  sellerFollowsEnabled: boolean         // allow buyers to follow seller stores
  // ── Vacation Mode ─────────────────────────────────────────────
  vacationModeEnabled: boolean          // allow sellers to enable vacation mode

  // ── Homepage: How It Works section ────────────────────────────
  howItWorksEnabled: boolean            // show/hide the section
  howItWorksTitle: string               // section heading
  howItWorksStepCount: number           // 2, 3, or 4 active steps
  howItWorksStep1Icon: string
  howItWorksStep1Title: string
  howItWorksStep1Desc: string
  howItWorksStep2Icon: string
  howItWorksStep2Title: string
  howItWorksStep2Desc: string
  howItWorksStep3Icon: string
  howItWorksStep3Title: string
  howItWorksStep3Desc: string
  howItWorksStep4Icon: string
  howItWorksStep4Title: string
  howItWorksStep4Desc: string

  // ── Homepage: Social Proof / Platform Stats bar ────────────────
  platformStatsEnabled: boolean         // show/hide the stats bar
  platformStatListings: string          // e.g. "50,000+"
  platformStatSellers: string           // e.g. "12,000+"
  platformStatBuyers: string            // e.g. "80,000+"
  platformStatTransactions: string      // e.g. "₦2B+"
}

// ─── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: PlatformSettings = {
  commissionSale: 5,
  commissionRental: 7,
  insuranceRate: 1,
  withdrawalFee: 10000,
  // Free plan defaults
  planFreeListingLimit: 5,
  planFreeBoosts: 0,
  planFreeLabel: "",
  planStarterPrice: 500000,
  planStarterBillingMonths: 1,
  planStarterListingLimit: 20,
  planStarterFreeBoosts: 1,
  planStarterLabel: "⭐ Most Popular",

  planProPrice: 1500000,
  planProBillingMonths: 1,
  planProListingLimit: 0,
  planProFreeBoosts: 3,
  planProLabel: "",

  boostStandard: 50000,
  boostStandardDays: 7,
  boostStandardLabel: "Standard",
  boostStandardDesc: "3× more views. Appear higher in category search results.",

  boostPremium: 150000,
  boostPremiumDays: 14,
  boostPremiumLabel: "Premium",
  boostPremiumDesc: "Top 3 placement in search. Homepage featured section.",

  boostCategoryTop: 300000,
  boostCategoryTopDays: 7,
  boostCategoryTopLabel: "Category Top",
  boostCategoryTopDesc: "#1 spot in your category. Maximum visibility.",

  // Ad Boost defaults
  adBoostEnabled: false,
  adBoostPriceStandard: 1500000,           // ₦15,000 kobo
  adBoostPriceCombined: 1800000,           // ₦18,000 kobo
  adBoostAdSpendStandard: 800000,          // ₦8,000 kobo ad spend
  adBoostMarginStandard: 700000,           // ₦7,000 kobo margin
  adBoostAdSpendCombined: 1000000,         // ₦10,000 kobo ad spend
  adBoostMarginCombined: 800000,           // ₦8,000 kobo margin
  adBoostMaxProductsPerCampaign: 6,
  adBoostCampaignDurationDays: 7,

  hubVerificationFee: 200000,
  minPayoutAmount: 100000,
  promoEnabled: true,
  maxPromoDiscountPercent: 50,
  chatbotEnabled: true,
  chatbotGreeting: "Hi! I'm Zamorax AI. How can I help you today?",
  imageWatermarkEnabled: true,
  personalisedFeedEnabled: true,
  offersEnabled: true,
  makeOfferEnabled: true,
  minOfferPercent: 50,
  reviewsEnabled: true,
  reviewMinDaysAfterOrder: 1,
  returnWindowDays: 3,
  returnGuaranteeBadgeVisible: true,
  backInStockAlertsEnabled: true,
  maxBackInStockPerUser: 20,
  safeMeetEnabled: true,
  chatEnabled: true,
  chatEscrowLockEnabled: true,
  whatsappSupportEnabled: true,
  whatsappSupportNumber: "2347076479357",
  whatsappSupportMessage: "Hi Zamorax Support, I need help with",
  blogEnabled: true,
  moderatorCanPublishBlog: true,
  trustScoreVisible: true,
  trustScoreNinWeight: 20,
  trustScoreBvnWeight: 15,
  qrHandshakeRequired: false,
  pwaInstallPromptEnabled: true,
  pwaInstallPromptDelaySec: 0,
  pwaReshowAfterDismissSec: 86400,
  pwaHeadline: "Install Zamorax App",
  pwaSubtitle: "Add to home screen for faster access",
  pushNotifsEnabled: true,
  pushPriceDropAlertsEnabled: true,
  pushOptInPromptDelaySec: 30,
  maxImagesPerListing: 10,
  videoUploadEnabled: false,
  maxVideoSizeMb: 50,
  videoMaxDurationSec: 60,
  videoRequiredForPlan: "none",
  allowedVideoTypes: ["video/mp4", "video/quicktime", "video/webm"],
  buyerInspectionWindowHours: 24,
  showInspectionCountdown: true,
  insuranceCollectionEnabled: true,
  insuranceRequiredForRentals: false,
  requireNinBvnBeforeListing: true,
  requireNinBeforeOrders: false,
  requireNinBeforeChat: false,
  acceptNewNinSubmissions: true,
  acceptNewBvnSubmissions: true,
  requireSelfieForVerification: true,
  autoApproveVerifications: false,
  verificationReviewSlaHours: 24,
  verificationReviewMessage: "Your submission is under review. Usually approved within 24 hours.",
  maxSelfieSizeMb: 5,
  emailVerificationRequired: true,
  announcementBarEnabled: false,
  announcementBarMessage: "",
  announcementBarColor: "info",
  listingCreationEnabled: true,
  minListingPriceKobo: 50000,
  disputeFilingEnabled: true,
  newUserRegistrationEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  homepageHeroBannerEnabled: true,
  homepageFeaturedListingsEnabled: true,
  groupBuyEnabled: true,
  groupBuyMinParticipants: 5,
  groupBuyDiscountPercent: 15,
  bundlesEnabled: true,
  promoCodesEnabled: true,
  shareListingEnabled: true,
  listingDuplicationEnabled: true,
  stockViewAlertEnabled: true,
  stockViewAlertThreshold: 50,
  maxBundleItems: 5,
  maxBundleDiscountPercent: 30,
  socialTwitterUrl: "",
  socialInstagramUrl: "",
  socialLinkedInUrl: "",
  socialWhatsAppNumber: "",
  contactEmail: "hello@zamorax.ng",
  contactAddress: "",
  contactPhone: "",
  supportHours: "Monday–Saturday: 9AM–6PM WAT",
  usdToNgnRate: 1600,
  activePaymentProvider: "manual",
  flashDealsEnabled: true,
  autoResolveEnabled: true,
  autoResolveItemNotReceivedDays: 14,
  autoResolveNoTrackingDays: 7,
  autoResolveSellerNoResponseHours: 48,
  autoResolveInspectionWindowDays: 3,
  autoResolveLowValueThreshold: 500000,
  badgeVerifiedBuyerOrders: 5,
  badgeTrustedBuyerOrders: 20,
  badgePowerBuyerOrders: 50,
  fbzStorageFeePerDayKobo: 500,
  fbzFulfillmentFeeKobo: 1500,
  fbzWarehouseCapacity: 10000,
  fbzAutoRejectDamagedGoods: true,
  fbzRequireInsurance: false,
  fbzInsuranceRatePercent: 0.5,
  fbzWarehouseAddress: "",
  fbzWarehousePhone: "",
  fbzWarehouseHours: "Mon–Sat, 9am–5pm",
  fbzInboundFeeKobo: 50000,
  fbzPickPackFeeKobo: 40000,
  fbzDeliveryPartner: "GIG Logistics",
  fbzDeliveryDaysMin: 1,
  fbzDeliveryDaysMax: 3,
  logisticsEnabled: true,
  feeIntrastate: 150000,
  feeSWtoSW: 200000,
  feeSWtoSE: 350000,
  feeSWtoSS: 350000,
  feeSWtoNC: 300000,
  feeSWtoNW: 450000,
  feeSWtoNE: 500000,
  feeSEtoSE: 200000,
  feeSEtoSS: 300000,
  feeSEtoNC: 350000,
  feeNCtoNC: 200000,
  feeNWtoNW: 200000,
  feeNEtoNE: 200000,
  feeFarCrossCountry: 500000,
  doorstepSurchargeKobo: 50000,
  rentalsEnabled: true,
  qnaEnabled: true,
  qnaSellerResponseSLAHours: 24,
  instantPayoutEnabled: true,
  payoutProcessingHours: 24,
  maxSearchAlertsPerUser: 10,
  searchAlertCooldownHours: 6,
  newZlaRegistrationOpen: true,
  zlaParcelReceivedKobo: 20000,
  zlaParcelDispatchedKobo: 15000,
  zlaParcelDeliveredKobo: 30000,
  zlaDoorstepBonusKobo: 10000,
  zlaCoveredStates: [],
  fbzCoveredStates: [],
  // Multi-Cart
  multiCartEnabled: true,
  maxCartItems: 20,
  maxQtyPerItem: 10,
  lowStockThreshold: 3,
  showLowStockWarning: true,
  // Price Alerts
  priceAlertsEnabled: true,
  // Recently Viewed
  recentlyViewedEnabled: true,
  // Seller Follows
  sellerFollowsEnabled: true,
  // Vacation Mode
  vacationModeEnabled: true,

  // How It Works
  howItWorksEnabled: true,
  howItWorksTitle: "How Zamorax Works",
  howItWorksStepCount: 3,
  howItWorksStep1Icon: "Tag",
  howItWorksStep1Title: "List Your Item",
  howItWorksStep1Desc: "Post for free in under 2 minutes. Add photos, set your price, and go live instantly.",
  howItWorksStep2Icon: "ShieldCheck",
  howItWorksStep2Title: "Buyer Pays into Escrow",
  howItWorksStep2Desc: "Payment is held securely. Your money is safe until the buyer confirms delivery.",
  howItWorksStep3Icon: "BadgeCheck",
  howItWorksStep3Title: "Funds Released",
  howItWorksStep3Desc: "Once the buyer confirms receipt, funds are released to your wallet. Simple.",
  howItWorksStep4Icon: "Truck",
  howItWorksStep4Title: "Fast Delivery",
  howItWorksStep4Desc: "Nationwide delivery via ZamoraxLogic. Track your parcel in real time.",

  // Platform Stats
  platformStatsEnabled: true,
  platformStatListings: "50,000+",
  platformStatSellers: "12,000+",
  platformStatBuyers: "80,000+",
  platformStatTransactions: "₦2B+",
}

// ─── Service method ─────────────────────────────────────────────────────────

let _cached: PlatformSettings | null = null

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (_cached) return _cached
  try {
    const base = typeof window === "undefined"
      ? (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
      : ""
    const res = await fetch(`${base}/api/admin/settings`, { cache: "no-store" })
    const json = await res.json()
    if (json?.settings) {
      _cached = { ...DEFAULT_SETTINGS, ...(json.settings as Partial<PlatformSettings>) }
      return _cached
    }
  } catch { /* use defaults */ }
  return DEFAULT_SETTINGS
}

export function invalidateSettingsCache() {
  _cached = null
}

export function subscribeToPlatformSettings(
  callback: (settings: PlatformSettings) => void
): () => void {
  return AdminService.subscribeToDoc("config", "platform", doc => {
    const settings = doc
      ? { ...DEFAULT_SETTINGS, ...(doc as Partial<PlatformSettings>) }
      : DEFAULT_SETTINGS
    _cached = settings
    callback(settings)
  })
}
