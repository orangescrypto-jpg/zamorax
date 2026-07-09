// components/auth/LoginForm.tsx  — REPLACE EXISTING FILE
"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { createClient } from "@/lib/supabase/client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginSchema } from "@/lib/validations/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Mail, ArrowLeft, KeyRound, CheckCircle2, Eye, EyeOff } from "lucide-react"

function getFriendlyAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials":           "Incorrect email or password. Please try again.",
    "Email not confirmed":                 "Please verify your email before logging in.",
    "User account has been banned":        "This account has been suspended. Contact support.",
    "auth/network-request-failed":         "Network error. Please check your connection and try again.",
    "Too many requests":                   "Too many failed attempts. Please wait a few minutes and try again.",
  }
  return map[message] ?? message ?? "Something went wrong. Please try again."
}

export function LoginForm() {
  const [loading, setLoading]                             = useState(false)
  const [showForgot, setShowForgot]                       = useState(false)
  const [resetEmail, setResetEmail]                       = useState("")
  const [resetLoading, setResetLoading]                   = useState(false)
  const [unverifiedEmail, setUnverifiedEmail]             = useState<string | null>(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [resentOk, setResentOk]                           = useState(false)
  const [showPassword, setShowPassword]                   = useState(false)
  const { toast } = useToast()
  const { setUser } = useAuthStore()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next")

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  })

  const onSubmit = async (data: LoginSchema) => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: data.email, password: data.password }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.error ?? `Login failed (HTTP ${res.status})`
        if (msg.includes("not confirmed") || msg.includes("verify")) {
          setUnverifiedEmail(data.email)
          setLoading(false)
          return
        }
        throw new Error(msg)
      }

      const profile = json.profile
      if (!profile) throw new Error("Profile not found. Please contact support.")

      if (profile.is_banned) {
        await fetch("/api/auth/signout", { method: "POST" })
        throw new Error(profile.ban_reason ?? "Account suspended")
      }

      setUser(profile)
      toast({ title: "Login Successful", description: "Redirecting...", variant: "success" })

      const redirectMap: Record<string, string> = {
        admin:     "/admin",
        moderator: "/moderator",
        seller:    "/dashboard/seller",
        buyer:     "/dashboard/buyer",
      }
      // If the person was sent here from a specific page (e.g. clicked a
      // listing while logged out), send them back there instead of always
      // landing on the role dashboard — but only for admin/moderator when
      // no safe "next" was captured, since those never carry a next param.
      // Auth pages (login/register/etc.) are never a valid redirect target —
      // e.g. someone on /register who logs in shouldn't be bounced back to
      // /register; they should land on their dashboard like everyone else.
      const AUTH_PAGE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]
      const isAuthPage = (path: string) => AUTH_PAGE_PREFIXES.some(p => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))
      const isSafeNext = nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//") && !isAuthPage(nextUrl)
      const destination = isSafeNext ? nextUrl : (redirectMap[profile.role] ?? "/dashboard/buyer")
      // Hard navigation (not router.push) — the login route just set a fresh
      // session cookie, but Next.js's client router cache doesn't know that.
      // A soft push can serve a stale/redirected response for the destination,
      // which is why the page can appear stuck on the login screen even
      // though client-side auth state (and thus the nav menu) looks correct.
      setTimeout(() => { window.location.href = destination }, 600)
    } catch (error: any) {
      toast({
        title:       "Login Failed",
        description: getFriendlyAuthError(error.message),
        variant:     "destructive",
      })
    } finally { setLoading(false) }
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return
    setResendingVerification(true)
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: unverifiedEmail }),
      })
      if (res.ok) {
        setResentOk(true)
        setTimeout(() => setResentOk(false), 6000)
      } else {
        const j = await res.json()
        toast({ title: j.error ?? "Failed to resend. Try again.", variant: "destructive" })
      }
    } finally { setResendingVerification(false) }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail) { toast({ title: "Enter your email address", variant: "destructive" }); return }
    setResetLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: resetEmail }),
      })
      if (res.ok) {
        toast({ title: "Reset Email Sent 📧", description: "Check your inbox for the reset link.", variant: "success" })
        setShowForgot(false)
        setResetEmail("")
      } else {
        const j = await res.json()
        toast({ title: "Failed to Send Reset Email", description: j.error ?? "Unknown error", variant: "destructive" })
      }
    } finally { setResetLoading(false) }
  }

  // Email not verified screen
  if (unverifiedEmail) return (
    <div className="text-center space-y-5 py-2">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Mail className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-secondary">Verify your email first</h2>
        <p className="text-sm text-muted-foreground mt-2">We sent a verification link to</p>
        <p className="font-semibold text-primary mt-1 break-all">{unverifiedEmail}</p>
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
        onClick={() => setUnverifiedEmail(null)}
      >
        Use a different account
      </button>
    </div>
  )

  // Forgot password screen
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

  // Login form
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
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={!isValid || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
        Sign In
      </Button>
    </form>
  )
}
