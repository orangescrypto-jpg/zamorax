"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["TV", "Generator", "Air Conditioner", "Refrigerator", "Washing Machine", "Microwave", "Blender", "Iron", "Fan", "Speaker", "Headphones", "Camera", "Projector", "Stabilizer/UPS", "Solar Panel", "Inverter", "Other"]
const brands = ["Samsung", "LG", "Sony", "Panasonic", "Hisense", "Thermocool", "Scanfrost", "Haier", "Bosch", "Philips", "JBL", "Canon", "Nikon", "Sumec Firman", "Elepaq", "Mikano", "Other"]
const capacities = ["1.5HP", "2HP", "3HP", "5HP", "0.75kVA", "1kVA", "2kVA", "3.5kVA", "5kVA", "7.5kVA", "10kVA", "200L", "300L", "350L", "400L", "500L"]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-sm font-medium">{label}</Label>{children}</div>
}

function SelField({ name, control, label, options }: { name: string; control: Control<any>; label: string; options: string[] }) {
  return (
    <Field label={label}>
      <Controller name={name} control={control} defaultValue="" render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger><SelectValue placeholder={"Select " + label} /></SelectTrigger>
          <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      )} />
    </Field>
  )
}

export function ElectronicsAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.deviceType" control={control} label="Product Type" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Model">
          <Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g. Samsung 43 inch 4K TV" />
          )} />
        </Field>
        <SelField name="attributes.capacity" control={control} label="Size / Capacity" options={capacities} />
        <Field label="Wattage / Power">
          <Controller name="attributes.wattage" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g. 1500W, 5.5KVA" />
          )} />
        </Field>
        <Field label="Year of Purchase">
          <Controller name="attributes.yearOfPurchase" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g. 2022" />
          )} />
        </Field>
        <Field label="Warranty Status">
          <Controller name="attributes.warranty" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g. 6 months remaining, Expired" />
          )} />
        </Field>
        <Field label="Color">
          <Controller name="attributes.color" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g. Black, Silver, White" />
          )} />
        </Field>
      </div>
      <Field label="Accessories / Box Contents">
        <Controller name="attributes.accessories" control={control} defaultValue="" render={({ field }) => (
          <Input {...field} placeholder="e.g. Remote, Manual, Original Box, Cables" />
        )} />
      </Field>
    </div>
  )
}
