"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Pencil, Check, X } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"

export function EditPhoneField() {
  const { user } = useAuth()
  const setUser = useAuthStore(s => s.setUser)
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(user?.phone ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const phone = value.trim()
    if (phone.length < 10) {
      toast({ title: "Enter a valid phone number (e.g., 08012345678)", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/update-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error || "Could not update phone number", variant: "destructive" })
        return
      }
      if (user) setUser({ ...user, phone })
      setEditing(false)
      toast({ title: "Phone number updated" })
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Phone number</Label>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="08012345678"
            className="flex-1"
          />
          <Button size="icon" variant="outline" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { setEditing(false); setValue(user?.phone ?? "") }} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Input value={user?.phone ?? "Not set"} disabled className="bg-muted" />
          <Button size="icon" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
