"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { RevenueStats } from "@/components/admin/RevenueStats"
import { CategoryRevenueBreakdown } from "@/components/admin/CategoryRevenueBreakdown"
import { InsurancePoolMonitor } from "@/components/admin/InsurancePoolMonitor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function AdminRevenuePage() {
  const { loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold">Revenue Dashboard</h1>
        <p className="text-muted-foreground">Live financial overview, commission splits, and insurance pool tracking.</p>
      </div>
      <RevenueStats />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle>Revenue by Category</CardTitle></CardHeader><CardContent><CategoryRevenueBreakdown /></CardContent></Card>
        <Card><CardHeader><CardTitle>Insurance Pool Monitor</CardTitle></CardHeader><CardContent><InsurancePoolMonitor /></CardContent></Card>
      </div>
    </div>
  )
}
