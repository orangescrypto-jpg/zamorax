"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Rice & Grains", "Cooking Oil", "Seasoning & Spices", "Tomatoes & Paste", "Drinks & Beverages", "Snacks & Biscuits", "Dairy & Eggs", "Bread & Bakery", "Frozen Foods", "Noodles & Pasta", "Beans & Legumes", "Fresh Produce", "Canned Foods", "Baby Food", "Other"]
const units = ["Per piece", "Per pack", "Per kg", "Per litre", "Per carton", "Per dozen", "Per bag (50kg)", "Per bag (25kg)"]

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

export function GroceriesAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        ⚠️ All groceries must be sealed and within expiry date. Expired items will be removed.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.groceryType" control={control} label="Category" options={types} />
        <SelField name="attributes.unit" control={control} label="Sold Per" options={units} />
        <Field label="Brand">
          <Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Dangote, Titus, Indomie, Milo" />
          )} />
        </Field>
        <Field label="Weight / Volume">
          <Controller name="attributes.weight" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 5kg, 500ml, 1 litre" />
          )} />
        </Field>
        <Field label="Expiry Date *">
          <Controller name="attributes.expiryDate" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} type="month" />
          )} />
        </Field>
        <Field label="Minimum Order Quantity">
          <Controller name="attributes.minOrder" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 1, 5, 1 carton" />
          )} />
        </Field>
        <Field label="Storage Instructions">
          <Controller name="attributes.storage" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Store in cool dry place, Refrigerate" />
          )} />
        </Field>
        <Field label="Country of Origin">
          <Controller name="attributes.origin" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Nigeria, Thailand, USA" />
          )} />
        </Field>
      </div>
    </div>
  )
}
