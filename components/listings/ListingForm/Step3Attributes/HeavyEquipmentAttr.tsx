"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Generator", "Inverter / UPS", "Solar Generator", "Welding Machine", "Compressor", "Water Pump", "Concrete Mixer", "Crane / Hoist", "Forklift", "Excavator", "Power Tools", "Industrial Fan", "Borehole Equipment", "Other"]
const brands = ["Elepaq", "Sumec Firman", "Thermocool", "Tiger", "Honda", "Komatsu", "Caterpillar", "Bosch", "Makita", "DeWalt", "Other"]
const fuels = ["Petrol", "Diesel", "Electric", "Dual Fuel", "Gas"]

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

export function HeavyEquipmentAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.equipmentType" control={control} label="Equipment Type" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Capacity / Rating"><Controller name="attributes.capacity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 10KVA, 2.5KW, 5 Tonnes" />} /></Field>
        <SelField name="attributes.fuelType" control={control} label="Fuel Type" options={fuels} />
        <Field label="Model"><Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., ECO8990ES, SFG3800" />} /></Field>
        <Field label="Age / Year"><Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 2 years / Bought 2022" />} /></Field>
        <Field label="Hours Used"><Controller name="attributes.hoursUsed" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 500 hours, Rarely used" />} /></Field>
        <Field label="Operator Included?"><Controller name="attributes.operatorIncluded" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="Yes / No / Extra charge" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Recently serviced, full tank on delivery, cold start video available" />} /></Field>
    </div>
  )
}
