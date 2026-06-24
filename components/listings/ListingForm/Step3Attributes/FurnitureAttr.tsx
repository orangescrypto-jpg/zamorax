"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Sofa / Couch", "Bed Frame", "Mattress", "Wardrobe", "Dining Table & Chairs", "Coffee Table", "Bookshelf", "TV Stand", "Dressing Table", "Shoe Rack", "Bunk Bed", "Study Desk", "Recliner Chair", "Ottoman / Footstool", "Other"]
const materials = ["Wood", "Metal", "Glass", "Plastic", "Fabric", "Leather", "Foam", "Rattan", "MDF", "Other"]
const colors = ["Brown", "Black", "White", "Grey", "Cream", "Beige", "Blue", "Red", "Green", "Multicolor", "Other"]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-sm font-medium">{label}</Label>{children}</div>
}
function SelField({ name, control, label, options }: { name: string; control: Control<any>; label: string; options: string[] }) {
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

export function FurnitureAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.furnitureType" control={control} label="Furniture Type" options={types} />
        <SelField name="attributes.material" control={control} label="Material" options={materials} />
        <SelField name="attributes.color" control={control} label="Color" options={colors} />
        <Field label="Brand"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Vitafoam, Ramos, Custom" />} /></Field>
        <Field label="Dimensions (L x W x H)"><Controller name="attributes.dimensions" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 200cm x 90cm x 85cm" />} /></Field>
        <Field label="Age / Year Bought"><Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 2 years / Bought 2022" />} /></Field>
        <Field label="Assembly Required?"><Controller name="attributes.assembly" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="Yes / No / Already assembled" />} /></Field>
        <Field label="Seating Capacity (if applicable)"><Controller name="attributes.seatingCapacity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 3-seater, 6-seater" />} /></Field>
      </div>
      <Field label="Additional Details"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Pickup only, scratches on side, delivery available" />} /></Field>
    </div>
  )
}
