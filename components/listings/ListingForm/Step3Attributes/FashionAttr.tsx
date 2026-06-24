"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Men's Clothing", "Women's Clothing", "Kids' Clothing", "Men's Shoes", "Women's Shoes", "Kids' Shoes", "Bags & Luggage", "Watches", "Jewelry", "Sunglasses", "Accessories", "Traditional Attire", "Underwear & Lingerie", "Sportswear"]
const genders = ["Male", "Female", "Unisex", "Kids - Boy", "Kids - Girl"]
const sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size", "6", "7", "8", "9", "10", "11", "12", "UK 36", "UK 38", "UK 40", "UK 42", "UK 44"]
const materials = ["Cotton", "Polyester", "Silk", "Wool", "Linen", "Leather", "Denim", "Chiffon", "Ankara", "Aso-oke", "Kente", "Lace", "Velvet", "Suede", "Synthetic", "Other"]
const colors = ["Black", "White", "Red", "Blue", "Green", "Yellow", "Brown", "Grey", "Pink", "Purple", "Orange", "Multicolor", "Nude", "Navy", "Other"]

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

export function FashionAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.fashionType" control={control} label="Category" options={types} />
        <SelField name="attributes.gender" control={control} label="Gender" options={genders} />
        <SelField name="attributes.size" control={control} label="Size" options={sizes} />
        <SelField name="attributes.color" control={control} label="Color" options={colors} />
        <SelField name="attributes.material" control={control} label="Material" options={materials} />
        <Field label="Brand">
          <Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Nike, Zara, Ankara Custom" />
          )} />
        </Field>
        <Field label="Style / Design">
          <Controller name="attributes.style" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Casual, Formal, Traditional, Sporty" />
          )} />
        </Field>
        <Field label="Shoe Size (if applicable)">
          <Controller name="attributes.shoeSize" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., UK 42, EU 43" />
          )} />
        </Field>
      </div>
      <Field label="Additional Details">
        <Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => (
          <Input {...field} placeholder="e.g., Never worn, tags on, dry clean only" />
        )} />
      </Field>
    </div>
  )
}
