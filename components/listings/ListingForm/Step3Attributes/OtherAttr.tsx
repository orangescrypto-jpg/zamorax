"use client"

import { Control, FieldErrors, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface OtherAttrProps {
  control: Control<any>
  errors: FieldErrors<any>
}

export function OtherAttr({ control, errors }: OtherAttrProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-sm text-accent-foreground">
        💡 <strong>Other Category:</strong> This listing won't follow strict category rules. Provide clear details to build buyer trust.
      </div>
      
      <div className="space-y-2">
        <Label>Custom Tags / Keywords (comma separated)</Label>
        <Controller
          name="attributes.customTags"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <Input
              {...field}
              placeholder="e.g., handmade, vintage, industrial, collectible"
            />
          )}
        />
        {(errors.attributes as any)?.customTags && (
          <p className="text-xs text-destructive">{String((errors.attributes as any).customTags.message)}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Additional Details & Condition Notes</Label>
        <Controller
          name="attributes.additionalNotes"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Describe size, weight, origin, warranty, defects, or any unique features..."
              rows={4}
            />
          )}
        />
      </div>
    </div>
  )
}
