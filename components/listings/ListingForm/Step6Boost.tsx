"use client"
import { useFormContext, Controller } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Sparkles, TrendingUp, Crown } from "lucide-react"

const boostOptions = [
  { id: "none", label: "No Boost (Free)", price: "₦0", icon: <TrendingUp className="h-4 w-4" />, desc: "Standard visibility" },
  { id: "standard", label: "Standard Boost", price: "₦500", icon: <Sparkles className="h-4 w-4" />, desc: "7 days, higher in category" },
  { id: "premium", label: "Premium Boost", price: "₦1,500", icon: <TrendingUp className="h-4 w-4" />, desc: "7 days, top of search" },
  { id: "category_top", label: "Category Top Spot", price: "₦3,000", icon: <Crown className="h-4 w-4" />, desc: "7 days, #1 in category" },
]

export function Step6Boost() {
  const { control, watch } = useFormContext()
  const selected = watch("boostType")

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <Label>Boost Visibility (Optional)</Label>
      <Controller
        name="boostType"
        control={control}
        render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 md:grid-cols-2">
            {boostOptions.map(opt => (
              <Card key={opt.id} className={cn("cursor-pointer transition-all p-4 hover:border-primary", selected === opt.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border")}>
                <div className="flex items-center gap-3 mb-2">
                  <RadioGroupItem value={opt.id} id={opt.id} className="sr-only" />
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">{opt.icon}</div>
                  <div>
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-sm text-primary font-bold">{opt.price}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </Card>
            ))}
          </RadioGroup>
        )}
      />
    </div>
  )
}
