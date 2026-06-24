"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Football / Soccer", "Basketball", "Tennis", "Badminton", "Table Tennis", "Swimming", "Gym Equipment", "Cycling", "Running / Athletics", "Boxing / Martial Arts", "Yoga & Pilates", "Golf", "Fishing", "Camping & Outdoors", "Jerseys & Sportswear", "Other"]
const brands = ["Nike", "Adidas", "Puma", "Reebok", "Under Armour", "Wilson", "Spalding", "Mikasa", "Head", "Yonex", "Decathlon", "Other"]

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-sm font-medium">{label}</Label>{children}</div>
}
function SelField({ name, control, label, options }: { name: string, control: Control<any>, label: string, options: string[] }) {
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

export function SportingAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.sportType" control={control} label="Sport / Category" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Model / Name">
          <Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Nike Air Zoom, Treadmill Pro 500" />
          )} />
        </Field>
        <Field label="Size">
          <Controller name="attributes.size" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., UK 10, XL, Standard" />
          )} />
        </Field>
        <Field label="Color">
          <Controller name="attributes.color" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Black/White, Red" />
          )} />
        </Field>
        <Field label="Age / How Long Used">
          <Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 6 months, Barely used" />
          )} />
        </Field>
        <Field label="Weight (if gym equipment)">
          <Controller name="attributes.weight" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 20kg, 100kg capacity" />
          )} />
        </Field>
      </div>
      <Field label="What's Included">
        <Controller name="attributes.accessories" control={control} defaultValue="" render={({ field }) => (
          <Input {...field} placeholder="e.g., Pump, Bag, Manual, Extra laces" />
        )} />
      </Field>
    </div>
  )
}
