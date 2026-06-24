import { RegisterForm } from "@/components/auth/RegisterForm"
import Link from "next/link"

export const metadata = { title: "Register | Zamorax" }

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-heading font-bold text-secondary">Create an account</h1>
          <p className="text-sm text-muted-foreground">Join thousands of buyers and sellers on Zamorax</p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </main>
  )
}
