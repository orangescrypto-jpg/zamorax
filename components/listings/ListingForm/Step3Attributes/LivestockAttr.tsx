"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Poultry (Chicken, Turkey, Duck)", "Goats", "Sheep", "Cattle / Cows", "Pigs", "Fish (Live)", "Snails", "Rabbits", "Other"]
const units = ["Per bird", "Per animal", "Per kg (live weight)", "Per crate", "Per basin", "Per pair"]
const genders = ["Male", "Female", "Mixed / Not specified"]

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

export function LivestockAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        ⚠️ Live video required. Confirm animal health and vaccination status before listing.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.animalType" control={control} label="Animal Type" options={types} />
        <SelField name="attributes.unit" control={control} label="Sold Per" options={units} />
        <SelField name="attributes.gender" control={control} label="Gender" options={genders} />
        <Field label="Age">
          <Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 3 months, 1 year" />
          )} />
        </Field>
        <Field label="Weight">
          <Controller name="attributes.weight" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 25kg" />
          )} />
        </Field>
        <Field label="Breed">
          <Controller name="attributes.breed" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Broiler, Sahel goat, Boer" />
          )} />
        </Field>
        <Field label="Vaccination Status">
          <Controller name="attributes.vaccination" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Fully vaccinated, Not vaccinated" />
          )} />
        </Field>
        <Field label="Location / Farm">
          <Controller name="attributes.origin" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Local farm, Kaduna" />
          )} />
        </Field>
      </div>
    </div>
  )
}
