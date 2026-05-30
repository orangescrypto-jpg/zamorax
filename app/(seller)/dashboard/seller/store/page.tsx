"use client"

import {AdminService, serverTimestamp} from "@/src/services"
// app/(seller)/dashboard/seller/store/page.tsx

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Store, Camera, Loader2, CheckCircle, ExternalLink } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
]

const CATEGORIES = [
  "Electronics","Fashion","Home & Living","Phones & Tablets","Computers",
  "Vehicles","Agriculture","Health & Beauty","Sports","Books","Services","Other",
]

export default function StoreProfilePage() {
  const uid = useAuthStore(s => s.user?.uid)
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [form, setForm] = useState({
    storeName: "",
    storeDescription: "",
    storeCategory: "",
    storeState: "",
    storeCity: "",
    storeWhatsApp: "",
    storeInstagram: "",
    storeLogoUrl: "",
    storeBannerUrl: "",
  })

  useEffect(() => {
    if (!uid) return
    AdminService.getDoc("users", uid).then(docs => {
      if (docs) {
        const d = docs
        setForm({
          storeName: d.storeName || "",
          storeDescription: d.storeDescription || "",
          storeCategory: d.storeCategory || "",
          storeState: d.storeState || "",
          storeCity: d.storeCity || "",
          storeWhatsApp: d.storeWhatsApp || "",
          storeInstagram: d.storeInstagram || "",
          storeLogoUrl: d.storeLogoUrl || "",
          storeBannerUrl: d.storeBannerUrl || "",
        })
      }
      setLoading(false)
    })
  }, [uid])

  const set = (key: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") => {
    const file = e.target.files?.[0]
    if (!file || !uid) return
    setUploadingPhoto(true)
    try {
      const storageRef = ref(storage, `stores/${uid}/${type}_${Date.now()}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      if (type === "logo") set("storeLogoUrl", url)
      else set("storeBannerUrl", url)
      toast({ title: `${type === "logo" ? "Logo" : "Banner"} uploaded ✅`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" })
    } finally { setUploadingPhoto(false) }
  }

  const handleSave = async () => {
    if (!uid) return
    if (!form.storeName.trim()) {
      toast({ title: "Store name is required", variant: "destructive" }); return
    }
    setSaving(true)
    try {
      await AdminService.updateDoc("users", uid, {
        ...form,
        storeName: form.storeName.trim(),
        storeDescription: form.storeDescription.trim(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Store profile saved ✅", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="container max-w-2xl py-8 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Store className="h-6 w-6" /> Store Profile
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customise how buyers see your store.
          </p>
        </div>
        {uid && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/seller/${uid}`} target="_blank">
              <ExternalLink className="h-4 w-4 mr-1" /> Preview
            </Link>
          </Button>
        )}
      </div>

      {/* Banner */}
      <Card>
        <CardHeader><CardTitle className="text-base">Store Images</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Banner */}
          <div className="space-y-2">
            <Label>Store Banner</Label>
            <div className="relative w-full h-32 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/20">
              {form.storeBannerUrl
                ? <Image src={form.storeBannerUrl} alt="Banner" fill className="object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">No banner — add one to stand out</div>}
              <label className="absolute bottom-2 right-2 cursor-pointer bg-white/90 text-secondary px-2 py-1 rounded-lg text-xs flex items-center gap-1 hover:bg-white transition-colors">
                {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                Change
                <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, "banner")} />
              </label>
            </div>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-primary/10 shrink-0 border-2 border-muted">
              {form.storeLogoUrl
                ? <Image src={form.storeLogoUrl} alt="Logo" fill className="object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-primary">
                    {form.storeName?.[0]?.toUpperCase() || "?"}
                  </div>}
            </div>
            <div>
              <p className="text-sm font-medium">Store Logo</p>
              <p className="text-xs text-muted-foreground mb-2">Square image recommended (min 200×200px)</p>
              <label className="cursor-pointer inline-flex items-center gap-1 text-xs bg-muted px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors">
                {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, "logo")} />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Store Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Store Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. TechHub Lagos, Amaka Closet"
              value={form.storeName}
              onChange={e => set("storeName", e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Store Description</Label>
            <Textarea
              placeholder="Tell buyers what you sell, your speciality, how long you've been selling..."
              value={form.storeDescription}
              onChange={e => set("storeDescription", e.target.value)}
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">{form.storeDescription.length}/300</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Main Category</Label>
              <Select value={form.storeCategory} onValueChange={v => set("storeCategory", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select value={form.storeState} onValueChange={v => set("storeState", v)}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>{NIGERIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>City / Area</Label>
            <Input
              placeholder="e.g. Ikeja, Yaba, Lekki Phase 1"
              value={form.storeCity}
              onChange={e => set("storeCity", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader><CardTitle className="text-base">Social Links (Optional)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>WhatsApp Number</Label>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-lg text-sm text-muted-foreground">+234</span>
              <Input
                placeholder="08012345678"
                value={form.storeWhatsApp}
                onChange={e => set("storeWhatsApp", e.target.value.replace(/\D/g, "").slice(0, 11))}
                className="rounded-l-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">Shown as a WhatsApp chat button on your store page</p>
          </div>

          <div className="space-y-1.5">
            <Label>Instagram Handle</Label>
            <div className="flex items-center">
              <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-lg text-sm text-muted-foreground">@</span>
              <Input
                placeholder="yourstorename"
                value={form.storeInstagram}
                onChange={e => set("storeInstagram", e.target.value.replace(/^@/, ""))}
                className="rounded-l-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base"
        onClick={handleSave}
        disabled={saving || !form.storeName.trim()}
      >
        {saving
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          : <><CheckCircle className="h-4 w-4 mr-2" /> Save Store Profile</>}
      </Button>
    </div>
  )
}
