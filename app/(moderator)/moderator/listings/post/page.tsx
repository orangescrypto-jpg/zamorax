"use client"

import { AdminService } from "@/src/services"
import { adminFetch } from "@/lib/admin-fetch"

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

import { Step1Category } from "@/components/listings/ListingForm/Step1Category"
import { Step2Details } from "@/components/listings/ListingForm/Step2Details"
import { Step3Attributes } from "@/components/listings/ListingForm/Step3Attributes"
import { Step4Media } from "@/components/listings/ListingForm/Step4Media"
import { Step5Location } from "@/components/listings/ListingForm/Step5Location"
import { Step7Review } from "@/components/listings/ListingForm/Step7Review"

const steps = ["Category", "Details", "Attributes", "Media", "Location", "Review"]

// Moderators can post listings directly (auto-approved, same as admin) but
// don't get the free featured/boost perks — those stay admin-only.
export default function ModeratorPostListingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
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

      const res = await adminFetch("/api/admin/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: listingId,
          sellerId: user.uid,
          sellerName: user.fullName || "Zamorax Moderator",
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
          isFeatured: false,
          isBoosted: false,
          boostType: null,
          boostExpiresAt: null,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as any).error ?? `Server error ${res.status}`)
      }

      toast({ title: "Listing Published!", description: "Listing is live immediately.", variant: "success" })
      router.push("/moderator/listings")
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, router, toast])

  return (
    <FormProvider {...form}>
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Post Listing</h1>
            <p className="text-muted-foreground text-sm">Auto-approved. Publishes immediately.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/moderator/listings")}>
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
          {step === 6 && <Step7Review />}
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
