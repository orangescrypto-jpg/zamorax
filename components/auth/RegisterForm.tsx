"use client"

import { AuthService, AdminService } from "@/src/services"
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  buyerRegisterSchema, sellerRegisterSchema,
  BuyerRegisterSchema, SellerRegisterSchema,
} from "@/lib/validations/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  Loader2, ArrowRight, ShoppingBag, Store, ArrowLeft,
  ShieldCheck, CreditCard, CheckCircle2, Mail, Info,
} from "lucide-react"
import { nigerianStates } from "@/constants/nigerianStates"
import { setDoc } from "@/src/services"

// Tells Firebase where to redirect after email verification
// This makes the email look legitimate and improves deliverability
const actionCodeSettings = {
  url: `${process.env.NEXT_PUBLIC_APP_URL || "https://zamorax.vercel.app"}/login?verified=true`,
  handleCodeInApp: false,
}

type Role = "buyer" | "seller" | null

// ── Email verification holding screen ─────────────────────
function EmailVerificationScreen({ email, onResend }: { email: string; onResend: () => void }) {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    setResending(true)
    try {
      await onResend()
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="text-center space-y-5 py-4">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Mail className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-secondary">Check your email</h2>
        <p className="text-sm text-muted-foreground mt-2">
          We sent a verification link to
        </p>
        <p className="font-semibold text-primary mt-1 break-all">{email}</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-left space-y-1.5">
        <p className="font-semibold">Next steps:</p>
        <p>1. Open your email inbox</p>
        <p>2. Click the verification link from Zamorax</p>
        <p>3. Come back and <a href="/login" className="underline font-medium">log in</a></p>
      </div>
      <p className="text-xs text-muted-foreground">
        Didn't receive it? Check your spam folder or
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={resending || resent}
        className="w-full"
      >
        {resending
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Sending...</>
          : resent
            ? <><CheckCircle2 className="h-3.5 w-3.5 mr-2 text-green-500" /> Email Sent!</>
            : "Resend Verification Email"}
      </Button>
    </div>
  )
}

// ── NIN name hint component ────────────────────────────────
function NINNameHint() {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
      <span>
        <strong>Important:</strong> Enter your name exactly as it appears on your NIN slip or National ID card.
        This is required for identity verification.
      </span>
    </div>
  )
}

export function RegisterForm() {
  const [role, setRole] = useState<Role>(null)
  const [sellerStep, setSellerStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState("")
  const [nin, setNin] = useState("")
  const [bvn, setBvn] = useState("")
  const [pendingData, setPendingData] = useState<SellerRegisterSchema | null>(null)
  // Email verification screen state
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [resendFn, setResendFn] = useState<(() => Promise<void>) | null>(null)

  const router = useRouter()
  const { toast } = useToast()

  const buyerForm = useForm<BuyerRegisterSchema>({
    resolver: zodResolver(buyerRegisterSchema), mode: "onChange",
  })
  const sellerForm = useForm<SellerRegisterSchema>({
    resolver: zodResolver(sellerRegisterSchema), mode: "onChange",
  })

  // ── Buyer submit ─────────────────────────────────────────
  const handleBuyerSubmit = async (data: BuyerRegisterSchema) => {
    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, data.email, data.password)

      await AdminService.setDoc("users", user.uid, {
        uid: user.uid, email: data.email, phone: data.phone,
        fullName: data.fullName, username: data.username.toLowerCase(),
        role: "buyer", plan: "free", verificationLevel: "none",
        phoneVerified: false, ninVerified: false, bvnVerified: false,
        isSellerReady: false, activeListingCount: 0,
        sellerRating: 0, totalSales: 0, totalRentals: 0, isBanned: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      // Send verification email — FIX: use `user` not `userCredential.user`
      await sendEmailVerification(user, actionCodeSettings)

      // Store resend function for the holding screen
      setResendFn(() => async () => {
        await sendEmailVerification(user, actionCodeSettings)
      })

      // Show email verification screen instead of redirecting immediately
      setVerificationEmail(data.email)

      toast({
        title: "Account created! 🎉",
        description: "Check your email to verify your account.",
        variant: "success",
      })
    } catch (e: any) {
      toast({ title: "Registration Failed", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  // ── Seller step 1 ────────────────────────────────────────
  const handleSellerStep1 = (data: SellerRegisterSchema) => {
    if (!state) {
      toast({ title: "Select your state", variant: "destructive" })
      return
    }
    setPendingData(data)
    setSellerStep(2)
  }

  // ── Seller step 2 ────────────────────────────────────────
  const handleSellerStep2 = async () => {
    if (!pendingData) return
    if (nin.length < 11) {
      toast({ title: "Enter valid NIN (11 digits)", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, pendingData.email, pendingData.password)

      await AdminService.setDoc("users", user.uid, {
        uid: user.uid, email: pendingData.email, phone: pendingData.phone,
        fullName: pendingData.fullName, username: pendingData.username.toLowerCase(),
        storeName: pendingData.storeName, storeDescription: pendingData.storeDescription,
        nigerianState: state, nin,
        role: "seller", plan: "free",
        verificationLevel: "nin", verificationStatus: "pending_review",
        phoneVerified: false, ninVerified: false, bvnVerified: false,
        isSellerReady: false, activeListingCount: 0,
        sellerRating: 0, totalSales: 0, totalRentals: 0, isBanned: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      await AdminService.setDoc("verificationRequests", user.uid, {
        userId: user.uid,
        userName: pendingData.fullName,
        userEmail: pendingData.email,
        phone: pendingData.phone,
        storeName: pendingData.storeName,
        type: "nin", value: nin,
        nigerianState: state,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      await sendEmailVerification(user, actionCodeSettings)

      setResendFn(() => async () => {
        await sendEmailVerification(user, actionCodeSettings)
      })

      setVerificationEmail(pendingData.email)

      toast({
        title: "Account created! Pending approval",
        description: "Verify your email and we'll review your NIN within 24hrs.",
        variant: "success",
      })
    } catch (e: any) {
      toast({ title: "Registration Failed", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  // ── Show email verification holding screen ───────────────
  if (verificationEmail) {
    return (
      <EmailVerificationScreen
        email={verificationEmail}
        onResend={resendFn ?? (async () => {})}
      />
    )
  }

  // ── Role selection ───────────────────────────────────────
  if (!role) return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Choose how you want to use Zamorax
      </p>
      {[
        { r: "buyer" as Role, Icon: ShoppingBag, title: "I want to Buy",  sub: "Browse listings, make secure purchases",   color: "bg-blue-100 text-blue-600" },
        { r: "seller" as Role, Icon: Store,      title: "I want to Sell", sub: "Post listings, reach millions of buyers",  color: "bg-orange-100 text-orange-600" },
      ].map(({ r, Icon, title, sub, color }) => (
        <button
          key={r!}
          onClick={() => setRole(r)}
          className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
        >
          <div className={`p-3 rounded-xl ${color}`}><Icon className="h-6 w-6" /></div>
          <div>
            <p className="font-semibold text-secondary">{title}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </button>
      ))}
    </div>
  )

  // ── Buyer form ───────────────────────────────────────────
  if (role === "buyer") {
    const { register, handleSubmit, formState: { errors, isValid } } = buyerForm
    return (
      <form onSubmit={handleSubmit(handleBuyerSubmit)} className="space-y-4">
        <button
          type="button"
          onClick={() => setRole(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-blue-600" />
          <span className="font-semibold">Buyer Registration</span>
        </div>

        {/* Full Name with NIN hint */}
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input {...register("fullName")} placeholder="As it appears on your NIN / National ID" />
          {errors.fullName
            ? <p className="text-xs text-destructive">{errors.fullName.message}</p>
            : <NINNameHint />}
        </div>

        {[
          { id: "username",        label: "Username",         ph: "johndoe" },
          { id: "email",           label: "Email",            ph: "you@example.com",  type: "email" },
          { id: "phone",           label: "Phone",            ph: "08012345678" },
          { id: "password",        label: "Password",         ph: "••••••••",          type: "password" },
          { id: "confirmPassword", label: "Confirm Password", ph: "••••••••",          type: "password" },
        ].map(({ id, label, ph, type = "text" }) => (
          <div key={id} className="space-y-1">
            <Label>{label}</Label>
            <Input type={type} {...register(id as Parameters<typeof register>[0])} placeholder={ph} />
            {(errors as Record<string, unknown>)[id] && (
              <p className="text-xs text-destructive">{(errors as Record<string, { message?: string }>)[id]?.message}</p>
            )}
          </div>
        ))}

        <Button type="submit" className="w-full bg-primary text-white" disabled={!isValid || loading}>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <ArrowRight className="h-4 w-4 mr-2" />}
          Create Buyer Account
        </Button>
      </form>
    )
  }

  // ── Seller step 1 ────────────────────────────────────────
  if (sellerStep === 1) {
    const { register, handleSubmit, formState: { errors, isValid } } = sellerForm
    return (
      <form onSubmit={handleSubmit(handleSellerStep1)} className="space-y-4">
        <button
          type="button"
          onClick={() => setRole(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-orange-600" />
            <span className="font-semibold">Seller Registration</span>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Step 1 of 2</span>
        </div>
        <div className="flex gap-1">
          <div className="flex-1 h-1.5 rounded-full bg-primary" />
          <div className="flex-1 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Full Name with NIN hint — shown first and prominently */}
        <div className="space-y-1.5">
          <Label>Full Name</Label>
          <Input {...register("fullName")} placeholder="As it appears on your NIN / National ID" />
          {errors.fullName
            ? <p className="text-xs text-destructive">{errors.fullName.message}</p>
            : <NINNameHint />}
        </div>

        {[
          { id: "username",         label: "Username",          ph: "johndoe" },
          { id: "storeName",        label: "Store Name",        ph: "John's Electronics" },
          { id: "email",            label: "Email",             ph: "you@example.com", type: "email" },
          { id: "phone",            label: "Phone",             ph: "08012345678" },
          { id: "password",         label: "Password",          ph: "••••••••",         type: "password" },
          { id: "confirmPassword",  label: "Confirm Password",  ph: "••••••••",         type: "password" },
        ].map(({ id, label, ph, type = "text" }) => (
          <div key={id} className="space-y-1">
            <Label>{label}</Label>
            <Input type={type} {...register(id as Parameters<typeof register>[0])} placeholder={ph} />
            {(errors as Record<string, unknown>)[id] && (
              <p className="text-xs text-destructive">{(errors as Record<string, { message?: string }>)[id]?.message}</p>
            )}
          </div>
        ))}

        <div className="space-y-1">
          <Label>Store Description</Label>
          <textarea
            {...register("storeDescription")}
            placeholder="Tell buyers what you sell..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.storeDescription && (
            <p className="text-xs text-destructive">{errors.storeDescription.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>State</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue placeholder="Select your state" /></SelectTrigger>
            <SelectContent>
              {nigerianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary text-white"
          disabled={!isValid || !state}
        >
          Continue to Verification <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </form>
    )
  }

  // ── Seller step 2 — NIN only (free tier) ────────────────
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setSellerStep(1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <span className="font-semibold">Identity Verification</span>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Step 2 of 2</span>
      </div>
      <div className="flex gap-1">
        <div className="flex-1 h-1.5 rounded-full bg-primary" />
        <div className="flex-1 h-1.5 rounded-full bg-primary" />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <Info className="h-4 w-4" /> Name must match your NIN
        </p>
        <p>
          You registered as <strong>{pendingData?.fullName}</strong>.
          Make sure this matches your NIN exactly — mismatches will be rejected.
        </p>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <p className="font-semibold mb-1">Why we need your NIN</p>
        <p>All free sellers must verify their NIN to start listing. Your info is encrypted and only seen by our moderation team. Approval takes up to 24 hours.</p>
      </div>

      <div className="space-y-1">
        <Label className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          NIN (National Identification Number)
        </Label>
        <Input
          value={nin}
          onChange={e => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="11-digit NIN"
          maxLength={11}
        />
        <p className="text-xs text-muted-foreground">{nin.length}/11 digits</p>
      </div>

      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 space-y-1">
        <p className="font-semibold">Pro Upgrade (optional later)</p>
        <p>After approval, upgrade to Pro to unlock BVN + selfie verification for a gold badge, unlimited listings, and priority support.</p>
      </div>      <div className="space-y-2">
        {[
          "NIN & BVN are encrypted end-to-end",
          "Used only for identity verification",
          "Never shared with buyers or third parties",
          "You'll be notified once approved (up to 24hrs)",
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{t}
          </div>
        ))}
      </div>

      <Button
        className="w-full bg-primary text-white"
        onClick={handleSellerStep2}
        disabled={loading || nin.length < 11}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <ShieldCheck className="h-4 w-4 mr-2" />}
        Submit for Verification
      </Button>
    </div>
  )
}
