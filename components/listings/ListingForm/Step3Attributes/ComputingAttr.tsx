"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const brands = ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "Microsoft", "Samsung", "Huawei", "LG", "Toshiba", "Other"]
const types = ["Laptop", "Desktop", "All-in-One", "Mini PC", "Chromebook", "Gaming PC", "Workstation", "Monitor", "Printer", "Accessory"]
const rams = ["2GB", "4GB", "8GB", "16GB", "32GB", "64GB"]
const storages = ["128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD", "1TB HDD", "2TB HDD", "500GB HDD"]
const processors = ["Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9", "Apple M1", "Apple M2", "Apple M3", "Celeron", "Pentium"]
const screens = ["11\"", "12\"", "13\"", "14\"", "15.6\"", "16\"", "17\"", "21\"", "24\"", "27\"", "32\""]
const gpus = ["Integrated", "NVIDIA GTX 1650", "NVIDIA RTX 3050", "NVIDIA RTX 3060", "NVIDIA RTX 4060", "AMD Radeon", "Other"]

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

export function ComputingAttr({ control, errors }: { control: Control<any>, errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.deviceType" control={control} label="Type" options={types} />
        <SelField name="attributes.brand" control={control} label="Brand" options={brands} />
        <Field label="Model">
          <Controller name="attributes.model" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., MacBook Pro 2023, Dell XPS 15" />
          )} />
        </Field>
        <SelField name="attributes.processor" control={control} label="Processor" options={processors} />
        <SelField name="attributes.ram" control={control} label="RAM" options={rams} />
        <SelField name="attributes.storage" control={control} label="Storage" options={storages} />
        <SelField name="attributes.screenSize" control={control} label="Screen Size" options={screens} />
        <SelField name="attributes.gpu" control={control} label="Graphics Card" options={gpus} />
        <Field label="Operating System">
          <Controller name="attributes.os" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="e.g., Windows 11, macOS Sonoma, Ubuntu" />
          )} />
        </Field>
        <Field label="Serial Number">
          <Controller name="attributes.serial" control={control} defaultValue="" render={({ field }) => (
            <Input {...field} placeholder="Optional but recommended" />
          )} />
        </Field>
      </div>
      <Field label="Accessories Included">
        <Controller name="attributes.accessories" control={control} defaultValue="" render={({ field }) => (
          <Input {...field} placeholder="e.g., Charger, Mouse, Bag, Original Box" />
        )} />
      </Field>
    </div>
  )
}
