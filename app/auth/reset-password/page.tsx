"use client"

// app/auth/reset-password/page.tsx
// ─────────────────────────────────────────────────────────────────
// Handles the password reset flow after user clicks the email link.
// Supabase redirects here with a token in the URL hash.
// We detect the session from the token, show a new-password form,
// and call supabase().auth.updateUser() to set the new password.
// ─────────────────────────────────────────────────────────────────

import { Suspense } from "react"
import ResetPasswordForm from "./ResetPasswordForm"

export const metadata = { title: "Reset Password | Zamorax" }

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
