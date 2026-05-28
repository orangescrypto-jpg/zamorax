"use client"

import { AdminService , serverTimestamp } from "@/src/services"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Loader2, ShieldCheck, CreditCard, Camera,
  Upload, CheckCircle2, ArrowLeft, Clock, Info,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { setDoc, updateDoc } from "@/src/services"

// ─────────────────────────────────────────────────────────
// Props: plan is passed in from become-seller page
// ─────────────────────────────────────────────────────────
interface Props {
  plan: "free" | "starter" | "pro"
  onBack: () => void
}

export function UpgradeToSellerForm({ plan, onBack }: Props) {
  const [nin, setNin] = useState("")
  const [bvn, setBvn] = useState("")
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const isFree = plan === "free"

  // ── Selfie picker ──────────────────────────────────────
  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
  }

  // ── FREE plan submit — NIN only ────────────────────────
  const handleFreeSubmit = async () => {
    if (nin.length < 11) {
      toast({ title: "Enter a valid NIN (11 digits)", variant: "destructive" })
      return
    }
    if (!user?.uid) return
    setLoading(true)
    try {
      await AdminService.updateDoc("users", user.uid, {
        role: "both",
        nin,
        plan: "free",
        verificationLevel: "nin",
        verificationStatus: "pending_review",
        isSellerReady: false, // will flip to true once admin approves NIN
        updatedAt: serverTimestamp(),
      })

      await AdminService.setDoc("verificationRequests", user.uid, {
        userId: user.uid,
        userName: user.fullName,
        userEmail: user.email,
        type: "nin",
        value: nin,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      setUser({ ...user, role: "both", plan: "free", verificationLevel: "nin", verificationStatus: "pending_review" })

      toast({
        title: "NIN Submitted!",
        description: "We'll review it within 24 hours. You can post listings once approved.",
        variant: "success",
      })
      router.push("/dashboard/seller")
      router.refresh()
    } catch (e: any) {
      toast({ title: "Submission Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ── PAID plan submit — BVN + selfie ───────────────────
  const handleProSubmit = async () => {
    if (bvn.length < 11) {
      toast({ title: "Enter a valid BVN (11 digits)", variant: "destructive" })
      return
    }
    if (!selfieFile) {
      toast({ title: "Please upload a selfie photo", variant: "destructive" })
      return
    }
    if (!user?.uid) return
    setLoading(true)
    try {
      // Upload selfie
      const selfieRef = ref(storage, `verifications/${user.uid}/selfie_${Date.now()}.jpg`)
      await uploadBytes(selfieRef, selfieFile)
      const selfieUrl = await getDownloadURL(selfieRef)

      await AdminService.updateDoc("users", user.uid, {
        role: "both",
        bvn,
        plan,
        selfieUrl,
        verificationLevel: "bvn",
        proVerificationStatus: "pending_review",
        isSellerReady: false, // will flip to true once admin approves
        updatedAt: serverTimestamp(),
      })

      await AdminService.setDoc("proVerificationRequests", user.uid, {
        uid: user.uid,
        fullName: user.fullName,
        email: user.email,
        bvn,
        selfieUrl,
        plan,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      setUser({ ...user, role: "both", plan, proVerificationStatus: "pending_review" })

      toast({
        title: "Verification Submitted! 🎉",
        description: "We'll review your BVN & selfie within 24 hours. Your Pro badge will activate once approved.",
        variant: "success",
      })
      router.push("/dashboard/seller")
      router.refresh()
    } catch (e: any) {
      toast({ title: "Submission Failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ── FREE flow UI ───────────────────────────────────────
  if (isFree) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-2">
            <ShieldCheck className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-heading font-bold">NIN Verification</h2>
          <p className="text-sm text-muted-foreground">
            Free sellers verify their NIN to start listing. Takes up to 24 hours.
          </p>
        </div>

        {/* Plan reminder */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-semibold">Free Plan — ₦0</p>
              <p className="text-xs mt-0.5">5 active listings · NIN-verified badge · You can upgrade to Pro anytime.</p>
            </div>
          </CardContent>
        </Card>

        {/* NIN input */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            NIN (National Identification Number) *
          </Label>
          <Input
            value={nin}
            onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="11-digit NIN"
            maxLength={11}
          />
          <p className="text-xs text-muted-foreground">{nin.length}/11 digits</p>
        </div>

        {/* Security notes */}
        <div className="space-y-1.5">
          {[
            "NIN is encrypted end-to-end",
            "Only seen by Zamorax moderators",
            "Never shared with buyers or third parties",
            "You'll be notified once approved (up to 24hrs)",
          ].map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              {t}
            </div>
          ))}
        </div>

        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white h-12"
          onClick={handleFreeSubmit}
          disabled={loading || nin.length < 11}
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <ShieldCheck className="h-4 w-4 mr-2" />}
          Submit NIN for Verification
        </Button>
      </div>
    )
  }

  // ── PAID (starter / pro) flow UI ──────────────────────
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="text-center space-y-1">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mb-2">
          <ShieldCheck className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-heading font-bold">
          {plan === "pro" ? "Pro" : "Starter"} Verification
        </h2>
        <p className="text-sm text-muted-foreground">
          Submit your BVN and a selfie to activate your{" "}
          {plan === "pro" ? "Gold" : "Verified"} badge.
        </p>
      </div>

      {/* Plan reminder */}
      <Card className={plan === "pro" ? "border-amber-300 bg-amber-50" : "border-primary/30 bg-primary/5"}>
        <CardContent className="p-4 flex items-start gap-3">
          <Info className={`h-4 w-4 shrink-0 mt-0.5 ${plan === "pro" ? "text-amber-600" : "text-primary"}`} />
          <div className="text-sm">
            <p className={`font-semibold ${plan === "pro" ? "text-amber-900" : "text-primary"}`}>
              {plan === "pro" ? "Pro Plan — ₦3,500/mo" : "Starter Plan — ₦1,500/mo"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan === "pro"
                ? "Unlimited listings · Gold badge · Priority WhatsApp support"
                : "20 listings · Verified badge · Analytics dashboard"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* What unlocks */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold text-sm">What you unlock:</p>
          {(plan === "pro"
            ? ["Gold verified badge on all listings", "Unlimited listings", "Priority support", "Higher buyer trust score", "BVN-verified badge"]
            : ["Verified badge on all listings", "20 active listings", "Analytics dashboard", "Standard support"]
          ).map((b) => (
            <div key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              {b}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* BVN */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-600" />
          BVN (Bank Verification Number) *
        </Label>
        <Input
          value={bvn}
          onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="11-digit BVN"
          maxLength={11}
        />
        <p className="text-xs text-muted-foreground">{bvn.length}/11 digits</p>
      </div>

      {/* Selfie */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-purple-600" />
          Selfie Photo *
        </Label>
        <p className="text-xs text-muted-foreground">
          A clear photo of your face — used to match your BVN records.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleSelfieChange}
          className="hidden"
        />
        {selfiePreview ? (
          <div className="text-center space-y-2">
            <img
              src={selfiePreview}
              alt="Selfie preview"
              className="w-32 h-32 rounded-full object-cover border-4 border-primary mx-auto"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-primary underline"
            >
              Retake photo
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tap to take or upload selfie</span>
          </button>
        )}
      </div>

      {/* Pending notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
        <span>
          After submitting, your account will be reviewed within <strong>24 hours</strong>.
          Your {plan === "pro" ? "Gold" : "Verified"} badge activates once approved.
        </span>
      </div>

      {/* Security notes */}
      <div className="space-y-1.5">
        {[
          "BVN & selfie are encrypted end-to-end",
          "Only seen by Zamorax moderators",
          "Never shared publicly or with buyers",
        ].map((t) => (
          <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            {t}
          </div>
        ))}
      </div>

      <Button
        className={`w-full h-12 text-white text-base ${
          plan === "pro"
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-primary hover:bg-primary/90"
        }`}
        onClick={handleProSubmit}
        disabled={loading || bvn.length < 11 || !selfieFile}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <ShieldCheck className="h-4 w-4 mr-2" />}
        Submit for {plan === "pro" ? "Pro" : "Starter"} Verification
      </Button>
    </div>
  )
}
