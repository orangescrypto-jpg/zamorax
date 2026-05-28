"use client"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { nigerianStates } from "@/constants/nigerianStates"

export function Step5Location() {
  const { register, watch, setValue, formState: { errors } } = useFormContext()
  const nationwide = watch("deliveryNationwide")

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
      <div className="space-y-2">
        <Label>State</Label>
        <Select onValueChange={(v) => setValue("nigerianState", v)} value={watch("nigerianState")}>
          <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
          <SelectContent className="max-h-60">
            {nigerianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.nigerianState && <p className="text-sm text-destructive">{String(errors.nigerianState.message)}</p>}
      </div>

      <div className="space-y-2">
        <Label>City / Area</Label>
        <Input {...register("city")} placeholder="e.g., Ikeja, Lekki, GRA" />
        {errors.city && <p className="text-sm text-destructive">{String(errors.city.message)}</p>}
      </div>

      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
        <div>
          <Label className="cursor-pointer">Nationwide Delivery</Label>
          <p className="text-xs text-muted-foreground">Buyers across Nigeria can view & order this item.</p>
        </div>
        <Switch checked={nationwide} onCheckedChange={(v) => setValue("deliveryNationwide", v, { shouldValidate: true })} />
      </div>
    </div>
  )
}
