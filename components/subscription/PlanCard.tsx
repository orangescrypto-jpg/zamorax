"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"
import Link from "next/link"

interface PlanCardProps {
  name: string
  price: string
  period: string
  badge?: string | null
  features: string[]
  cta: string
  href: string
  variant?: "default" | "outline" | "secondary"
  disabled?: boolean
  onClick?: () => void   // when provided, renders a button instead of a Link
}

export function PlanCard({ name, price, period, badge, features, cta, href, variant = "outline", disabled = false, onClick }: PlanCardProps) {
  const isRecommended = badge !== null && badge !== undefined

  return (
    <Card className={cn("relative flex flex-col h-full", isRecommended ? "border-primary shadow-lg scale-[1.02]" : "border-border")}>
      {badge && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white">{badge}</Badge>}
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl font-heading">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-muted-foreground text-sm"> / {period}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{feat}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-4">
        {disabled ? (
          <Button variant="outline" className="w-full opacity-60 cursor-not-allowed" disabled>
            {cta}
          </Button>
        ) : onClick ? (
          <Button variant={isRecommended ? "default" : variant} className="w-full" onClick={onClick}>
            {cta}
          </Button>
        ) : (
          <Button variant={isRecommended ? "default" : variant} className="w-full" asChild>
            <Link href={href}>{cta}</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
