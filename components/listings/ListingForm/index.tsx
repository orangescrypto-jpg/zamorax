"use client"

import { AdminService, limit, serverTimestamp } from "@/src/services"
import { getPlatformSettings } from "@/src/services/platformSettings"

import { useState, useCallback } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { listingSchema, type ListingFormValues } from "@/lib/validations/listing"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react"
import { generateSlug } from "@/lib/utils"

import { Step1Category }    from "./Step1Category"
import { Step2Details }     from "./Step2Details"
import { Step3Attributes }  from "./Step3Attributes"
import { Step4Media }       from "./Step4Media"
import { Step5Location }    from "./Step5Location"
import { Step5bShipment }   from "./Step5bShipment"
import { Step6Boost }       from "./Step6Boost"
import { Step7Review }      from "./Step7Review"

const steps = ["Category", "Details", "Attributes", "Media", "Location", "Delivery", "Boost", "Review"]

export function ListingForm() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    mode: "onChange",
    defaultValues: {
      listingType: "sale",
      condition: "brand_new",
      deliveryNationwide: false,
      weightKg: 0.5,
      isFragile: false,
      shippingMethods: ["meetup"],
      boostType: "none",
      acceptTerms: true,
    }
  })

  const categorySlug = form.watch("categorySlug")

  const handleNext = async () => {
    // Step 6 (1-indexed) = Step5bShipment. Auto-default meetup if empty before advancing.
    if (step === 6) {
      const current = form.getValues("shippingMethods") ?? []
      if (current.length === 0) {
        form.setValue("shippingMethods", ["meetup"], { shouldValidate: true })
      }
    }

    const fieldsToValidate: Record<number, string[]> = {
      1: ["categorySlug", "listingType"],
      2: ["title", "description", "condition", "priceSale"],
      3: [],                                          // Step3 validates internally
      4: ["images"],
      5: ["nigerianState", "city"],
      6: ["shippingMethods"],
      7: ["boostType"],
      8: ["acceptTerms"],
    }

    const isValid = await form.trigger(fieldsToValidate[step] as any)
    if (!isValid) return

    if (step < steps.length) setStep(step + 1)
  }

  const onSubmit = useCallback(async (data: ListingFormValues) => {
    if (!user?.uid) return
    setLoading(true)
    try {
      // Check plan limit
      const userDoc = await AdminService.getDoc("users", user.uid)
      const plan = userDoc?.plan || "free"
      const activeCount = userDoc?.activeListingCount || 0
      const platformSettings = await getPlatformSettings()
      const limits: Record<string, number> = {
        free:    platformSettings.planFreeListingLimit ?? 5,
        starter: platformSettings.planStarterListingLimit ?? 20,
        pro:     platformSettings.planProListingLimit > 0 ? platformSettings.planProListingLimit : 999,
      }
      if (activeCount >= limits[plan]) {
        toast({ title: "Limit Reached", description: `Upgrade to ${plan === "free" ? "Starter" : "Pro"} to post more.`, variant: "destructive" })
        return
      }

      const listingId = AdminService.generateId()
      const slug = generateSlug(data.title)

      // Convert prices to kobo
      const priceSaleKobo         = data.priceSale * 100
      const priceRentDailyKobo    = data.priceRentDaily    ? data.priceRentDaily    * 100 : undefined
      const priceRentWeeklyKobo   = data.priceRentWeekly   ? data.priceRentWeekly   * 100 : undefined
      const depositKobo           = data.depositAmount     ? data.depositAmount     * 100 : undefined

      // Ensure meetup is always present as fallback
      const shippingMethods = (data.shippingMethods && data.shippingMethods.length > 0)
        ? data.shippingMethods
        : ["meetup"]

      // stockQty: undefined/NaN → null (unlimited); otherwise integer
      const stockQty = (data.stockQty != null && !isNaN(data.stockQty))
        ? Math.max(0, Math.floor(data.stockQty))
        : null

      // Save to Firestore
      await AdminService.setDoc("listings", listingId, {
        id: listingId,
        sellerId: user.uid,
        category: data.categorySlug,
        title: data.title,
        slug,
        description: data.description,
        listingType: data.listingType,
        condition: data.condition,
        priceSale: priceSaleKobo,
        priceRentDaily:  priceRentDailyKobo,
        priceRentWeekly: priceRentWeeklyKobo,
        depositAmount:   depositKobo,
        images: data.images,
        verificationVideo: data.verificationVideo || null,
        attributes: data.attributes || {},
        nigerianState: data.nigerianState,
        city: data.city,
        deliveryNationwide: data.deliveryNationwide,
        weightKg:   data.weightKg   ?? 0.5,
        isFragile:  data.isFragile  ?? false,
        shippingMethods,
        stockQty,                                    // null = unlimited
        isActive: false, // Requires admin approval
        isBoosted: data.boostType !== "none",
        boostType: data.boostType === "none" ? null : data.boostType,
        status: "pending",
        views: 0, saves: 0, inquiries: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast({ title: "Listing Submitted!", description: "Pending admin approval. We'll notify you shortly.", variant: "success" })
      form.reset()
      setStep(1)
    } catch (error: any) {
      console.error("Submit error:", error)
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, form, toast])

  return (
    <FormProvider {...form}>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold">Post a New Listing</h1>
          <p className="text-muted-foreground">Follow the steps to list your item securely.</p>
        </div>

        <Progress value={(step / steps.length) * 100} className="mb-8" />

        <div className="space-y-8">
          {step === 1 && <Step1Category />}
          {step === 2 && <Step2Details />}
          {step === 3 && <Step3Attributes categorySlug={categorySlug} />}
          {step === 4 && <Step4Media />}
          {step === 5 && <Step5Location />}
          {step === 6 && <Step5bShipment />}
          {step === 7 && <Step6Boost />}
          {step === 8 && <Step7Review />}
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button variant="outline" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          
          {step < steps.length ? (
            <Button onClick={handleNext} disabled={loading}>
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={form.handleSubmit(onSubmit)} disabled={loading || !form.formState.isValid}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Publish Listing
            </Button>
          )}
        </div>
      </div>
    </FormProvider>
  )
}
