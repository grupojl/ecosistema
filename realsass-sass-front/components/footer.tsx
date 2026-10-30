import { SiteFooter, type FooterColumn } from "@real/ui"

const link = (label: string) => ({ label, href: "#" })

const COLUMNS: readonly FooterColumn[] = [
  { title: "Product", links: ["Features", "Pricing", "Integrations", "API Docs", "Changelog"].map(link) },
  { title: "Company", links: ["About Us", "Careers", "Press", "Blog", "Contact"].map(link) },
  { title: "Legal",   links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"].map(link) },
]

export function Footer() {
  return (
    <SiteFooter
      id="contact"
      brand="Propiedad"
      tagline="The all-in-one platform for modern real estate agencies. Manage, automate, and grow."
      columns={COLUMNS}
      legal="2026 Propiedad. All rights reserved."
    />
  )
}
