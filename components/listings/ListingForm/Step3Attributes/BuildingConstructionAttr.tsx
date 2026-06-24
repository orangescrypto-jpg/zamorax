"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Cement & Concrete", "Roofing Materials", "Blocks & Bricks", "Tiles & Flooring", "Plumbing Supplies", "Electrical Fittings", "Iron Rods & Steel", "Paints & Coatings", "Doors & Windows", "Scaffolding", "Sand & Gravel", "Wood & Timber", "Waterproofing", "Insulation", "Other"]
const units = ["Bags", "Pieces", "Metres", "Tonnes", "Rolls", "Sheets", "Cartons", "Bundles", "Other"]

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

export function BuildingConstructionAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.materialType" control={control} label="Material Type" options={types} />
        <SelField name="attributes.unit" control={control} label="Unit of Measure" options={units} />
        <Field label="Brand / Manufacturer"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Dangote, BUA, Berger" />} /></Field>
        <Field label="Quantity Available"><Controller name="attributes.quantity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 50 bags, 200 pieces" />} /></Field>
        <Field label="Grade / Standard"><Controller name="attributes.grade" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Grade A, SON Certified, NIS" />} /></Field>
        <Field label="Dimensions / Size"><Controller name="attributes.dimensions" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 600x600mm, 4x8ft" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Bulk discount available, delivery possible, pickup at Oshodi" />} /></Field>
    </div>
  )
}
