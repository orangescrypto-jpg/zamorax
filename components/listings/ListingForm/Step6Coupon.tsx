"use client"
// components/listings/ListingForm/Step6Coupon.tsx
// Coupon step — lets the seller enable a standing discount code on this
// listing (percentage off, buyer enters the code at checkout). Gated on
// sub_settings.couponsEnabled — the whole step is skipped in index.tsx if
// the admin has this off. The max discount a seller can set is also
// admin-controlled via sub_settings.couponMaxDiscountPercent.
//
// Unlike flashDeal (time-limited, set post-creation from the seller
// dashboard), a coupon has no expiry and is set right here at listing
// creation — per the seller-facing feature request.

import { useFormContext, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tag, Info } from "lucide-react"
import { useSubSettings } from "@/hooks/useSubSettings"

export function Step6Coupon() {
  const { control, watch, setValue, formState: { errors } } = useFormContext()
  const { settings } = useSubSettings()
  const enabled = watch("couponEnabled")
  const priceSale = watch("priceSale")
  const discountPercent = watch("couponDiscountPercent")

  const maxDiscount = settings.couponMaxDiscountPercent || 50

  const previewPrice = enabled && priceSale && discountPercent
    ? Math.round(priceSale * (1 - discountPercent / 100))
    : null

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Coupon Code (Optional)
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Give buyers a code for an instant discount on this listing.
          </p>
        </div>
        <Controller
          name="couponEnabled"
          control={control}
          render={({ field }) => (
            <Switch
              checked={!!field.value}
              onCheckedChange={(v) => {
                field.onChange(v)
                if (!v) {
                  setValue("couponCode", "")
                  setValue("couponDiscountPercent", undefined)
                }
              }}
            />
          )}
        />
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-border/60 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="couponCode">Coupon code</Label>
            <Controller
              name="couponCode"
              control={control}
              render={({ field }) => (
                <Input
                  id="couponCode"
                  placeholder="e.g. SAVE10"
                  maxLength={20}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
            {errors.couponCode && (
              <p className="text-xs text-destructive">{String(errors.couponCode.message)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="couponDiscountPercent">Discount percentage</Label>
            <Controller
              name="couponDiscountPercent"
              control={control}
              render={({ field }) => (
                <Input
                  id="couponDiscountPercent"
                  type="number"
                  min={1}
                  max={maxDiscount}
                  placeholder="e.g. 10"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Number(e.target.value)
                    field.onChange(v)
                  }}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">Up to {maxDiscount}%, set by admin.</p>
          </div>

          {previewPrice != null && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
              <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">
                Buyers who enter <strong>{watch("couponCode") || "your code"}</strong> will pay{" "}
                <strong>₦{previewPrice.toLocaleString()}</strong> instead of ₦{Number(priceSale).toLocaleString()}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
