"use client"
import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: "light" as const, icon: Sun },
    { value: "system" as const, icon: Monitor },
    { value: "dark" as const, icon: Moon },
  ]
  return (
    <div className={cn("flex items-center bg-muted rounded-full p-0.5 gap-0.5", className)}>
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "p-1.5 rounded-full transition-all",
            theme === value ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={value}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
