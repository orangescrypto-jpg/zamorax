"use client"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"

function ToastIcon({ variant }: { variant?: string | null }) {
  if (variant === "success")     return <CheckCircle2  className="h-5 w-5 text-white shrink-0 mt-0.5" />
  if (variant === "destructive") return <AlertCircle   className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
  if (variant === "warning")     return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
  return <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <ToastIcon variant={variant ?? undefined} />
            <div className="grid gap-0.5 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
