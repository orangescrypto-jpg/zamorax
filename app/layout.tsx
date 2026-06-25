// app/layout.tsx
import type { Metadata } from "next"
import { AnnouncementBar } from "@/components/shared/AnnouncementBar"
import PWARegistrar from "@/components/shared/PWARegistrar"
import ChatbotWidget from "@/components/shared/ChatbotWidget"
import InstallBanner from "@/components/shared/InstallBanner"
import PushNotificationPrompt from "@/components/shared/PushNotificationPrompt"
import { WhatsAppSupport } from "@/components/shared/WhatsAppSupport"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

const BASE_URL = "https://zamorax.com"

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  "Zamorax — Buy, Sell & Rent Across Nigeria",
    template: "%s | Zamorax",
  },
  description:
    "Nigeria's safest marketplace. Buy, sell and rent phones, laptops, fashion, cars & more. Verified sellers, escrow-protected payments, and nationwide delivery.",
  keywords: [
    "buy and sell Nigeria",
    "Nigerian marketplace",
    "sell phone Nigeria",
    "buy laptop Nigeria",
    "Zamorax",
    "escrow Nigeria",
    "verified sellers Nigeria",
    "rent Nigeria",
    "online marketplace Nigeria",
  ],
  authors:   [{ name: "Zamorax", url: BASE_URL }],
  creator:   "Zamorax",
  publisher: "Zamorax",
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type:      "website",
    locale:    "en_NG",
    url:       BASE_URL,
    siteName:  "Zamorax",
    title:     "Zamorax — Buy, Sell & Rent Across Nigeria",
    description:
      "Nigeria's safest marketplace. Verified sellers, escrow payments, nationwide delivery.",
    images: [{
      url:    `${BASE_URL}/og-default.jpg`,
      width:  1200,
      height: 630,
      alt:    "Zamorax Marketplace",
    }],
  },
  twitter: {
    card:        "summary_large_image",
    site:        "@zamoraxng",
    creator:     "@zamoraxng",
    title:       "Zamorax — Buy, Sell & Rent Across Nigeria",
    description: "Nigeria's safest marketplace. Verified sellers, escrow payments.",
    images:      [`${BASE_URL}/og-default.jpg`],
  },
  alternates: { canonical: BASE_URL },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.svg",
  },
  verification: {
    // Add your Google Search Console verification code here when you have it
    // google: "your-google-verification-code",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Zamorax" />
      </head>
      <body className={inter.className}>
        <Providers>
          <AnnouncementBar />
          {children}
        </Providers>
        <PWARegistrar />
        <ChatbotWidget />
        <InstallBanner />
        <PushNotificationPrompt />
        <WhatsAppSupport />
      </body>
    </html>
  )
}
