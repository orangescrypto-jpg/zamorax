import { z } from "zod"

export const listingSchema = z.object({
  // Step 1
  categorySlug: z.string().min(1, "Select a category"),
  listingType: z.enum(["sale", "rent", "both"]),
  
  // Step 2
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  description: z.string().min(20, "Add more details (min 20 chars)").max(2000),
  condition: z.enum(["brand_new", "open_box", "grade_a", "grade_b"]),
  priceSale: z.number().positive("Price must be greater than 0"),
  priceRentDaily: z.number().positive().optional(),
  priceRentWeekly: z.number().positive().optional(),
  depositAmount: z.number().nonnegative().optional(),

  // Step 3: Attributes (dynamic, validated per category later)
  attributes: z.record(z.any()).optional(),

  // Step 4: Media
  images: z.array(z.string()).min(1, "Upload at least 1 photo").max(10),
  verificationVideo: z.string().optional(),

  // Step 5: Location
  nigerianState: z.string().min(1, "Select state"),
  city: z.string().min(2, "Enter city"),
  deliveryNationwide: z.boolean(),
  
  // Step 6: Boost
  boostType: z.enum(["none", "standard", "premium", "category_top"]).default("none"),

  // Step 7: Rules
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the listing rules" }) })
})

export type ListingFormValues = z.infer<typeof listingSchema>
