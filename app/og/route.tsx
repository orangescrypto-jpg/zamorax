import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get("title") || "Browse Listings on Zamorax"
  const price = searchParams.get("price") || ""
  const condition = searchParams.get("condition") || ""
  const location = searchParams.get("location") || "Nigeria"
  const image = searchParams.get("image") || ""

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          background: "#0a0a0a",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Product image background */}
        {image && (
          <img
            src={image}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }}
          />
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(10,10,10,0.95) 50%, rgba(249,115,22,0.15) 100%)", display: "flex" }} />

        {/* Content */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px", width: "100%" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "48px", height: "48px", background: "#f97316", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontWeight: "900", fontSize: "28px" }}>Z</span>
            </div>
            <span style={{ color: "white", fontWeight: "800", fontSize: "28px", letterSpacing: "-1px" }}>ZAMORAX</span>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "#f97316", fontSize: "18px", fontWeight: "600", margin: 0 }}>
              {condition || "For Sale"} · {location}
            </p>
            <h1 style={{ color: "white", fontSize: title.length > 40 ? "42px" : "56px", fontWeight: "900", margin: 0, lineHeight: 1.1, maxWidth: "800px" }}>
              {title}
            </h1>
            {price && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "#f97316", fontSize: "48px", fontWeight: "900" }}>{price}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "100px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#f97316", fontSize: "14px" }}>🛡️</span>
              <span style={{ color: "white", fontSize: "14px", fontWeight: "600" }}>Escrow Protected · Safe Trading in Nigeria</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
