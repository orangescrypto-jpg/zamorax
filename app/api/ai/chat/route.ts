import { NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `You are Zamorax AI, an intelligent assistant for Zamorax — Nigeria's safest buy, sell and rent marketplace.

You help users with:
- Finding products: phones, laptops, fashion, cars, electronics, and more across Nigeria
- Understanding escrow: how payments are protected, how the escrow process works
- Seller verification: BVN, NIN, and document verification steps
- Listing guidance: how to create, boost, and manage listings
- Orders & rentals: tracking orders, return process, rental agreements
- Logistics: Zamorax Logistics Agent (ZLA), FBZ warehouses, delivery options
- Platform features: subscriptions, bundles, group buy, flash deals, messaging

Guidelines:
- Be helpful, concise, and friendly
- Use Nigerian context (₦ for currency, Nigerian states)
- If asked about a specific listing, use the context provided
- Don't make up listing details — guide users to browse on the platform
- Keep responses under 150 words unless a detailed explanation is needed
- Format with **bold** for key terms when helpful`

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      reply: "AI assistant is not configured yet. Contact support or browse listings directly."
    }, { status: 200 })
  }

  try {
    const { message, context, history = [] } = await req.json()

    const messages = [
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: context ? `[Context: ${context}]\n\n${message}` : message,
      },
    ]

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)

    const data = await response.json()
    const reply = data.content?.[0]?.text ?? "I couldn't generate a response. Please try again."
    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json(
      { reply: "Sorry, I'm having trouble right now. Please try again in a moment." },
      { status: 200 }
    )
  }
}
