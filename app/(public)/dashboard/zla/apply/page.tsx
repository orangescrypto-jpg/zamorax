"use client"

import {AdminService, where, query, serverTimestamp} from "@/src/services"
// app/(public)/dashboard/zla/apply/page.tsx
// NEW: ZLA application form — admin reviews and approves

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Package, MapPin, Clock, CheckCircle,
  Loader2, ArrowLeft, Phone, Store,
} from "lucide-react"
import Link from "next/link"

const NIGERIAN_STATES = [
  "Lagos","Abuja (FCT)","Rivers","Ogun","Oyo","Kano","Kaduna",
  "Anambra","Enugu","Delta","Edo","Imo","Abia","Kwara","Osun",
  "Ekiti","Ondo","Bayelsa","Cross River","Akwa Ibom","Kogi",
  "Niger","Plateau","Nasarawa","Benue","Taraba","Adamawa",
  "Borno","Yobe","Gombe","Bauchi","Sokoto","Zamfara","Kebbi","Jigawa","Katsina",
]

export default function ZLAApplicationPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState({
    storeName:      "",
    storeAddress:   "",
    state:          "",
    city:           "",
    lga:            "",
    phone:          "",
    operatingHours: "Mon–Sat 8am–6pm",
    storageCapacity: "20",
    about:          "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  const update = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async () => {
    if (!user?.uid) { router.push("/login"); return }
    if (!form.storeName || !form.storeAddress || !form.state || !form.phone) {
      toast({ title: "Please fill in all required fields", variant: "destructive" }); return
    }

    setSubmitting(true)
    try {
      // Check if already applied
      const existing = await AdminService.getCollection("zlaApplications", [where("userId", "==", user.uid),
        where("status", "in", ["pending", "approved"])])
      if (!existing.empty) {
        toast({ title: "You've already applied or are already a ZLA", variant: "destructive" })
        setSubmitting(false); return
      }

      await AdminService.addDoc("zlaApplications", {
        userId:           user.uid,
        userName:         user.fullName || user.email,
        userEmail:        user.email,
        storeName:        form.storeName.trim(),
        storeAddress:     form.storeAddress.trim(),
        state:            form.state,
        city:             form.city.trim(),
        lga:              form.lga.trim(),
        phone:            form.phone.trim(),
        operatingHours:   form.operatingHours,
        storageCapacity:  parseInt(form.storageCapacity) || 20,
        about:            form.about.trim(),
        status:           "pending",
        createdAt:        serverTimestamp(),
      })

      // Notify admins
      await AdminService.addDoc("notifications", {
        userId:    "admin",     // your admin notification system
        type:      "system",
        title:     "New ZLA Application",
        body:      `${user.fullName || user.email} applied to be a Zamorax Logistics Agent in ${form.state}`,
        link:      "/admin/logistics/applications",
        read:      false,
        createdAt: serverTimestamp(),
      })

      setSubmitted(true)
    } catch (e: any) {
      toast({ title: "Error submitting application", description: e.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  if (submitted) return (
    <div className="container max-w-md py-16 text-center space-y-5">
      <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <CheckCircle className="h-10 w-10 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-heading font-bold">Application Submitted!</h1>
      <p className="text-muted-foreground text-sm">
        Our team will review your application and contact you within 48 hours.
        Once approved, your ZLA dashboard will be activated automatically.
      </p>
      <Button asChild className="w-full bg-primary text-white">
        <Link href="/dashboard/agent">Back to Agent Dashboard</Link>
      </Button>
    </div>
  )

  return (
    <div className="container max-w-lg py-8 space-y-6 pb-24">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard/agent"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-1">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">Become a ZLA</h1>
        <p className="text-sm text-muted-foreground">
          Zamorax Logistics Agents earn per parcel they receive, store, and dispatch.
        </p>
      </div>

      {/* What you earn */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">💰 What you earn per parcel</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              { label: "Receive parcel", desc: "From seller" },
              { label: "Dispatch",       desc: "Send to next agent" },
              { label: "Final delivery", desc: "To buyer" },
            ].map(e => (
              <div key={e.label} className="bg-white rounded-lg p-2 border border-primary/10">
                <p className="font-semibold text-primary text-sm">₦200–₦500</p>
                <p className="font-medium mt-0.5">{e.label}</p>
                <p className="text-muted-foreground">{e.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Exact rates are set by Zamorax admin and may change. You'll always see current rates in your dashboard.
          </p>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">✅ Requirements</p>
          {[
            "Fixed physical address (shop, office, or home)",
            "Available during your stated operating hours",
            "Ability to store up to 20 parcels at a time",
            "Valid phone number for buyer/seller contact",
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Application form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Your Location Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Store / Location Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Bayo General Stores" value={form.storeName} onChange={update("storeName")} />
          </div>

          <div className="space-y-1.5">
            <Label>Full Address <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. 12 Allen Avenue, Ikeja" value={form.storeAddress} onChange={update("storeAddress")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State <span className="text-red-500">*</span></Label>
              <select
                value={form.state}
                onChange={update("state")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>City / Area</Label>
              <Input placeholder="e.g. Ikeja" value={form.city} onChange={update("city")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>LGA</Label>
            <Input placeholder="e.g. Ikeja LGA" value={form.lga} onChange={update("lga")} />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input placeholder="e.g. 08012345678" value={form.phone} onChange={update("phone")} type="tel" />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Operating Hours
            </Label>
            <Input placeholder="Mon–Sat 8am–6pm" value={form.operatingHours} onChange={update("operatingHours")} />
          </div>

          <div className="space-y-1.5">
            <Label>Max parcels you can store at once</Label>
            <Input type="number" min={5} max={200} value={form.storageCapacity} onChange={update("storageCapacity")} />
          </div>

          <div className="space-y-1.5">
            <Label>Anything else you'd like us to know (optional)</Label>
            <Textarea
              placeholder="Tell us about your location, security, accessibility..."
              value={form.about}
              onChange={update("about")}
              rows={3}
              maxLength={300}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full h-12 bg-primary text-white hover:bg-primary/90"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <Package className="h-4 w-4 mr-2" />
        }
        Submit Application
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By applying you agree to Zamorax Logistics Agent Terms of Service.
        Applications are reviewed within 48 hours.
      </p>
    </div>
  )
}
