import { NextRequest, NextResponse } from "next/server"
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

function getDb() {
  const app = !getApps().length ? initializeApp({ credential: cert({
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })}) : getApp()
  return getFirestore(app)
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message, type } = await req.json()
    if (!name || !email || !subject || !message)
      return NextResponse.json({ error: "All fields required" }, { status: 400 })
    await getDb().collection("contactMessages").add({
      name: name.trim(), email: email.trim().toLowerCase(),
      subject: subject.trim(), message: message.trim(),
      type: type || "support", status: "unread",
      createdAt: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
