"use client"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCategoryBySlug } from "@/constants/categories"

export function Step2Details() {
  const { register, watch, setValue, formState: { errors } } = useFormContext()
  const category = watch("categorySlug")
  const listingType = watch("listingType")

  // Auto-calculate deposit for rentals (30% default, adjustable)
  const priceRent = watch("priceRentDaily")
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

      <div className="space-y-2">
        <Label>Price (₦)</Label>
        <Input type="number" {...register("priceSale", { valueAsNumber: true })} placeholder="100,000" />
        {errors.priceSale && <p className="text-sm text-destructive">{String(errors.priceSale.message)}</p>}
      </div>

      {listingType !== "sale" && (
        <div className="p-4 border rounded-lg bg-accent/5 space-y-4">
          <h4 className="font-medium text-accent">Rental Details</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Daily Rate (₦)</Label><Input type="number" {...register("priceRentDaily", { valueAsNumber: true })} onBlur={updateDeposit} /></div>
            <div className="space-y-2"><Label>Weekly Rate (₦)</Label><Input type="number" {...register("priceRentWeekly", { valueAsNumber: true })} /></div>
          </div>
          <div className="space-y-2"><Label>Security Deposit (₦) — Auto: 30%</Label><Input type="number" {...register("depositAmount", { valueAsNumber: true })} /></div>
        </div>
      )}
    </div>
  )
}
