"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Solar Panel", "Inverter", "Battery", "Charge Controller", "Solar Street Light", "Solar Water Pump", "Complete Solar Kit", "Solar Generator", "Solar Accessories", "Other"]
const brands = ["Luminous", "Felicity", "Felicity Solar", "Victron", "Growatt", "Schneider", "Phocos", "Amstron", "Ritar", "Other"]
const panelTypes = ["Monocrystalline", "Polycrystalline", "Thin Film"]
const inverterTypes = ["Pure Sine Wave", "Modified Sine Wave", "Hybrid", "Off-Grid", "Grid-Tied"]

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

export function SolarEnergyAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.productType" control={control} label="Product Type" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Wattage / Capacity"><Controller name="attributes.capacity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 400W, 5KVA, 200Ah" />} /></Field>
        <Field label="Voltage"><Controller name="attributes.voltage" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 12V, 24V, 48V" />} /></Field>
        <SelField name="attributes.panelType" control={control} label="Panel Type (if panel)" options={panelTypes} />
        <SelField name="attributes.inverterType" control={control} label="Inverter Type (if inverter)" options={inverterTypes} />
        <Field label="Warranty"><Controller name="attributes.warranty" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 2 years, 25 years on panel" />} /></Field>
        <Field label="Age / Year Bought"><Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Brand new / 1 year old" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Installation available, full system setup, delivery Lagos" />} /></Field>
    </div>
  )
}
