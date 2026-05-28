"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Skincare", "Hair Care", "Makeup & Cosmetics", "Perfume & Fragrance", "Nail Care", "Men's Grooming", "Oral Care", "Vitamins & Supplements", "Medical Devices", "Fitness Equipment", "Massage & Relaxation", "Personal Hygiene", "Other"]
const skinTypes = ["All Skin Types", "Oily", "Dry", "Combination", "Sensitive", "Normal"]
const genders = ["Female", "Male", "Unisex"]

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

export function HealthBeautyAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        ✅ Only sealed, unexpired products allowed. Expiry date is required.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.productType" control={control} label="Product Type" options={types} />
        <SelField name="attributes.gender" control={control} label="For" options={genders} />
        <Field label="Brand">
          <Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Neutrogena, Dove, MAC, OAN" />
          )} />
        </Field>
        <Field label="Volume / Weight">
          <Controller name="attributes.volume" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 200ml, 50g, 1L" />
          )} />
        </Field>
        <SelField name="attributes.skinType" control={control} label="Skin Type" options={skinTypes} />
        <Field label="Expiry Date *">
          <Controller name="attributes.expiryDate" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} type="month" />
          )} />
        </Field>
        <Field label="Country of Origin">
          <Controller name="attributes.origin" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., USA, UK, Nigeria, France" />
          )} />
        </Field>
        <Field label="NAFDAC Number">
          <Controller name="attributes.nafdac" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="Optional but builds trust" />
          )} />
        </Field>
      </div>
      <Field label="Key Ingredients / Benefits">
        <Controller name="attributes.ingredients" control={control} defaultValue="" render={({ field }) => (
          <Input {...field} placeholder="e.g., Vitamin C, Hyaluronic Acid, SPF 50" />
        )} />
      </Field>
    </div>
  )
}
