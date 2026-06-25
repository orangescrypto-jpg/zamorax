"use client"

import { AuthService, AdminService } from "@/src/services"
import { supabase } from "@/lib/supabase/client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginSchema } from "@/lib/validations/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Mail, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react"

const actionCodeSettings = {
  url: `${process.env.NEXT_PUBLIC_APP_URL || "https://zamorax.vercel.app"}/login?verified=true`,
  handleCodeInApp: false,
}

function getFriendlyAuthError(code: string): string {
  const map: Record<string, string> = {
    "auth/invalid-credential":        "Incorrect email or password. Please try again.",
    "auth/user-not-found":            "No account found with this email address.",
    "auth/wrong-password":            "Incorrect password. Please try again.",
    "auth/invalid-email":             "Please enter a valid email address.",
    "auth/user-disabled":             "This account has been suspended. Contact support.",
    "auth/too-many-requests":         "Too many failed attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed":    "Network error. Please check your connection and try again.",
    "auth/popup-closed-by-user":      "Sign-in was cancelled. Please try again.",
    "auth/popup-blocked":             "Pop-up was blocked by your browser. Please allow pop-ups and retry.",
    "auth/account-exists-with-different-credential": "An account already exists with this email. Try logging in with email and password.",
  }
  return map[code] || "Something went wrong. Please try again."
}

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null)
  const [unverifiedCreds, setUnverifiedCreds] = useState<{ email: string; password: string } | null>(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [resentOk, setResentOk] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  })

  const onSubmit = async (data: LoginSchema) => {
    setLoading(true)
    try {
      const user = await AuthService.login(data.email, data.password) as any

      // Admins & moderators always bypass verification
      const userDoc = await AdminService.getDoc("users", user.uid)
      const role = userDoc ? (userDoc as any).role : null
      const isPrivileged = role === "admin" || role === "moderator"

      // Only block accounts created on or after June 13 2026.
      // Everyone registered before that date logs in freely — no verification needed.
      const ENFORCEMENT_DATE = new Date("2026-06-13T00:00:00Z")
      const accountCreatedAt = (user as any).metadata?.creationTime
        ? new Date((user as any).metadata.creationTime)
        : new Date()
      const isNewAccount = accountCreatedAt >= ENFORCEMENT_DATE

      if (!user.emailVerified && isNewAccount && !isPrivileged) {
        // Send verification email NOW while user is still signed in
        try { await supabase().auth.resend({ type: "signup", email: data.email }) } catch { /* already sent recently */ }
        // Store credentials so Resend can re-login and send again
        setUnverifiedCreds({ email: data.email, password: data.password })
        setUnverifiedUser(user)
        await AuthService.signOut()
        setLoading(false)
        return
      }

      toast({ title: "Login Successful", description: "Redirecting...", variant: "success" })
      setTimeout(() => router.push("/dashboard/buyer"), 600)
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: getFriendlyAuthError(error.code),
        variant: "destructive",
      })
    } finally { setLoading(false) }
  }

  const handleResendVerification = async () => {
    if (!unverifiedCreds) return
    setResendingVerification(true)
    try {
      await supabase().auth.resend({ type: "signup", email: unverifiedCreds.email })
      setResentOk(true)
      setTimeout(() => setResentOk(false), 6000)
    } catch (err: any) {
      const msg = err.code === "auth/too-many-requests"
        ? "Please wait a minute before requesting another email."
        : "Failed to resend. Try again in a moment."
      toast({ title: msg, variant: "destructive" })
    } finally { setResendingVerification(false) }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    try {
      await AuthService.loginWithGoogle()
      toast({ title: "Login Successful 🎉", variant: "success" })
      setTimeout(() => router.push("/dashboard/buyer"), 600)
    } catch (error: any) {
      toast({
        title: "Google Login Failed",
        description: getFriendlyAuthError(error.code),
        variant: "destructive",
      })
    } finally { setGoogleLoading(false) }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail) { toast({ title: "Enter your email address", variant: "destructive" }); return }
    setResetLoading(true)
    try {
      await AuthService.resetPassword(resetEmail)
      toast({ title: "Reset Email Sent 📧", description: "Check your inbox for the reset link.", variant: "success" })
      setShowForgot(false)
      setResetEmail("")
    } catch (error: any) {
      toast({
        title: "Failed to Send Reset Email",
        description: getFriendlyAuthError(error.code),
        variant: "destructive",
      })
    } finally { setResetLoading(false) }
  }

  // ── Verify email screen ───────────────────────────────────────────
  if (unverifiedUser) return (
    <div className="text-center space-y-5 py-2">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Mail className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-secondary">Verify your email first</h2>
        <p className="text-sm text-muted-foreground mt-2">We sent a verification link to</p>
        <p className="font-semibold text-primary mt-1 break-all">{unverifiedUser.email}</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-left space-y-1.5">
        <p className="font-semibold">Next steps:</p>
        <p>1. Open your email inbox</p>
        <p>2. Click the verification link from Zamorax</p>
        <p>3. Come back and log in again</p>
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={handleResendVerification}
        disabled={resendingVerification || resentOk}
      >
        {resendingVerification
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Sending...</>
          : resentOk
            ? <><CheckCircle2 className="h-3.5 w-3.5 mr-2 text-green-500" /> Email Sent! Check your inbox</>
            : "Resend Verification Email"}
      </Button>
      <button
        className="text-xs text-muted-foreground hover:text-primary underline"
        onClick={() => { setUnverifiedUser(null); setUnverifiedCreds(null) }}
      >
        Use a different account
      </button>
    </div>
  )

  // ── Forgot password screen ────────────────────────────────────────
  if (showForgot) return (
    <div className="space-y-5">
      <button onClick={() => setShowForgot(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Login
      </button>
      <div className="text-center space-y-1">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-bold text-lg">Forgot Password?</h2>
        <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
      </div>
      <div className="space-y-1">
        <Label>Email Address</Label>
        <Input
          type="email"
          value={resetEmail}
          onChange={e => setResetEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <Button
        className="w-full bg-primary text-white"
        onClick={handlePasswordReset}
        disabled={resetLoading || !resetEmail}
      >
        {resetLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
        Send Reset Link
      </Button>
    </div>
  )

  // ── Login form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline font-medium">
            Forgot password?
          </button>
        </div>
        <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={!isValid || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
        Sign In
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={googleLoading}>
        {googleLoading
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.347.533 12s5.333 12 11.947 12c3.507 0 6.167-1.167 8.08-3.233 2.267-2.267 2.967-5.687 2.967-8.72 0-.76-.053-1.52-.16-2.28H12.48z"/></svg>
        }
        Continue with Google
      </Button>
    </form>
  )
}
