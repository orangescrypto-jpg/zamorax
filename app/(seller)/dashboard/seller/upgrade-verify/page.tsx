"use client"

import { AdminService , serverTimestamp } from "@/src/services"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase/config"

import { useState, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldCheck, CreditCard, Camera, CheckCircle2, Loader2, ArrowLeft, Upload } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { setDoc, updateDoc } from "@/src/services"

export default function UpgradeVerifyPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [bvn, setBvn] = useState("")
  const [nin, setNin] = useState("")
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const hasNin = user?.ninVerified === true

  const handleSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (bvn.length < 11) { toast({ title: "Enter valid BVN (11 digits)", variant: "destructive" }); return }
    if (!hasNin && nin.length < 11) { toast({ title: "Enter valid NIN (11 digits)", variant: "destructive" }); return }
    if (!selfieFile) { toast({ title: "Upload a selfie photo", variant: "destructive" }); return }
    if (!user?.uid) return

    setLoading(true)
    try {
      // Upload selfie
      const selfieRef = ref(storage, `verifications/${user.uid}/selfie_${Date.now()}.jpg`)
      await uploadBytes(selfieRef, selfieFile)
      const selfieUrl = await getDownloadURL(selfieRef)

      // Update user
      await AdminService.updateDoc("users", user.uid, {
        bvn,
        ...(!hasNin && { nin }),
        proVerificationStatus: "pending_review",
        updatedAt: serverTimestamp(),
      })

      // Create pro verification request
      await AdminService.setDoc("proVerificationRequests", user.uid, {
        uid: user.uid,
        fullName: user.fullName,
        email: user.email,
        bvn,
        nin: nin || "already_verified",
        selfieUrl,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      toast({ title: "Pro Verification Submitted! 🎉", description: "We'll review your BVN and selfie within 24hrs. Your Pro badge will be activated once approved.", variant: "success" })
      router.push("/dashboard/seller")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  if (user?.bvnVerified) {
    return (
      <div className="container max-w-md py-12">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="font-bold text-green-900">Already Pro Verified!</h2>
            <p className="text-sm text-green-700">Your BVN and selfie have already been verified.</p>
            <Button asChild className="w-full"><Link href="/dashboard/seller">Back to Dashboard</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-lg py-6 pb-24 space-y-6">
      <Link href="/dashboard/seller" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="text-center space-y-1">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mb-2">
          <ShieldCheck className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-heading font-bold">Pro Verification</h1>
        <p className="text-sm text-muted-foreground">Submit BVN + selfie to get your Gold Badge and unlock Pro features.</p>
      </div>

      {/* Pro benefits */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold text-sm text-amber-900">What you unlock with Pro:</p>
          {["Gold verified badge on all listings", "Unlimited listings", "Priority support", "Higher buyer trust score", "BVN-verified badge"].map(b => (
            <div key={b} className="flex items-center gap-2 text-xs text-amber-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />{b}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* BVN */}
      <div className="space-y-1">
        <Label className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-600" />BVN (Bank Verification Number) *</Label>
        <Input value={bvn} onChange={e => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit BVN" maxLength={11} />
        <p className="text-xs text-muted-foreground">{bvn.length}/11 digits</p>
      </div>

      {/* NIN — only if user hasn't submitted it yet */}
      {!hasNin && (
        <div className="space-y-1">
          <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-600" />NIN (not yet submitted) *</Label>
          <Input value={nin} onChange={e => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11-digit NIN" maxLength={11} />
          <p className="text-xs text-muted-foreground">{nin.length}/11 digits</p>
        </div>
      )}

      {/* Selfie */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Camera className="h-4 w-4 text-purple-600" />Selfie Photo *</Label>
        <p className="text-xs text-muted-foreground">A clear photo of your face — used to match your NIN/BVN records.</p>
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleSelfie} className="hidden" />
        {selfiePreview ? (
          <div className="relative">
            <img src={selfiePreview} alt="Selfie" className="w-32 h-32 rounded-full object-cover border-4 border-primary mx-auto" />
            <button onClick={() => fileRef.current?.click()} className="mt-2 text-xs text-primary underline block text-center w-full">Retake</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tap to take or upload selfie</span>
          </button>
        )}
      </div>

      {/* Security note */}
      <div className="space-y-1.5">
        {["BVN & selfie are encrypted end-to-end", "Only seen by Zamorax moderators", "Never shared publicly or with buyers"].map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />{t}
          </div>
        ))}
      </div>

      <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12 text-base" onClick={handleSubmit}
        disabled={loading || bvn.length < 11 || (!hasNin && nin.length < 11) || !selfieFile}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
        Submit for Pro Verification
      </Button>
    </div>
  )
}
