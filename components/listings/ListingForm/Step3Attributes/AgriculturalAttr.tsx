"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Farm Equipment", "Seeds & Seedlings", "Fertilizers & Chemicals", "Animal Feed", "Livestock", "Poultry", "Fish & Aquaculture", "Irrigation Equipment", "Greenhouse Supplies", "Organic Produce", "Processing Equipment", "Other"]
const units = ["Kg", "Bags", "Tonnes", "Pieces", "Litres", "Crates", "Cartons", "Bundles", "Other"]

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

export function AgriculturalAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.productType" control={control} label="Product Type" options={types} />
        <SelField name="attributes.unit" control={control} label="Unit" options={units} />
        <Field label="Quantity Available"><Controller name="attributes.quantity" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 50 bags, 200 kg" />} /></Field>
        <Field label="Brand / Source"><Controller name="attributes.brand" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Notore, Farm direct, IITA" />} /></Field>
        <Field label="Crop / Animal Type"><Controller name="attributes.cropType" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Maize, Cassava, Broiler, Catfish" />} /></Field>
        <Field label="Age / Season"><Controller name="attributes.age" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 6 weeks old, 2023 harvest" />} /></Field>
        <Field label="Certifications"><Controller name="attributes.certifications" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., NAFDAC, Organic, NSPRI" />} /></Field>
        <Field label="Location of Farm"><Controller name="attributes.farmLocation" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Ogun, Kaduna, Benue" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Bulk orders available, delivery to major cities" />} /></Field>
    </div>
  )
}
