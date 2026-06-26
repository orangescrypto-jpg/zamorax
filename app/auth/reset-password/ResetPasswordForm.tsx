"use client"

// app/auth/reset-password/ResetPasswordForm.tsx
// Reads the Firebase oobCode from the URL query params,
// verifies it, and lets the user set a new password.

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react"

type Stage = "verifying" | "ready" | "success" | "invalid"

export default function ResetPasswordForm() {
  const [stage, setStage]             = useState<Stage>("verifying")
  const [password, setPassword]       = useState("")
  const [confirm, setConfirm]         = useState("")
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [oobCode, setOobCode]         = useState<string | null>(null)
  const router                        = useRouter()
  const searchParams                  = useSearchParams()
  const { toast }                     = useToast()

  // Firebase sends reset links with ?mode=resetPassword&oobCode=XXX
  useEffect(() => {
    const mode = searchParams.get("mode")
    const code = searchParams.get("oobCode")

    if (mode !== "resetPassword" || !code) {
      setStage("invalid")
      return
    }

    verifyPasswordResetCode(firebaseAuth(), code)
      .then(() => {
        setOobCode(code)
        setStage("ready")
      })
      .catch(() => {
        setStage("invalid")
      })
  }, [searchParams])

  const isStrong   = password.length >= 8
  const isMatching = password === confirm && confirm.length > 0
  const canSubmit  = isStrong && isMatching && !loading && !!oobCode

  const handleSubmit = async () => {
    if (!canSubmit || !oobCode) return
    setLoading(true)
    try {
      await confirmPasswordReset(firebaseAuth(), oobCode, password)
      setStage("success")
      toast({
        title:       "Password Updated 🎉",
        description: "You can now log in with your new password.",
        variant:     "success",
      })
      setTimeout(() => router.push("/login"), 2500)
    } catch (err: any) {
      toast({
        title:       "Failed to update password",
        description: err.message ?? "Please try again.",
        variant:     "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (stage === "verifying") return (
    <div className="text-center space-y-4 py-6">
      <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
      <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
    </div>
  )

  if (stage === "invalid") return (
    <div className="text-center space-y-5 py-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-secondary">Link Expired or Invalid</h2>
        <p className="text-sm text-muted-foreground">
          This password reset link has expired or already been used.
          Request a new one from the login page.
        </p>
      </div>
      <Link href="/login">
        <Button className="w-full">Back to Login</Button>
      </Link>
    </div>
  )

  if (stage === "success") return (
    <div className="text-center space-y-5 py-4">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-secondary">Password Updated!</h2>
        <p className="text-sm text-muted-foreground">Redirecting you to login…</p>
      </div>
      <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-1">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-secondary">Set New Password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password for your Zamorax account.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPass ? "text" : "password"}
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPass(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password.length > 0 && !isStrong && (
          <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm.length > 0 && !isMatching && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
        {isMatching && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
          </p>
        )}
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Updating…</>
          : <><KeyRound className="h-4 w-4 mr-2" /> Update Password</>
        }
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to Login
        </Link>
      </p>
    </div>
  )
}
