"use client"

import { AdminService } from "@/src/services"

import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateDoc } from "@/src/services"
import {
  BadgeCheck, Store, LogOut, ChevronRight, ShieldCheck,
  User, LayoutDashboard, Pencil, X, Loader2, Check, Package, Gift,
} from "lucide-react"

export default function ProfilePage() {
  const { user, loading, signOut, isSeller } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = user?.role === "admin"

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fullName: "", phone: "" })

  const startEdit = () => {
    setForm({ fullName: user?.fullName || "", phone: user?.phone || "" })
    setEditing(true)
  }

  const handleSave = async () => {
    if (!user?.uid) return
    if (!form.fullName.trim()) {
      toast({ title: "Name is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await AdminService.updateDoc("users", user.uid, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
      })
      toast({ title: "Profile updated!", variant: "success" })
      setEditing(false)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (!user) { router.push("/login"); return null }

  return (
    <main className="container max-w-lg py-8 space-y-6 pb-24">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-secondary">{user.fullName}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">
            {user.role}
          </span>
        </div>
      </div>

      {/* Info Card — with inline edit */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Account Info</CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={startEdit} className="gap-1 h-8 text-xs">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+234..."
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 bg-primary text-white hover:bg-primary/90"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Save Changes</>}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{user.phone || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="capitalize">{user.plan || "free"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone Verified</span><span>{user.phoneVerified ? "✅" : "❌"}</span></div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        {isAdmin && (
          <button
            onClick={() => router.push("/admin")}
            className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold text-sm text-secondary">Admin Dashboard</p>
                <p className="text-xs text-muted-foreground">Manage users, listings & disputes</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {!isSeller() && !isAdmin && (
          <button
            onClick={() => router.push("/dashboard/become-seller")}
            className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition"
          >
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold text-sm text-secondary">Become a Seller</p>
                <p className="text-xs text-muted-foreground">Start listing and earning on Zamorax</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {isSeller() && (
          <>
            <button
              onClick={() => router.push("/dashboard/seller")}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition"
            >
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Seller Dashboard</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => router.push("/dashboard/verify")}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Verify Identity (NIN)</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </>
        )}

        <Button
          variant="destructive"
          className="w-full mt-4"
          onClick={() => { signOut(); router.push("/") }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>

        {/* ── Earn with Zamorax ─────────────────── */}
        <div className="pt-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2">
            Earn with Zamorax
          </p>

          {/* Zamorax Agent — referrals */}
          <button
            onClick={() => router.push("/dashboard/agent")}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition mb-2"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Gift className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-secondary">Zamorax Agent</p>
                <p className="text-xs text-muted-foreground">Refer friends & earn up to ₦2,000 per referral</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Zamorax Logistics Agent (ZLA) */}
          <button
            onClick={() => router.push("/dashboard/zla")}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-secondary">Zamorax Logistics Agent</p>
                <p className="text-xs text-muted-foreground">Earn ₦200–₦500 per parcel handled</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </main>
  )
}
