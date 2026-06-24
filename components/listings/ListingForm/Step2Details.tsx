"use client"
// components/listings/ListingForm/Step2Details.tsx
// Price step — shows live fee note below the price input.
// Reads from useFeeSettings() so if admin changes commission, the note updates automatically.
// If admin sets a fee to 0, the note reflects that (e.g. "0% commission — free listing!").

import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCategoryBySlug } from "@/constants/categories"
import { Package, Info } from "lucide-react"
import { useFeeSettings } from "@/hooks/useFeeSettings"
import { calculateFees } from "@/src/services/feeSettings"
import { formatPrice } from "@/lib/utils"

// ── Live fee note shown below price input ─────────────────────────────────────

function PriceFeeNote({
  priceNaira,
  type,
}: {
  priceNaira: number
  type: "sale" | "rental"
}) {
  const { fees, loading } = useFeeSettings()

  if (loading) return null
  const commissionPct = type === "rental" ? fees.commissionRental : fees.commissionSale

  if (!priceNaira || priceNaira <= 0) {
    // No price entered yet — just show the rates so seller knows upfront
    if (commissionPct === 0 && fees.insuranceRate === 0) {
      return (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 mt-1">
          <Info className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700">
            🎉 <strong>0% platform fee</strong> right now — you keep 100% of whatever price you set!
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 mt-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <p className="text-xs font-semibold text-blue-700">Deductions from your payout:</p>
        </div>
        <ul className="text-xs text-blue-700 space-y-1 pl-5 list-disc">
          {commissionPct > 0 && (
            <li>
              <strong>{commissionPct}% platform fee</strong> — Zamorax service charge for listing, escrow protection, and buyer trust
            </li>
          )}
          {fees.insuranceRate > 0 && (
            <li>
              <strong>{fees.insuranceRate}% escrow/arbitration fee</strong> — held separately to cover any buyer–seller dispute. Returned to you if no dispute is raised
            </li>
          )}
          {fees.withdrawalFee > 0 && (
            <li>
              <strong>₦{(fees.withdrawalFee / 100).toLocaleString()} withdrawal fee</strong> — flat charge when you request a payout
            </li>
          )}
        </ul>
        <p className="text-xs text-blue-600 pl-1">Enter a price above to see your exact net earnings.</p>
      </div>
    )
  }

  const itemPriceKobo = priceNaira * 100
  const breakdown     = calculateFees(itemPriceKobo, type, fees)

  if (commissionPct === 0 && fees.insuranceRate === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 mt-1">
        <Info className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-xs text-emerald-700">
          🎉 No fees right now — you receive the full <strong>{formatPrice(itemPriceKobo)}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 mt-1 space-y-2">
      <div className="flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <p className="text-xs font-semibold text-blue-700">Payout breakdown for {formatPrice(itemPriceKobo)}:</p>
      </div>
      <ul className="text-xs text-blue-700 space-y-1 pl-5 list-disc">
        {breakdown.commissionKobo > 0 && (
          <li>
            <strong>-{formatPrice(breakdown.commissionKobo)}</strong> platform fee ({commissionPct}%) — escrow & service charge
          </li>
        )}
        {breakdown.insuranceKobo > 0 && (
          <li>
            <strong>-{formatPrice(breakdown.insuranceKobo)}</strong> arbitration fee ({fees.insuranceRate}%) — dispute protection fund
          </li>
        )}
        {breakdown.withdrawalFeeKobo > 0 && (
          <li>
            <strong>-{formatPrice(breakdown.withdrawalFeeKobo)}</strong> withdrawal fee (fixed, on payout)
          </li>
        )}
      </ul>
      <div className="flex justify-between items-center border-t border-blue-200 pt-2">
        <p className="text-xs font-bold text-blue-800">You receive after settlement:</p>
        <p className="text-sm font-bold text-blue-900">{formatPrice(breakdown.sellerPayoutKobo)}</p>
      </div>
    </div>
  )
}

// ── Main step component ───────────────────────────────────────────────────────

export function Step2Details() {
  const { register, watch, setValue, formState: { errors } } = useFormContext()
  const category    = watch("categorySlug")
  const listingType = watch("listingType")
  const priceSale   = watch("priceSale")
  const priceRent   = watch("priceRentDaily")

  // Auto-calculate deposit for rentals (30% default, adjustable)
  const updateDeposit = () => {
    if (priceRent && Number(priceRent) > 0) {
      setValue("depositAmount", Math.ceil(Number(priceRent) * 0.3), { shouldValidate: true })
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
      <div className="space-y-2">
        <Label>Listing Title</Label>
        <Input {...register("title")} placeholder="e.g., iPhone 14 Pro Max 256GB Deep Purple" />
        {errors.title && <p className="text-sm text-destructive">{String(errors.title.message)}</p>}
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea {...register("description")} placeholder="Describe condition, accessories, defects, etc." rows={4} />
        {errors.description && <p className="text-sm text-destructive">{String(errors.description.message)}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Condition</Label>
          <Select onValueChange={(v) => setValue("condition", v)}>
            <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="brand_new">Brand New</SelectItem>
              <SelectItem value="open_box">Open Box</SelectItem>
              <SelectItem value="grade_a">Grade A (Excellent)</SelectItem>
              <SelectItem value="grade_b">Grade B (Good/Fair)</SelectItem>
            </SelectContent>
          </Select>
          {errors.condition && <p className="text-sm text-destructive">{String(errors.condition.message)}</p>}
        </div>
      </div>

      {/* ── Sale price + live fee note ──────────────────────────── */}
      {(listingType === "sale" || listingType === "both" || !listingType) && (
        <div className="space-y-2">
          <Label>Price (₦)</Label>
          <Input
            type="number"
            {...register("priceSale", { valueAsNumber: true })}
            placeholder="100,000"
          />
          {errors.priceSale && (
            <p className="text-sm text-destructive">{String(errors.priceSale.message)}</p>
          )}
          {/* Live fee note — updates as seller types */}
          <PriceFeeNote priceNaira={Number(priceSale) || 0} type="sale" />
        </div>
      )}

      {/* Stock Quantity — only for sale listings */}
      {(listingType === "sale" || listingType === "both") && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Stock Quantity
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="Leave blank for unlimited"
            {...register("stockQty", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            How many of this item do you have? Leave blank for unlimited. Set to <strong>1</strong> if this is a unique item (used laptop, one-of-a-kind).
          </p>
          {errors.stockQty && <p className="text-sm text-destructive">{String(errors.stockQty.message)}</p>}
        </div>
      )}

      {/* ── Rental details + live fee note ─────────────────────── */}
      {listingType !== "sale" && (
        <div className="p-4 border rounded-lg bg-accent/5 space-y-4">
          <h4 className="font-medium text-accent">Rental Details</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Daily Rate (₦)</Label>
              <Input
                type="number"
                {...register("priceRentDaily", { valueAsNumber: true })}
                onBlur={updateDeposit}
              />
              {/* Live fee note for rental */}
              <PriceFeeNote priceNaira={Number(priceRent) || 0} type="rental" />
            </div>
            <div className="space-y-2">
              <Label>Weekly Rate (₦)</Label>
              <Input type="number" {...register("priceRentWeekly", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Security Deposit (₦) — Auto: 30%</Label>
            <Input type="number" {...register("depositAmount", { valueAsNumber: true })} />
          </div>
        </div>
      )}
    </div>
  )
}
