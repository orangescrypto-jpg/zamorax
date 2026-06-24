import { z } from "zod"

const baseFields = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Enter a valid phone number (e.g., 08012345678)"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
})

export const buyerRegisterSchema = baseFields.refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match", path: ["confirmPassword"] }
)

export const sellerRegisterSchema = baseFields.extend({
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  storeDescription: z.string().min(10, "Tell buyers a bit more about your store"),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords do not match", path: ["confirmPassword"] }
)

export const registerSchema = buyerRegisterSchema

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const sellerUpgradeSchema = z.object({
  nin: z.string().length(11, "NIN must be 11 digits"),
  bvn: z.string().length(11, "BVN must be 11 digits").optional(),
  selectedPlan: z.enum(["free", "starter", "pro"]),
})

export type BuyerRegisterSchema = z.infer<typeof buyerRegisterSchema>
export type SellerRegisterSchema = z.infer<typeof sellerRegisterSchema>
export type RegisterSchema = z.infer<typeof registerSchema>
export type LoginSchema = z.infer<typeof loginSchema>
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>
export type SellerUpgradeSchema = z.infer<typeof sellerUpgradeSchema>
