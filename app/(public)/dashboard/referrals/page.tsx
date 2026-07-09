"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { ReferralsService } from "@/src/services/referrals"
import { AdminService, where, orderBy } from "@/src/services"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { formatDistanceToNow } from "date-fns"
import {
  Gift, Copy, Users, Wallet, CheckCircle2,
  Clock, Share2, ArrowRight, ExternalLink,
} from "lucide-react"

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  signed_up: { label: "Signed Up",       color: "bg-blue-100 text-blue-700" },
  ordered:   { label: "First Order ✓",   color: "bg-green-100 text-green-700" },
  sold:      { label: "First Sale ✓",    color: "bg-green-100 text-green-700" },
  pending:   { label: "Pending",         color: "bg-amber-100 text-amber-700" },
}

export default function ReferralDashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [referralLink, setReferralLink] = useState("")
  const [rewards, setRewards] = useState<{
    buyer_signup: number; first_order: number
    seller_signup: number; seller_first_sale: number
  } | null>(null)
  const [referrals, setReferrals] = useState<any[]>([])
  const [wallet, setWallet] = useState<{ balance: number; totalEarned: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    const link = ReferralsService.getReferralLink(user.uid)
    setReferralLink(link)

    Promise.all([
      ReferralsService.getReferralRewards(),
      AdminService.getCollection("referrals", [
        where("referrerId", "==", user.uid),
        orderBy("createdAt", "desc"),
      ]),
      AdminService.getDoc("agentWallets", user.uid),
    ])
      .then(([r, refs, w]) => {
        setRewards(r)
        setReferrals(refs || [])
        setWallet(w ? { balance: w.balance ?? 0, totalEarned: w.totalEarned ?? 0 } : { balance: 0, totalEarned: 0 })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.uid])

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    toast({ title: "Link Copied!", description: "Share it with friends to earn rewards." })
  }

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Join Zamorax — Nigeria's safest marketplace with escrow protection! Sign up using my link and we both earn: ${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, "_blank")
  }

  const fmt = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`
  const totalSignups = referrals.length
  const buyerReferrals = referrals.filter(r => (r.referredRole ?? r.referred_role ?? "buyer") === "buyer")
  const sellerReferrals = referrals.filter(r => (r.referredRole ?? r.referred_role) === "seller")
  const totalOrders = referrals.filter(r => r.status === "ordered").length
  const totalSales = referrals.filter(r => r.status === "sold").length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" /> Refer & Earn
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share your link. Refer buyers or sellers — earn cash either way.
        </p>
      </div>

      {/* Reward rates */}
      {loading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : rewards && (
        <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-5 text-primary-foreground space-y-4">
          <div>
            <p className="font-semibold text-sm opacity-90 mb-2">Refer a Buyer</p>
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="text-3xl font-extrabold">{fmt(rewards.buyer_signup)}</p>
                <p className="text-xs opacity-80">when they sign up</p>
              </div>
              <div className="self-center text-2xl opacity-40">+</div>
              <div>
                <p className="text-3xl font-extrabold">{fmt(rewards.first_order)}</p>
                <p className="text-xs opacity-80">when they place their first order</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 pt-3">
            <p className="font-semibold text-sm opacity-90 mb-2">Refer a Seller</p>
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="text-3xl font-extrabold">{fmt(rewards.seller_signup)}</p>
                <p className="text-xs opacity-80">when they sign up</p>
              </div>
              <div className="self-center text-2xl opacity-40">+</div>
              <div>
                <p className="text-3xl font-extrabold">{fmt(rewards.seller_first_sale)}</p>
                <p className="text-xs opacity-80">when their first listing sells</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Users} label="Total Referrals" value={loading ? "—" : String(totalSignups)}
          sub={`${buyerReferrals.length} buyers · ${sellerReferrals.length} sellers`} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Wallet} label="Referral Earnings" value={loading ? "—" : fmt(wallet?.totalEarned ?? 0)}
          sub={`₦${((wallet?.balance ?? 0) / 100).toLocaleString()} available`} color="bg-green-100 text-green-600" />
      </div>

      {/* Referral link */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 text-sm font-mono text-muted-foreground overflow-hidden">
            <span className="truncate flex-1">{referralLink}</span>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-2" /> Copy Link
            </Button>
            <Button variant="outline" className="flex-1 text-[#25D366] border-[#25D366] hover:bg-[#25D366]/10"
              onClick={shareWhatsApp}>
              <Share2 className="h-4 w-4 mr-2" /> Share on WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: Share2,       text: "Share your unique referral link with anyone — friends can join as a buyer or a seller" },
            { icon: Users,        text: "They sign up using your link → you earn the signup reward for that role" },
            { icon: CheckCircle2, text: "Buyer places their first order, or seller makes their first successful sale → you earn the bonus reward" },
            { icon: Wallet,       text: "Rewards land in your referral wallet instantly" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                {i + 1}
              </div>
              <p className="text-muted-foreground pt-0.5">{text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Referral history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Your Referrals
            <Badge variant="secondary">{loading ? "…" : totalSignups}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No referrals yet. Share your link to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {referrals.map((ref, i) => {
                const status = STATUS_CONFIG[ref.status] ?? STATUS_CONFIG.pending
                const role = (ref.referredRole ?? ref.referred_role ?? "buyer") === "seller" ? "Seller" : "Buyer"
                const date = ref.createdAt?.toDate?.() ?? new Date(ref.createdAt)
                return (
                  <div key={i} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Referred {role}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(date, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs ${status.color} border-0`}>{status.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        Rewards are credited instantly to your referral wallet and can be withdrawn to your bank account.
        Referrals must be genuine new users. Abuse of the referral system will result in account suspension.
      </p>
    </div>
  )
}
