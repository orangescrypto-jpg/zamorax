import { Suspense } from "react"
import { LoginForm } from "@/components/auth/LoginForm"
import Link from "next/link"
import LoginBanner from "./LoginBanner"

export const metadata = { title: "Log In | Zamorax" }

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <Suspense fallback={null}>
          <LoginBanner />
        </Suspense>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-heading font-bold text-secondary">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Log in to your Zamorax account</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  )
}
