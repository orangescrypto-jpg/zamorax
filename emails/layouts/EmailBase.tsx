// emails/layouts/EmailBase.tsx
// Shared layout for all Zamorax transactional emails.
// Navy (#0A1628) & Gold (#D4A017) brand colors consistent with the platform.

import {
  Body, Container, Head, Html, Preview, Section,
  Text, Hr, Img, Row, Column,
} from "@react-email/components"
import { CSSProperties } from "react"

const NAVY = "#0A1628"
const GOLD  = "#D4A017"
const LIGHT = "#F5F7FA"

export const styles = {
  body: {
    backgroundColor: LIGHT,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
  } as CSSProperties,
  container: {
    maxWidth: "580px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  } as CSSProperties,
  header: {
    backgroundColor: NAVY,
    padding: "24px 32px",
    textAlign: "center" as const,
  } as CSSProperties,
  logoText: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "800",
    letterSpacing: "-0.5px",
    margin: 0,
  } as CSSProperties,
  logoDot: {
    color: GOLD,
  } as CSSProperties,
  tagline: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "11px",
    margin: "4px 0 0",
    letterSpacing: "0.5px",
  } as CSSProperties,
  heroStrip: {
    backgroundColor: GOLD,
    height: "4px",
  } as CSSProperties,
  body_content: {
    padding: "32px",
  } as CSSProperties,
  h1: {
    color: NAVY,
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 8px",
    lineHeight: "1.3",
  } as CSSProperties,
  subtitle: {
    color: "#6B7280",
    fontSize: "14px",
    margin: "0 0 24px",
    lineHeight: "1.5",
  } as CSSProperties,
  card: {
    backgroundColor: LIGHT,
    borderRadius: "8px",
    padding: "16px 20px",
    margin: "16px 0",
    border: "1px solid #E5E7EB",
  } as CSSProperties,
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    margin: "6px 0",
  } as CSSProperties,
  cardLabel: {
    color: "#6B7280",
    fontSize: "13px",
  } as CSSProperties,
  cardValue: {
    color: NAVY,
    fontSize: "13px",
    fontWeight: "600",
    textAlign: "right" as const,
  } as CSSProperties,
  divider: {
    borderColor: "#E5E7EB",
    margin: "20px 0",
  } as CSSProperties,
  ctaButton: {
    backgroundColor: GOLD,
    color: NAVY,
    padding: "13px 28px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "14px",
    textDecoration: "none",
    display: "inline-block",
    textAlign: "center" as const,
  } as CSSProperties,
  ctaButtonNavy: {
    backgroundColor: NAVY,
    color: "#ffffff",
    padding: "13px 28px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "14px",
    textDecoration: "none",
    display: "inline-block",
    textAlign: "center" as const,
  } as CSSProperties,
  footer: {
    backgroundColor: NAVY,
    padding: "20px 32px",
    textAlign: "center" as const,
  } as CSSProperties,
  footerText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "11px",
    margin: "4px 0",
    lineHeight: "1.6",
  } as CSSProperties,
  footerLink: {
    color: GOLD,
    textDecoration: "none",
    fontSize: "11px",
  } as CSSProperties,
  badge: (color: string, bg: string) => ({
    display: "inline-block",
    backgroundColor: bg,
    color,
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  }) as CSSProperties,
}

interface EmailBaseProps {
  preview: string
  children: React.ReactNode
}

export function EmailBase({ preview, children }: EmailBaseProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.logoText}>
              ZAMORAX<span style={styles.logoDot}>.</span>
            </Text>
            <Text style={styles.tagline}>SECURE MARKETPLACE · ESCROW PROTECTED</Text>
          </Section>

          {/* Gold strip */}
          <Section style={styles.heroStrip} />

          {/* Content */}
          {children}

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} Zamorax Technology Limited · Nigeria
            </Text>
            <Text style={styles.footerText}>
              <a href="https://zamorax.com/help" style={styles.footerLink}>Help Center</a>
              {" · "}
              <a href="https://zamorax.com/terms" style={styles.footerLink}>Terms</a>
              {" · "}
              <a href="https://zamorax.com/privacy" style={styles.footerLink}>Privacy</a>
            </Text>
            <Text style={styles.footerText}>
              You received this because you have an account on Zamorax.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
