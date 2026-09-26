"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Raw Meat", "Fresh Fish & Seafood", "Farm Produce (Uncooked)", "Tubers (Yam, Cassava, Potato)", "Grains & Cereals", "Local Spices & Herbs", "Cooked Food (Ready-to-eat)", "Small Chops & Snacks", "Pastries & Baked Goods", "Other"]
const units = ["Per piece", "Per pack", "Per kg", "Per g", "Per litre", "Per carton", "Per plate", "Per basket", "Per tuber", "Per bag (50kg)", "Per bag (25kg)", "Per portion"]
const prepStates = ["Uncooked / Raw", "Cooked / Ready-to-eat"]

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-sm font-medium">{label}</Label>{children}</div>
}
function SelField({ name, control, label, options }: { name: string, control: Control<any>, label: string, options: string[] }) {
  return (
    <Field label={label}>
      <Controller name={name} control={control} defaultValue="" render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger><SelectValue placeholder={`Select ${label}`} /></SelectTrigger>
          <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      )} />
    </Field>
  )
}

export function FoodItemsAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        ⚠️ Uncooked food must be fresh and properly stored. Cooked food must state preparation date and be hygienically packaged.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.foodType" control={control} label="Category" options={types} />
        <SelField name="attributes.prepState" control={control} label="State" options={prepStates} />
        <SelField name="attributes.unit" control={control} label="Sold Per" options={units} />
        <Field label="Weight / Quantity">
          <Controller name="attributes.weight" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 1kg, 5 pieces, 1 basket" />
          )} />
        </Field>
        <Field label="Preparation / Harvest Date">
          <Controller name="attributes.prepDate" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} type="date" />
          )} />
        </Field>
        <Field label="Minimum Order Quantity">
          <Controller name="attributes.minOrder" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 1, 5, 1 basket" />
          )} />
        </Field>
        <Field label="Storage Instructions">
          <Controller name="attributes.storage" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Refrigerate, Keep frozen, Store cool and dry" />
          )} />
        </Field>
        <Field label="Source / Location">
          <Controller name="attributes.origin" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Local farm, Mile 12 Market, Kano" />
          )} />
        </Field>
      </div>
    </div>
  )
}
