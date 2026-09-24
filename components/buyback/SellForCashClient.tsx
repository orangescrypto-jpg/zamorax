"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/useAuth"
import { saveDraft } from "@/lib/formDraft"
import { Loader2, Upload, X, Phone, MapPin, Star, ShieldCheck, Banknote } from "lucide-react"
import { WhatsAppSupport } from "@/components/shared/WhatsAppSupport"

const CATEGORY_LABELS: Record<string, string> = {
  "phones-tablets": "Phones & Tablets",
  "computing": "Computers",
  "electronics": "Electronics",
}
const CATEGORIES = Object.keys(CATEGORY_LABELS)

const CONDITION_LABELS: Record<string, string> = {
  flawless: "Flawless",
  good: "Good",
  fair: "Fair",
  cracked: "Cracked/Damaged",
  not_working: "Not Working",
}

interface Warehouse {
  id: string
  name: string
  address: string
  state: string
  city: string
}

type Step = "form" | "price" | "fulfillment" | "contact" | "done"

export function SellForCashClient() {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep] = useState<Step>("form")

  const [category, setCategory] = useState("")
  const [brands, setBrands] = useState<string[]>([])
  const [brand, setBrand] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState("")
  const [storageVariants, setStorageVariants] = useState<string[]>([])
  const [storageVariant, setStorageVariant] = useState("")
  const [conditions, setConditions] = useState<Array<{ price: number; condition: string }>>([])
  const [condition, setCondition] = useState("")
  const [price, setPrice] = useState<number | null>(null)
  const [priceUnavailable, setPriceUnavailable] = useState(false)

  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [knownIssues, setKnownIssues] = useState("")

  const [fulfillmentMethod, setFulfillmentMethod] = useState<"dropoff" | "meetup">("dropoff")
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState("")
  const [meetupAddress, setMeetupAddress] = useState("")

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  const [submitting, setSubmitting] = useState(false)

  const [reviews, setReviews] = useState<Array<{ id: string; reviewer_name: string; rating: number; comment: string }>>([])
  const [reviewName, setReviewName] = useState("")
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState("")
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    if (!category) { setBrands([]); return }
    fetch(`/api/buyback/pricing?category=${encodeURIComponent(category)}`)
      .then(r => r.json())
      .then(d => setBrands(d.brands ?? []))
  }, [category])

  useEffect(() => {
    if (!category || !brand) { setModels([]); return }
    fetch(`/api/buyback/pricing?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}`)
      .then(r => r.json())
      .then(d => setModels(d.models ?? []))
  }, [category, brand])

  useEffect(() => {
    if (!category || !brand || !model) { setStorageVariants([]); return }
    fetch(`/api/buyback/pricing?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`)
      .then(r => r.json())
      .then(d => setStorageVariants((d.storageVariants ?? []).filter(Boolean)))
  }, [category, brand, model])

  const fetchConditions = useCallback(() => {
    if (!category || !brand || !model) return
    const qs = new URLSearchParams({ category, brand, model })
    if (storageVariant) qs.set("storage", storageVariant)
    fetch(`/api/buyback/pricing?${qs.toString()}`)
      .then(r => r.json())
      .then(d => { if (d.conditions) setConditions(d.conditions) })
  }, [category, brand, model, storageVariant])

  useEffect(() => { fetchConditions() }, [fetchConditions])

  useEffect(() => {
    if (!condition) { setPrice(null); return }
    setPriceUnavailable(false)
    const qs = new URLSearchParams({ category, brand, model, condition })
    if (storageVariant) qs.set("storage", storageVariant)
    fetch(`/api/buyback/pricing?${qs.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (d.price != null) { setPrice(d.price); setStep("price") }
        else setPriceUnavailable(true)
      })
  }, [condition])

  const loadReviews = useCallback(() => {
    fetch("/api/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: "SELECT id, reviewer_name, rating, comment FROM buyback_reviews WHERE status = 'published' ORDER BY created_at DESC LIMIT 20",
        params: [],
      }),
    })
      .then(r => r.json())
      .then(d => setReviews(d.results ?? []))
      .catch(() => {})
  }, [])
  useEffect(() => { loadReviews() }, [loadReviews])

  const submitReview = async () => {
    if (!reviewName.trim() || !reviewComment.trim()) {
      toast({ title: "Add your name and a comment", variant: "destructive" })
      return
    }
    setSubmittingReview(true)
    try {
      await fetch("/api/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "INSERT INTO buyback_reviews (id, reviewer_name, rating, comment, status, created_at) VALUES (?, ?, ?, ?, 'published', datetime('now'))",
          params: [crypto.randomUUID(), reviewName.trim(), reviewRating, reviewComment.trim()],
        }),
      })
      setReviewName(""); setReviewComment(""); setReviewRating(5)
      toast({ title: "Thanks for your feedback" })
      loadReviews()
    } catch {
      toast({ title: "Could not submit feedback", variant: "destructive" })
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/buyback/upload", { method: "POST", body: fd })
        const json = await res.json()
        if (res.ok && json.url) setImages(prev => [...prev, json.url])
      }
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" })
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  useEffect(() => {
    if (step !== "fulfillment" || fulfillmentMethod !== "dropoff" || warehouses.length > 0) return
    fetch("/api/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: "SELECT id, name, address, state, city FROM fbz_warehouses WHERE is_active = 1 ORDER BY name",
        params: [],
      }),
    })
      .then(r => r.json())
      .then(d => setWarehouses(d.results ?? []))
      .catch(() => {})
  }, [step, fulfillmentMethod, warehouses.length])

  const goListItMyself = () => {
    const attributes: Record<string, string> = {}
    if (brand) attributes.brand = brand
    if (model) attributes.model = model
    if (storageVariant) attributes.storage = storageVariant

    const draftValues = {
      categorySlug: category,
      condition,
      brand,
      title: [brand, model, storageVariant].filter(Boolean).join(" "),
      attributes,
      images,
      knownIssues,
    }

    if (user?.uid) {
      saveDraft(`listing_form_${user.uid}`, { values: draftValues, step: 1 })
      router.push("/dashboard/seller/post")
    } else {
      try {
        window.localStorage.setItem(
          "zamorax_pending_listing_draft",
          JSON.stringify({ values: draftValues, step: 1 }),
        )
      } catch { /* storage unavailable — fine, they just re-enter */ }
      router.push(`/register?next=${encodeURIComponent("/dashboard/seller/post")}`)
    }
  }

  useEffect(() => {
    if (!user?.uid) return
    try {
      const pending = window.localStorage.getItem("zamorax_pending_listing_draft")
      if (pending) {
        saveDraft(`listing_form_${user.uid}`, JSON.parse(pending))
        window.localStorage.removeItem("zamorax_pending_listing_draft")
      }
    } catch { /* ignore */ }
  }, [user?.uid])

  const submit = async () => {
    if (!contactEmail.trim() || !contactPhone.trim()) {
      toast({ title: "Enter your contact email and phone", variant: "destructive" })
      return
    }
    if (fulfillmentMethod === "dropoff" && !warehouseId) {
      toast({ title: "Select a warehouse to drop off at", variant: "destructive" })
      return
    }
    if (fulfillmentMethod === "meetup" && !meetupAddress.trim()) {
      toast({ title: "Enter where you would like to meet", variant: "destructive" })
      return
    }
    if (images.length === 0) {
      toast({ title: "Upload at least one photo of the device", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/buyback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: category, brand, model, storageVariant, condition,
          estimatedPrice: price, images, knownIssues,
          fulfillmentMethod, warehouseId, meetupAddress,
          contactName, contactEmail, contactPhone,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error || "Could not submit", variant: "destructive" })
        return
      }
      setStep("done")
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-heading font-bold text-secondary">Sell for Cash</h1>
        <p className="text-muted-foreground">
          Tell us about your device and get an instant estimate. No haggling, no waiting for a buyer.
        </p>
      </div>

      {step !== "done" && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); setBrand(""); setModel(""); setStorageVariant(""); setCondition(""); setPrice(null) }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={brand} onValueChange={(v) => { setBrand(v); setModel(""); setStorageVariant(""); setCondition(""); setPrice(null) }} disabled={!category || brands.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={(v) => { setModel(v); setStorageVariant(""); setCondition(""); setPrice(null) }} disabled={!brand || models.length === 0}>
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {storageVariants.length > 0 && (
                <div className="space-y-2">
                  <Label>Storage</Label>
                  <Select value={storageVariant} onValueChange={(v) => { setStorageVariant(v); setCondition(""); setPrice(null) }}>
                    <SelectTrigger><SelectValue placeholder="Select storage" /></SelectTrigger>
                    <SelectContent>
                      {storageVariants.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {model && conditions.length > 0 && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Condition</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                    <SelectContent>
                      {conditions.map(c => (
                        <SelectItem key={c.condition} value={c.condition}>
                          {CONDITION_LABELS[c.condition] || c.condition}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {priceUnavailable && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-800">
                We do not have an instant price for this device yet. Chat with us on WhatsApp and we will get back to you.
              </div>
            )}

            {price != null && step !== "form" && (
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-1">
                <p className="text-sm text-muted-foreground">Estimated offer</p>
                <p className="text-3xl font-bold text-primary">₦{price.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Subject to physical inspection</p>
              </div>
            )}

            {step === "price" && price != null && (
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <Button onClick={() => setStep("fulfillment")} className="bg-primary hover:bg-primary/90">
                  <Banknote className="h-4 w-4 mr-2" /> Sell to Zamorax Direct
                </Button>
                <Button variant="outline" onClick={goListItMyself}>
                  List It Myself Instead
                </Button>
              </div>
            )}

            {step === "fulfillment" && (
              <div className="space-y-5 pt-2 border-t mt-2">
                <div className="space-y-2">
                  <Label>Photos of the device</Label>
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <div key={img} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer text-muted-foreground hover:border-primary">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Known issues (optional)</Label>
                  <Textarea
                    value={knownIssues}
                    onChange={(e) => setKnownIssues(e.target.value)}
                    placeholder="e.g., screen has a small crack, battery drains fast"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>How would you like to hand over the device?</Label>
                  <RadioGroup value={fulfillmentMethod} onValueChange={(v) => setFulfillmentMethod(v as "dropoff" | "meetup")}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="dropoff" id="dropoff" />
                      <Label htmlFor="dropoff" className="font-normal">Drop it off at a Zamorax warehouse</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="meetup" id="meetup" />
                      <Label htmlFor="meetup" className="font-normal">Meet me at my chosen location</Label>
                    </div>
                  </RadioGroup>
                </div>

                {fulfillmentMethod === "dropoff" && (
                  <div className="space-y-2">
                    <Label>Warehouse</Label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                      <SelectTrigger><SelectValue placeholder="Select a warehouse" /></SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} — {w.city}, {w.state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {fulfillmentMethod === "meetup" && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Where would you like to meet?</Label>
                    <Textarea
                      value={meetupAddress}
                      onChange={(e) => setMeetupAddress(e.target.value)}
                      placeholder="e.g., by the Shoprite entrance, Ikeja City Mall"
                      rows={2}
                    />
                  </div>
                )}

                <Button className="w-full" onClick={() => setStep("contact")}>Continue</Button>
              </div>
            )}

            {step === "contact" && (
              <div className="space-y-4 pt-2 border-t mt-2">
                <div className="space-y-2">
                  <Label>Your name</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                  <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="080XXXXXXXX" />
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Submit for Inspection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Request submitted</h2>
            <p className="text-muted-foreground">
              We will contact you to confirm inspection details. Payment happens once your device is inspected.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 pt-6 border-t">
        <h2 className="text-xl font-semibold">Reviews</h2>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input value={reviewName} onChange={(e) => setReviewName(e.target.value)} placeholder="Your name" />
              <Select value={String(reviewRating)} onValueChange={(v) => setReviewRating(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map(n => <SelectItem key={n} value={String(n)}>{n} star{n > 1 ? "s" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Share your experience" rows={2} />
            <Button size="sm" onClick={submitReview} disabled={submittingReview}>
              {submittingReview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Post Feedback
            </Button>
          </CardContent>
        </Card>

        {reviews.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{r.reviewer_name}</span>
                <span className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{r.comment}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <WhatsAppSupport message="Hi, I have a device I'd like to sell but couldn't get an instant price on the Sell for Cash page." />
    </main>
  )
}
