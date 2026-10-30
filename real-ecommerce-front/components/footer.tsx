import Link from "next/link"
import { SiteFooter, type FooterColumn } from "@real/ui"

const COLUMNS: readonly FooterColumn[] = [
  { title: "Shop", links: [
    { label: "Computación", href: "/categoria/computacion" },
    { label: "Audio", href: "/categoria/audio" },
    { label: "Tablets", href: "/categoria/tablets" },
    { label: "Wearables", href: "/categoria/wearables" },
  ] },
  { title: "Account", links: [
    { label: "Sign In", href: "#" },
    { label: "Orders", href: "/tracking" },
    { label: "Returns", href: "#" },
  ] },
  { title: "Support", links: [
    { label: "Contact", href: "#" },
    { label: "Help", href: "#" },
    { label: "Accessibility", href: "#" },
  ] },
  { title: "Company", links: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Careers", href: "#" },
  ] },
]

export default function Footer() {
  return (
    <SiteFooter brand="Nimbus Store" columns={COLUMNS} legal="© 2025 Nimbus Store. Todos los derechos reservados." linkAs={Link} />
  )
}
