"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, ShieldOff, Crown, Star, Lock, UserCheck, Shield, Loader2 } from "lucide-react"
import { UsersService } from "@/src/services"

type AppRole = "buyer" | "seller" | "both" | "admin" | "moderator"

type User = {
  id: string
  email?: string
  displayName?: string
  plan?: string
  role?: AppRole
  isBanned?: boolean
  isVerified?: boolean
  isOfficial?: boolean
  [key: string]: any
}

const ROLE_COLORS: Record<AppRole, string> = {
  buyer:     "bg-gray-100 text-gray-700",
  seller:    "bg-blue-100 text-blue-700",
  both:      "bg-purple-100 text-purple-700",
  admin:     "bg-red-100 text-red-700",
  moderator: "bg-amber-100 text-amber-700",
}

export function AdminUserRow({ user }: { user: User }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(user.plan || "free")
  const [role, setRole] = useState<AppRole>(user.role || "buyer")
  const [verified, setVerified] = useState(user.ninVerified || false)
  const [official, setOfficial] = useState(user.isOfficial || false)

  // Ban dialog
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banReason, setBanReason] = useState("")

  const handleBanSubmit = async () => {
    if (!banReason.trim()) return
    setLoading(true)
    try {
      await UsersService.banUser(user.id, banReason.trim())
      setBanDialogOpen(false)
      setBanReason("")
      toast({ title: "User Banned", description: `${user.fullName} access revoked.`, variant: "destructive" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleUnban = async () => {
    setLoading(true)
    try {
      await UsersService.unbanUser(user.id)
      toast({ title: "User Unbanned", description: `${user.fullName} can now access Zamorax.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handlePlanChange = async (newPlan: "free" | "starter" | "pro") => {
    if (newPlan === plan) return
    setLoading(true)
    try {
      await UsersService.updateUserPlan(user.id, newPlan)
      setPlan(newPlan)
      toast({ title: "Plan Updated", description: `${user.fullName} moved to ${newPlan}.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleRoleChange = async (newRole: AppRole) => {
    if (newRole === role) return
    setLoading(true)
    try {
      await UsersService.updateUser(user.id, { role: newRole })
      setRole(newRole)
      toast({
        title: "Role Updated",
        description: `${user.fullName} is now a ${newRole}.`,
        variant: "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleToggleNIN = async () => {
    setLoading(true)
    try {
      await UsersService.verifySellerNIN(user.id, !verified)
      setVerified(!verified)
      toast({
        title: verified ? "NIN Removed" : "NIN Verified ✅",
        variant: verified ? "destructive" : "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleToggleOfficial = async () => {
    setLoading(true)
    try {
      await UsersService.updateUser(user.id, { isOfficial: !official } as any)
      setOfficial(!official)
      toast({
        title: official ? "Removed from Zamorax Direct" : "Marked as Official Seller 🛡️",
        description: official
          ? undefined
          : "This seller's listings now appear in the Zamorax Direct section.",
        variant: official ? "destructive" : "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  return (
    <>
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* User Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-lg shrink-0">
            {user.fullName?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{user.fullName || "No Name"}</p>
              <Badge className={`text-xs ${ROLE_COLORS[role]}`}>{role}</Badge>
              {official && <Badge className="text-xs bg-emerald-100 text-emerald-700">🛡️ Official</Badge>}
              {user.isBanned && <Badge variant="destructive" className="text-xs">Banned</Badge>}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {user.email} · {user.phone || "No Phone"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Plan badge */}
          <div className="flex items-center gap-1">
            {plan === "pro" ? <Crown className="h-4 w-4 text-amber-500" /> : <Star className="h-4 w-4 text-gray-400" />}
            <span className="text-sm font-medium capitalize">{plan}</span>
          </div>

          {/* NIN toggle */}
          <Button
            variant={verified ? "outline" : "secondary"}
            size="sm"
            onClick={handleToggleNIN}
            disabled={loading}
            className={`h-8 gap-1 text-xs ${verified ? "border-accent text-accent" : ""}`}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> :
              verified ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            {verified ? "NIN ✓" : "Verify NIN"}
          </Button>

          {/* Official Seller toggle — marks this seller's listings as
              Zamorax Direct (bulk-sourced, locally warehoused stock).
              Only relevant for sellers. */}
          {(role === "seller" || role === "both") && (
            <Button
              variant={official ? "outline" : "secondary"}
              size="sm"
              onClick={handleToggleOfficial}
              disabled={loading}
              className={`h-8 gap-1 text-xs ${official ? "border-emerald-500 text-emerald-700" : ""}`}
              title={official
                ? "Remove official status — listings return to normal store/search"
                : "Mark as an official Zamorax-owned store — listings appear in the Zamorax Direct section"}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {official ? "Official ✓" : "Mark Official"}
            </Button>
          )}

          {/* Role selector — admin can promote to moderator */}
          <Select value={role} onValueChange={handleRoleChange} disabled={loading}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <Shield className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">Buyer</SelectItem>
              <SelectItem value="seller">Seller</SelectItem>
              <SelectItem value="both">Both</SelectItem>
              <SelectItem value="moderator">⚖️ Moderator</SelectItem>
              <SelectItem value="admin">🔴 Admin</SelectItem>
            </SelectContent>
          </Select>

          {/* Plan selector */}
          <Select value={plan} onValueChange={handlePlanChange} disabled={loading}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>

          {/* Ban / Unban */}
          {user.isBanned ? (
            <Button variant="outline" size="sm" onClick={handleUnban} disabled={loading} className="h-8">
              <UserCheck className="h-3.5 w-3.5 mr-1" /> Unban
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setBanDialogOpen(true)} disabled={loading} className="h-8">
              <Lock className="h-3.5 w-3.5 mr-1" /> Ban
            </Button>
          )}
        </div>
      </Card>

      {/* Ban reason dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {user.fullName}?</DialogTitle>
            <DialogDescription>
              Provide a reason. Access is revoked immediately.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., Repeated fraud reports, fake listings, harassment..."
            value={banReason}
            onChange={e => setBanReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBanDialogOpen(false); setBanReason("") }}>Cancel</Button>
            <Button variant="destructive" onClick={handleBanSubmit} disabled={!banReason.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
