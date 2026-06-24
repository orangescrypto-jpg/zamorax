"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Engine Parts", "Tyres & Rims", "Body Parts", "Electrical Parts", "Suspension & Steering", "Brake System", "Transmission Parts", "Exhaust System", "Car Battery", "Oils & Fluids", "Car Audio & Electronics", "Lights & Bulbs", "Filters", "Car Accessories", "Other"]
const conditions = ["Brand New", "Foreign Used (Tokunbo)", "Nigerian Used", "Refurbished"]

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

export function AutomotivePartsAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.partType" control={control} label="Part Type" options={types} />
        <SelField name="attributes.condition" control={control} label="Condition" options={conditions} />
        <Field label="Compatible Vehicle(s)"><Controller name="attributes.compatibility" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Toyota Camry 2012-2017, Honda Accord" />} /></Field>
        <Field label="Part Number (if known)"><Controller name="attributes.partNumber" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 90915-YZZD3" />} /></Field>
        <Field label="Brand / Manufacturer"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Bosch, Denso, OEM, Aftermarket" />} /></Field>
        <Field label="Quantity Available"><Controller name="attributes.quantity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 1 piece, 4 tyres" />} /></Field>
        <Field label="Tyre Size (if tyres)"><Controller name="attributes.tyreSize" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 205/55R16" />} /></Field>
        <Field label="Warranty"><Controller name="attributes.warranty" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 6 months, No warranty" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Direct replacement, fits without modification" />} /></Field>
    </div>
  )
}
