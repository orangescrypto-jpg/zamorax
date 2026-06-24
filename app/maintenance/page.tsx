// app/maintenance/page.tsx
import { getPlatformSettings } from "@/src/services/platformSettings"
import { Wrench } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function MaintenancePage() {
  const settings = await getPlatformSettings()

  const message =
    settings.maintenanceMessage ||
    "We're currently performing scheduled maintenance. We'll be back shortly — thank you for your patience."

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Wrench className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-secondary">Under Maintenance</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Need urgent help?{" "}
          <a href={`mailto:${settings.contactEmail}`} className="text-primary underline">
            {settings.contactEmail}
          </a>
        </p>
      </div>
    </div>
  )
}
