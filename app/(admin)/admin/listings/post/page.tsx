"use client"

import { AdminService , serverTimestamp } from "@/src/services"

import { useState, useCallback } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { listingSchema, type ListingFormValues } from "@/lib/validations/listing"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react"
import { generateSlug } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

import { Step1Category } from "@/components/listings/ListingForm/Step1Category"
import { Step2Details } from "@/components/listings/ListingForm/Step2Details"
import { Step3Attributes } from "@/components/listings/ListingForm/Step3Attributes"
import { Step4Media } from "@/components/listings/ListingForm/Step4Media"
import { Step5Location } from "@/components/listings/ListingForm/Step5Location"
import { Step7Review } from "@/components/listings/ListingForm/Step7Review"
import { setDoc } from "@/src/services"

const steps = ["Category", "Details", "Attributes", "Media", "Location", "Review"]

export default function AdminPostListingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [isFeatured, setIsFeatured] = useState(false)
  const [boostType, setBoostType] = useState<"none" | "standard" | "premium" | "category_top">("none")
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    mode: "onChange",
    defaultValues: {
      listingType: "sale",
      condition: "brand_new",
      deliveryNationwide: false,
      boostType: "none",
      acceptTerms: true,
    }
  })

  const categorySlug = form.watch("categorySlug")

  const handleNext = async () => {
    const fieldsToValidate = [
      ["categorySlug", "listingType"],
      ["title", "description", "condition", "priceSale"],
      [],
      ["images"],
      ["nigerianState", "city"],
      ["acceptTerms"]
    ]
    const isValid = await form.trigger(fieldsToValidate[step - 1] as any)
    if (!isValid) return
    if (step < steps.length) setStep(step + 1)
  }

  const onSubmit = useCallback(async (data: ListingFormValues) => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const listingId = AdminService.generateId()
      const slug = generateSlug(data.title)

      await AdminService.setDoc("listings", listingId, {
        id: listingId,
        sellerId: user.uid,
        sellerName: user.fullName || "Zamorax Admin",
        sellerVerified: true,
        categorySlug: data.categorySlug,
        title: data.title,
        slug,
        description: data.description,
        listingType: data.listingType,
        condition: data.condition,
        priceSale: data.priceSale * 100,
        priceRentDaily: data.priceRentDaily ? data.priceRentDaily * 100 : null,
        priceRentWeekly: data.priceRentWeekly ? data.priceRentWeekly * 100 : null,
        depositAmount: data.depositAmount ? data.depositAmount * 100 : null,
        images: data.images,
        verificationVideo: data.verificationVideo || null,
        attributes: data.attributes || {},
        nigerianState: data.nigerianState,
        city: data.city,
        deliveryNationwide: data.deliveryNationwide,
        // Admin listings: auto-approved, no pending
        isActive: true,
        status: "active",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        // Featured/Boost — free for admin
        isFeatured,
        isBoosted: boostType !== "none",
        boostType: boostType === "none" ? null : boostType,
        boostExpiresAt: boostType !== "none"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : null,
        views: 0, saves: 0, inquiries: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast({ title: "Listing Published!", description: "Listing is live immediately.", variant: "success" })
      router.push("/admin/listings")
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, isFeatured, boostType, router, toast])

  return (
    <FormProvider {...form}>
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Admin: Post Listing</h1>
            <p className="text-muted-foreground text-sm">Auto-approved. Boost is free for admin.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/listings")}>
            ← Back
          </Button>
        </div>

        <Progress value={(step / steps.length) * 100} className="mb-6" />

        <div className="space-y-8">
          {step === 1 && <Step1Category />}
          {step === 2 && <Step2Details />}
          {step === 3 && <Step3Attributes categorySlug={categorySlug} />}
          {step === 4 && <Step4Media />}
          {step === 5 && <Step5Location />}
          {step === 6 && (
            <div className="space-y-6">
              <Step7Review />

              {/* Admin-only: Featured + Boost controls */}
              <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
                <p className="font-semibold text-sm">Admin Boost Options (Free)</p>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Featured Listing</Label>
                    <p className="text-xs text-muted-foreground">Appears in "Featured" section on homepage</p>
                  </div>
                  <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
                </div>

                <div className="space-y-2">
                  <Label className="font-medium">Boost Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["none", "standard", "premium", "category_top"] as const).map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBoostType(b)}
                        className={`p-3 rounded-lg border text-sm font-medium transition ${
                          boostType === b
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {b === "none" ? "No Boost" : b === "category_top" ? "Category Top" : b.charAt(0).toUpperCase() + b.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          {step < steps.length ? (
            <Button onClick={handleNext}>
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={loading} className="bg-primary">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Publish Now
            </Button>
          )}
        </div>
      </div>
    </FormProvider>
  )
}
