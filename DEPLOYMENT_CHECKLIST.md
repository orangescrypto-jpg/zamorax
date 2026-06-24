# 🚀 ZAMORAX PRODUCTION DEPLOYMENT CHECKLIST

## 1. VERCEL SETUP
- [ ] Create new project at `vercel.com/new`
- [ ] Connect GitHub repo (`zamorax`)
- [ ] Set Framework Preset: `Next.js`
- [ ] Root Directory: `./`
- [ ] Build Command: `next build` (default)
- [ ] Output Directory: `.next` (default)
- [ ] **Environment Variables**: Copy ALL keys from `.env.local.example` into Vercel Dashboard > Settings > Environment Variables (Set to `Production` scope)
- [ ] Deploy

## 2. FIREBASE DEPLOYMENT
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Login: `firebase login`
- [ ] Initialize (if not done): `firebase init firestore storage`
- [ ] Deploy Security Rules: `firebase deploy --only firestore:rules,storage:rules`
- [ ] Verify Firestore Indexes: Check Firebase Console > Firestore > Indexes. Wait for composite indexes to build.
- [ ] Enable Authentication: Email/Password, Phone OTP, Google Sign-In

## 3. DNS & DOMAIN (OPTIONAL)
- [ ] Buy domain (e.g., `zamorax.ng`)
- [ ] In Vercel Dashboard > Domains > Add Domain
- [ ] Add `CNAME` record pointing to `cname.vercel-dns.com`
- [ ] Wait for SSL propagation (5–30 mins)

## 4. PRODUCTION VERIFICATION
- [ ] Test Registration Flow (Buyer)
- [ ] Test Login & Dashboard Routing
- [ ] Test Listing Post (Images upload to Firebase)
- [ ] Test Search & Filter Queries
- [ ] Test Admin Moderation (`/admin/listings`)
- [ ] Test Chat Escrow Lock
- [ ] Test PWA Install Prompt (Mobile Chrome)

## 5. POST-LAUNCH MONITORING
- [ ] Enable Vercel Analytics & Speed Insights
- [ ] Set up Firebase Crashlytics/Sentry for error tracking
- [ ] Monitor Firestore usage & quotas (Blaze plan required)
- [ ] Configure Paystack Webhooks (`/api/payments/paystack/webhook`)
- [ ] Schedule Cloud Functions (`autoReleaseEscrow`) via `firebase deploy --only functions`

## 🔒 SECURITY REMINDERS
- Never commit `.env.local`
- Enable 2FA on Firebase & Vercel accounts
- Restrict Firebase console access to team members only
- Rotate API keys every 90 days
- Monitor `insurancePool` & `disputes` collections daily
