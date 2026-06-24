// app/api/contact/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message, type } = await req.json()
    if (!name || !email || !subject || !message)
      return NextResponse.json({ error: "All fields required" }, { status: 400 })
    await AdminService.addDoc("contact_messages", {
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      type:    type || "support",
      status:  "unread",
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
