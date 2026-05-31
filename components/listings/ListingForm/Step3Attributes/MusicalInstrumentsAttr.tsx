"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Guitar (Acoustic)", "Guitar (Electric)", "Guitar (Bass)", "Keyboard / Piano", "Drum Kit", "Saxophone", "Trumpet", "Violin", "DJ Equipment", "Microphone", "Amplifier", "Speaker / PA", "Flute", "Traditional Drum", "Other"]
const brands = ["Yamaha", "Roland", "Fender", "Gibson", "Casio", "Korg", "Shure", "Pioneer", "Behringer", "Boss", "Other"]

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

export function MusicalInstrumentsAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.instrumentType" control={control} label="Instrument Type" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Model"><Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., FG800, P-45, SM58" />} /></Field>
        <Field label="Colour"><Controller name="attributes.color" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Natural, Black, Sunburst" />} /></Field>
        <Field label="Age / Condition Details"><Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 2 years, minor scratch on body" />} /></Field>
        <Field label="Accessories Included"><Controller name="attributes.accessories" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Case, Strap, Cables, Pedals" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Fully functional, studio used only, demo video available" />} /></Field>
    </div>
  )
}
