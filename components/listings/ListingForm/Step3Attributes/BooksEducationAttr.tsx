"use client"
import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const types = ["Textbook", "Past Questions & Answers", "Novel / Fiction", "Non-Fiction", "Religious Book", "Children's Book", "Study Guide", "Dictionary / Encyclopedia", "Professional Certification Material", "Online Course / Digital", "Stationery Bundle", "Other"]
const levels = ["Primary School", "JSS", "SSS / WAEC", "JAMB / UTME", "University", "Postgraduate", "Professional", "General / All levels"]
const conditions = ["Brand New (Sealed)", "Like New", "Good (minor marks)", "Fair (highlights/notes inside)"]

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

export function BooksEducationAttr({ control, errors }: { control: Control<any>; errors: FieldErrors<any> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="grid grid-cols-2 gap-3">
        <SelField name="attributes.bookType" control={control} label="Book Type" options={types} />
        <SelField name="attributes.level" control={control} label="Education Level" options={levels} />
        <Field label="Title"><Controller name="attributes.title" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., New General Mathematics SSS3" />} /></Field>
        <Field label="Author"><Controller name="attributes.author" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., M.F. Macrae" />} /></Field>
        <Field label="Edition / Year"><Controller name="attributes.edition" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 3rd Edition, 2022" />} /></Field>
        <Field label="ISBN (optional)"><Controller name="attributes.isbn" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., 978-0-19-..." />} /></Field>
        <SelField name="attributes.bookCondition" control={control} label="Book Condition" options={conditions} />
        <Field label="Subject / Course"><Controller name="attributes.subject" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., Mathematics, Biology, Law" />} /></Field>
      </div>
      <Field label="Additional Info"><Controller name="attributes.additionalNotes" control={control} defaultValue="" render={({ field }) => <Input {...field} placeholder="e.g., No missing pages, bulk discount for 5+ copies" />} /></Field>
    </div>
  )
}
