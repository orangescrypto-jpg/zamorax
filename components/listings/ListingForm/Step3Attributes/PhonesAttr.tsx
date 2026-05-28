"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const brands = ["Apple", "Samsung", "Tecno", "Infinix", "Itel", "Nokia", "Xiaomi", "Oppo", "Vivo", "Huawei", "OnePlus", "Google", "Motorola", "Sony", "Other"]
const rams = ["1GB", "2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB"]
const storages = ["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"]
const networks = ["2G", "3G", "4G", "5G"]
const colors = ["Black", "White", "Gold", "Silver", "Blue", "Red", "Green", "Purple", "Rose Gold", "Other"]
const deviceTypes = ["Smartphone", "Tablet", "Feature Phone", "Smartwatch", "Accessory"]

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
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

export function PhonesAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.deviceType" control={control} label="Device Type" options={deviceTypes} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Model">
          <Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., iPhone 14 Pro, Galaxy A54" />
          )} />
        </Field>
        <SelField name="attributes.color" control={control} label="Color" options={colors} />
        <SelField name="attributes.ram" control={control} label="RAM" options={rams} />
        <SelField name="attributes.storage" control={control} label="Storage" options={storages} />
        <SelField name="attributes.network" control={control} label="Network" options={networks} />
        <Field label="IMEI Number">
          <Controller name="attributes.imei" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="15-digit IMEI" maxLength={15} />
          )} />
        </Field>
        <Field label="Battery (mAh)" >
          <Controller name="attributes.battery" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 5000" />
          )} />
        </Field>
        <Field label="Screen Size (inches)">
          <Controller name="attributes.screenSize" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., 6.5" />
          )} />
        </Field>
      </div>
      <Field label="Accessories Included">
        <Controller name="attributes.accessories" control={control} defaultValue="" render={({ field }) => (
          <Input {...field} placeholder="e.g., Charger, Earphones, Original Box" />
        )} />
      </Field>
    </div>
  )
}
