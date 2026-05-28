import { NextRequest, NextResponse } from "next/server"

// Server-side watermark using Canvas API (edge-compatible via @vercel/og)
// Adds "zamorax.com" text watermark to uploaded listing images

export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: "No image URL" }, { status: 400 })

    // Return watermarked image URL using OG image generation approach
    // The actual watermark is applied via CSS overlay on the frontend
    // For server-side processing, use Cloudinary transformation if available
    const cloudinaryCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

    if (cloudinaryCloud && imageUrl.includes("cloudinary")) {
      // Apply Cloudinary text overlay transformation
      const watermarked = imageUrl.replace(
        "/upload/",
        "/upload/l_text:Arial_24_bold:zamorax.com,co_white,o_60,g_south_east,x_10,y_10/"
      )
      return NextResponse.json({ url: watermarked, method: "cloudinary" })
    }

    // Fallback: return original URL (watermark applied via CSS on frontend)
    return NextResponse.json({ url: imageUrl, method: "css-overlay" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
