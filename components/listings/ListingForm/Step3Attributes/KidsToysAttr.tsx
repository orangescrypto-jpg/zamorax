"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Action Figures", "Dolls", "Educational Toys", "Board Games", "Outdoor Toys", "Ride-On Toys", "Building Blocks", "Puzzles", "Remote Control Toys", "Musical Toys", "Baby Rattles & Teethers", "Dress-Up & Costumes", "Art & Craft Kits", "Video Games", "Other"]
const ageGroups = ["0-1 year", "1-3 years", "3-5 years", "5-8 years", "8-12 years", "12+ years", "All ages"]

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

export function KidsToysAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.toyType" control={control} label="Toy Type" options={types} />
        <SelField name="attributes.ageGroup" control={control} label="Age Group" options={ageGroups} />
        <Field label="Brand"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Lego, Mattel, Local" />} /></Field>
        <Field label="Colour"><Controller name="attributes.color" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Multicolor, Red, Blue" />} /></Field>
        <Field label="Battery Required?"><Controller name="attributes.batteryRequired" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="Yes (AA x4) / No / USB rechargeable" />} /></Field>
        <Field label="Safety Certifications"><Controller name="attributes.safety" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., CE Mark, NAFDAC, Non-toxic" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Complete set, no missing pieces, original packaging" />} /></Field>
    </div>
  )
}
