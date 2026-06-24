"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Canopy / Tent", "Chairs & Tables", "Sound System", "Lighting & Decoration", "Generator (Event)", "Projector & Screen", "Photo Booth", "Backdrop & Banners", "Catering Equipment", "Dance Floor", "Event Costumes", "PA System", "DJ Equipment", "Bouncy Castle", "Other"]

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

export function EventPartyAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.itemType" control={control} label="Item Type" options={types} />
        <Field label="Quantity Available"><Controller name="attributes.quantity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 100 chairs, 10 canopies" />} /></Field>
        <Field label="Capacity / Coverage"><Controller name="attributes.capacity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Seats 200, Covers 10x10m" />} /></Field>
        <Field label="Brand / Manufacturer"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., QSC, Yamaha, Local make" />} /></Field>
        <Field label="Colour / Theme"><Controller name="attributes.color" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., White, Gold, Custom" />} /></Field>
        <Field label="Setup / Delivery Included?"><Controller name="attributes.setupIncluded" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="Yes / No / Extra charge" />} /></Field>
        <Field label="Minimum Rental Days"><Controller name="attributes.minRentalDays" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 1 day, 2 days" />} /></Field>
        <Field label="Service Area"><Controller name="attributes.serviceArea" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Lagos only, Nationwide" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Operator included, booking required 3 days in advance" />} /></Field>
    </div>
  )
}
