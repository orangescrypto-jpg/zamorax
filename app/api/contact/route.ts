// app/api/contact/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { AdminService } from "@/src/services/admin"

const CONTACT_INBOX = "Zamoraxapp@gmail.com"

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

    // FIX: this route previously only wrote to D1 — nothing was ever sent
    // to the support inbox, so submissions from /contact went unseen unless
    // an admin happened to check the messages table. Now it also emails
    // the inbox directly via Resend (independent of the admin email-config
    // toggles, since contact-form delivery shouldn't depend on that being
    // set up correctly).
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      try {
        const resend = new Resend(apiKey)
        await resend.emails.send({
          from:    "Zamorax Contact Form <onboarding@resend.dev>",
          to:      CONTACT_INBOX,
          replyTo: email.trim(),
          subject: `[Contact] ${subject.trim()}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#0f172a">New contact form submission</h2>
              <p><strong>From:</strong> ${name.trim()} (${email.trim()})</p>
              <p><strong>Type:</strong> ${type || "support"}</p>
              <p><strong>Subject:</strong> ${subject.trim()}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
              <p style="white-space:pre-wrap">${message.trim()}</p>
            </div>
          `,
        })
      } catch (emailErr) {
        // Don't fail the whole request if email fails — the message is
        // already saved in D1 and visible in /admin/messages either way.
        console.error("[contact] Resend send failed:", emailErr)
      }
    } else {
      console.error("[contact] RESEND_API_KEY not set — contact email not sent, only saved to D1")
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
