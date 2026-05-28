"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle, Sparkles, TrendingUp, Crown } from "lucide-react"

interface BoostCardProps {
  title: string
  price: number // In Kobo
  duration: string
  description: string
  isActive?: boolean
  isSelected?: boolean
  onSelect: () => void
}

const iconMap: Record<string, React.ReactNode> = {
  Standard: <Sparkles className="h-5 w-5 text-blue-500" />,
  Premium: <TrendingUp className="h-5 w-5 text-purple-500" />,
  "Category Top": <Crown className="h-5 w-5 text-amber-500" />
}

export function BoostCard({ title, price, duration, description, isActive, isSelected, onSelect }: BoostCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 border-2",
        isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">{iconMap[title] || <Sparkles />}</div>
          <div>
            <h4 className="font-semibold flex items-center gap-2">
              {title}
              {isActive && <Badge variant="success" className="ml-2">Active</Badge>}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            <p className="text-xs text-muted-foreground mt-1">Duration: {duration}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <span className="font-bold text-primary">₦{price / 100}</span>
          {isSelected ? (
            <Button size="sm" className="bg-primary text-white h-7 px-3">Selected</Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 px-3">Select</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
