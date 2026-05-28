"use client"

import { Control, FieldErrors } from "react-hook-form"
import { OtherAttr } from "./OtherAttr"

interface Step3AttributesProps {
  categorySlug: string
  control: Control<any>
  errors: FieldErrors<any>
}

export function Step3Attributes({ categorySlug, control, errors }: Step3AttributesProps) {
  switch (categorySlug) {
    case "other": return <OtherAttr control={control} errors={errors} />
    default: return (
      <div className="p-6 border rounded-lg bg-muted/30 text-center text-muted-foreground">
        Attributes for {categorySlug} will be loaded here. (Placeholder for Phase 2 attributes)
      </div>
    )
  }
}
