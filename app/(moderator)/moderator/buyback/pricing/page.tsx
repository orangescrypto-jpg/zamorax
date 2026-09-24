"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminService } from "@/src/services/admin"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface PricingRow {
  id: string
  category_slug: string
  brand: string
  model: string
  storage_variant: string | null
  condition: string
  price: number
  is_active: number
}

export default function ModeratorBuybackPricingPage() {
  const [rows, setRows] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await AdminService.getCollection("buybackPricing") as unknown as PricingRow[]
      setRows((data ?? []).sort((a, b) =>
        a.category_slug.localeCompare(b.category_slug) ||
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model),
      ))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Sell for Cash — Pricing (View Only)</h1>
        <p className="text-sm text-muted-foreground">
          Reference pricing for inspections. Only admin can add or edit rows.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <Card key={row.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{row.brand} {row.model}</span>
                  {row.storage_variant && <span className="text-muted-foreground"> · {row.storage_variant}</span>}
                  <span className="text-muted-foreground"> · {row.condition.replace("_", " ")}</span>
                  <div className="text-primary font-semibold">₦{Number(row.price).toLocaleString()}</div>
                </div>
                <Badge variant={row.is_active ? "default" : "secondary"}>
                  {row.is_active ? "Active" : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-muted-foreground py-10">No pricing rows yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
