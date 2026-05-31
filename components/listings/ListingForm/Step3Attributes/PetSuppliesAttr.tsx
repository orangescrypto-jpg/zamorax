"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Pet Food", "Cage / Kennel", "Collar & Leash", "Grooming Supplies", "Toys", "Bed / Mat", "Aquarium & Fish Supplies", "Bird Supplies", "Vet Products", "Live Animal", "Other"]
const animals = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Reptile", "Hamster", "Other"]

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

export function PetSuppliesAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.productType" control={control} label="Product Type" options={types} />
        <SelField name="attributes.animalType" control={control} label="For Animal" options={animals} />
        <Field label="Brand"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Royal Canin, Pedigree, Local" />} /></Field>
        <Field label="Size / Weight"><Controller name="attributes.size" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 5kg bag, Large, 60x40cm" />} /></Field>
        <Field label="Age Suitability"><Controller name="attributes.ageSuitability" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Puppy, Adult, All ages" />} /></Field>
        <Field label="Expiry Date (if food)"><Controller name="attributes.expiryDate" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Dec 2025" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Sealed, unopened, comes with accessories" />} /></Field>
    </div>
  )
}
