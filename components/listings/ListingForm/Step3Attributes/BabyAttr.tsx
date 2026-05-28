"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Baby Clothing", "Diapers & Wipes", "Baby Food & Formula", "Baby Skincare", "Strollers & Prams", "Car Seats", "Baby Monitors", "Feeding Bottles", "Toys & Rattles", "Cots & Cribs", "Baby Carriers", "Breast Pumps", "Learning Toys", "Other"]
const ageGroups = ["0-3 months", "3-6 months", "6-12 months", "1-2 years", "2-3 years", "3-5 years", "5+ years"]
const genders = ["Boy", "Girl", "Unisex"]

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

export function BabyAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.productType" control={control} label="Product Type" options={types} />
        <SelField name="attributes.ageGroup" control={control} label="Age Group" options={ageGroups} />
        <SelField name="attributes.gender" control={control} label="Gender" options={genders} />
        <Field label="Brand">
          <Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Pampers, Chicco, Graco, Enfamil" />
          )} />
        </Field>
        <Field label="Color / Design">
          <Controller name="attributes.color" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Blue, Pink, Multicolor" />
          )} />
        </Field>
        <Field label="Quantity / Pack Size">
          <Controller name="attributes.quantity" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 1 piece, Pack of 3, 50 diapers" />
          )} />
        </Field>
        <Field label="Expiry Date (food/skincare)">
          <Controller name="attributes.expiryDate" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} type="month" />
          )} />
        </Field>
        <Field label="Safety Certification">
          <Controller name="attributes.safety" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., NAFDAC approved, CE certified" />
          )} />
        </Field>
      </div>
    </div>
  )
}
