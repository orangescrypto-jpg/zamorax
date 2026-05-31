"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Printing Machine", "Welding Machine", "Lathe Machine", "CNC Machine", "Packaging Machine", "Sewing / Embroidery Machine", "Bakery Equipment", "Cold Room / Refrigeration", "Factory Conveyor", "Compressor", "Industrial Mixer", "Grinding Machine", "Injection Moulding", "Other"]
const powerSources = ["Electric", "Diesel", "Petrol", "Pneumatic", "Manual", "Other"]

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

export function IndustrialAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.machineType" control={control} label="Machine Type" options={types} />
        <SelField name="attributes.powerSource" control={control} label="Power Source" options={powerSources} />
        <Field label="Brand / Manufacturer"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Brother, Manesty, Local fab" />} /></Field>
        <Field label="Model"><Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., ML-350, GT2-230" />} /></Field>
        <Field label="Capacity / Output"><Controller name="attributes.capacity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 500 units/hr, 2 Tonnes/day" />} /></Field>
        <Field label="Age / Year"><Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 3 years / Bought 2021" />} /></Field>
        <Field label="Hours Used"><Controller name="attributes.hoursUsed" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 1000 hours" />} /></Field>
        <Field label="Voltage Required"><Controller name="attributes.voltage" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 220V, 380V 3-phase" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Serviced recently, operator training included, video available" />} /></Field>
    </div>
  )
}
