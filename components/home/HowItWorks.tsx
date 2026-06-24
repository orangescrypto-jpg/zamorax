"use client"
// components/home/HowItWorks.tsx
// Admin-configurable "How It Works" section.
// Steps, title, and visibility are all editable in admin → Settings → Homepage Sections.
// Reads from usePlatformSettings — no direct Firebase calls.

import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import {
  Tag, ShieldCheck, BadgeCheck, Zap, Truck, Star,
  Package, Search, CreditCard, Lock, Handshake, RefreshCcw,
  MapPin, Bell, Heart, Gift, Camera, Globe,
} from "lucide-react"

// Map of icon name strings (as stored in Firestore) to actual components.
const ICON_MAP: Record<string, React.ReactNode> = {
  Tag:         <Tag         className="h-6 w-6" />,
  ShieldCheck: <ShieldCheck className="h-6 w-6" />,
  BadgeCheck:  <BadgeCheck  className="h-6 w-6" />,
  Zap:         <Zap         className="h-6 w-6" />,
  Truck:       <Truck       className="h-6 w-6" />,
  Star:        <Star        className="h-6 w-6" />,
  Package:     <Package     className="h-6 w-6" />,
  Search:      <Search      className="h-6 w-6" />,
  CreditCard:  <CreditCard  className="h-6 w-6" />,
  Lock:        <Lock        className="h-6 w-6" />,
  Handshake:   <Handshake   className="h-6 w-6" />,
  RefreshCcw:  <RefreshCcw  className="h-6 w-6" />,
  MapPin:      <MapPin      className="h-6 w-6" />,
  Bell:        <Bell        className="h-6 w-6" />,
  Heart:       <Heart       className="h-6 w-6" />,
  Gift:        <Gift        className="h-6 w-6" />,
  Camera:      <Camera      className="h-6 w-6" />,
  Globe:       <Globe       className="h-6 w-6" />,
}

// Step number accent colors — cycles through if more than 4 steps
const STEP_COLORS = [
  { bg: "bg-primary/10",     text: "text-primary",     ring: "ring-primary/20" },
  { bg: "bg-accent/10",      text: "text-accent",       ring: "ring-accent/20" },
  { bg: "bg-amber-500/10",   text: "text-amber-600",    ring: "ring-amber-500/20" },
  { bg: "bg-emerald-500/10", text: "text-emerald-600",  ring: "ring-emerald-500/20" },
]

interface Step {
  icon: string
  title: string
  description: string
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const color  = STEP_COLORS[index % STEP_COLORS.length]
  const icon   = ICON_MAP[step.icon] ?? ICON_MAP.ShieldCheck
  const stepNo = index + 1

  return (
    <div className="relative flex flex-col items-center text-center px-2">
      {/* Step number badge */}
      <div className="relative mb-4">
        <div
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center
            ${color.bg} ${color.text}
            ring-2 ${color.ring}
          `}
        >
          {icon}
        </div>
        <span
          className="
            absolute -top-2 -right-2
            w-5 h-5 rounded-full text-[10px] font-extrabold
            flex items-center justify-center
            bg-secondary text-white
          "
        >
          {stepNo}
        </span>
      </div>

      <h3 className="text-sm font-bold text-secondary mb-1">{step.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[160px]">
        {step.description}
      </p>
    </div>
  )
}

// Connector arrow rendered between steps on desktop
function Arrow() {
  return (
    <div className="hidden md:flex items-center justify-center text-border mt-5 px-1">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary/30">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function HowItWorks() {
  const { settings } = usePlatformSettings()

  if (!settings.howItWorksEnabled) return null

  // Build the steps array from the flat admin-editable fields.
  // howItWorksStepCount (2–4) controls how many of these are shown.
  const allSteps: Step[] = [
    { icon: settings.howItWorksStep1Icon, title: settings.howItWorksStep1Title, description: settings.howItWorksStep1Desc },
    { icon: settings.howItWorksStep2Icon, title: settings.howItWorksStep2Title, description: settings.howItWorksStep2Desc },
    { icon: settings.howItWorksStep3Icon, title: settings.howItWorksStep3Title, description: settings.howItWorksStep3Desc },
    { icon: settings.howItWorksStep4Icon, title: settings.howItWorksStep4Title, description: settings.howItWorksStep4Desc },
  ]

  const stepCount = Math.min(4, Math.max(2, settings.howItWorksStepCount || 3))
  const steps = allSteps.slice(0, stepCount).filter(s => s.title)

  if (steps.length === 0) return null

  return (
    <section>
      {/* Section heading */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-secondary">
          {settings.howItWorksTitle || "How It Works"}
        </h2>
      </div>

      {/* Steps row — with arrows between them on desktop */}
      <div
        className="
          bg-card border border-border/60 rounded-2xl p-5 md:p-6
          grid gap-6
          md:flex md:items-start md:gap-0
        "
        style={{
          gridTemplateColumns: `repeat(${Math.min(steps.length, 2)}, 1fr)`,
        }}
      >
        {steps.map((step, i) => (
          <div key={i} className="md:flex-1 md:contents">
            <StepCard step={step} index={i} />
            {i < steps.length - 1 && <Arrow />}
          </div>
        ))}
      </div>
    </section>
  )
}
