"use client"

import {AdminService, serverTimestamp} from "@/src/services"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, CheckCircle, Clock, Loader2, Info } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export default function VerifyPage() {
  const { user } = useAuth()
  const uid = useAuthStore(s => s.user?.uid)
  const { toast } = useToast()
  const [nin, setNin] = useState("")
  const [bvn, setBvn] = useState("")
  const [submittingNin, setSubmittingNin] = useState(false)
  const [submittingBvn, setSubmittingBvn] = useState(false)

  const submit = async (type: "nin" | "bvn", value: string, setLoading: (v: boolean) => void) => {
    if (value.length !== 11) {
      toast({ title: "Invalid", description: `${type.toUpperCase()} must be 11 digits.`, variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      // Store verification request for admin review
      // FIXED: Save userName, userEmail, userPhone so admin/moderator
      // can identify the person without looking them up separately
      await AdminService.addDoc("verificationRequests", {
        userId: uid,
        userName: user?.fullName || "",
        userEmail: user?.email || "",
        userPhone: user?.phone || "",
        type,
        value,
        status: "pending",
        createdAt: serverTimestamp(),
      })
      // Mark as pending on user profile
      await AdminService.updateDoc("users", uid!, {
        [`${type}SubmittedAt`]: serverTimestamp(),
        verificationLevel: type === "bvn" ? "nin_bvn" : "nin",
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Submitted!", description: `Your ${type.toUpperCase()} is under review. Usually approved within 24hrs.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const VerifiedBadge = () => <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle className="h-3 w-3" />Verified</Badge>
  const PendingBadge = () => <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Clock className="h-3 w-3" />Pending Review</Badge>

  return (
    <main className="container max-w-md py-6 pb-24 space-y-6">
      <div className="text-center space-y-1">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-heading font-bold">Identity Verification</h1>
        <p className="text-sm text-muted-foreground">Verified sellers get more buyer trust and higher listing limits.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-xs text-blue-700">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Your identity data is encrypted and never shared publicly. Only verification status is shown.
      </div>

      {/* NIN */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">NIN Verification</p>
              <p className="text-xs text-muted-foreground">National Identity Number</p>
            </div>
            {user?.ninVerified ? <VerifiedBadge /> : user?.verificationLevel === "nin" ? <PendingBadge /> : null}
          </div>
          {!user?.ninVerified && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Enter your 11-digit NIN</Label>
                <Input value={nin} onChange={e => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="12345678901" maxLength={11} />
              </div>
              <Button className="w-full" onClick={() => submit("nin", nin, setSubmittingNin)} disabled={submittingNin || nin.length !== 11}>
                {submittingNin ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit NIN"}
              </Button>
            </>
          )}
          {user?.ninVerified && <p className="text-xs text-green-600">✓ Your NIN has been verified successfully.</p>}
        </CardContent>
      </Card>

      {/* BVN */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">BVN Verification</p>
              <p className="text-xs text-muted-foreground">Bank Verification Number — unlocks Pro features</p>
            </div>
            {user?.bvnVerified ? <VerifiedBadge /> : user?.verificationLevel === "nin_bvn" ? <PendingBadge /> : null}
          </div>
          {!user?.bvnVerified && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Enter your 11-digit BVN</Label>
                <Input value={bvn} onChange={e => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="12345678901" maxLength={11} />
              </div>
              <Button className="w-full" variant="outline" onClick={() => submit("bvn", bvn, setSubmittingBvn)} disabled={submittingBvn || bvn.length !== 11 || !user?.ninVerified}>
                {submittingBvn ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit BVN"}
              </Button>
              {!user?.ninVerified && <p className="text-xs text-muted-foreground text-center">Complete NIN verification first.</p>}
            </>
          )}
          {user?.bvnVerified && <p className="text-xs text-green-600">✓ Your BVN has been verified successfully.</p>}
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">Verification Benefits</p>
          {[
            ["NIN", "Trust badge on all listings, +15 trust score"],
            ["BVN", "Unlock Pro features, +20 trust score, priority support"],
          ].map(([tier, benefit]) => (
            <div key={tier} className="flex gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span><strong>{tier}:</strong> {benefit}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}
