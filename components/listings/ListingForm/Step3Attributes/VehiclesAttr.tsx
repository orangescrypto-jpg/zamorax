"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Car", "SUV / Jeep", "Truck / Pickup", "Bus / Minibus", "Van", "Motorcycle", "Tricycle (Keke)", "Bicycle", "Boat", "Tractor", "Other"]
const brands = ["Toyota", "Honda", "Hyundai", "Kia", "Ford", "Mercedes-Benz", "BMW", "Lexus", "Nissan", "Mitsubishi", "Volkswagen", "Peugeot", "Innoson", "Bajaj", "TVS", "Suzuki", "Other"]
const conditions = ["Foreign Used (Tokunbo)", "Nigerian Used", "Brand New"]
const fuels = ["Petrol", "Diesel", "Electric", "Hybrid", "CNG", "Other"]
const transmissions = ["Manual", "Automatic"]
const colors = ["Black", "White", "Silver", "Grey", "Blue", "Red", "Brown", "Gold", "Green", "Other"]

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

export function VehiclesAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.vehicleType" control={control} label="Vehicle Type" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand / Make" options={brands} />
        <Field label="Model"><Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Camry, Corolla, CRV" />} /></Field>
        <Field label="Year"><Controller name="attributes.year" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 2018" />} /></Field>
        <SelField name="attributes.condition" control={control} label="Condition" options={conditions} />
        <SelField name="attributes.fuelType" control={control} label="Fuel Type" options={fuels} />
        <SelField name="attributes.transmission" control={control} label="Transmission" options={transmissions} />
        <SelField name="attributes.color" control={control} label="Color" options={colors} />
        <Field label="Mileage (km)"><Controller name="attributes.mileage" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 75,000 km" />} /></Field>
        <Field label="Engine Size (cc)"><Controller name="attributes.engineSize" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 1800cc, 2.5L" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Full AC, Leather seats, Accident-free, Papers complete" />} /></Field>
    </div>
  )
}
