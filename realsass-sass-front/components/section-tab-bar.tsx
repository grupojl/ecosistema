"use client"

/**
 * Barra inferior de la landing (solo compact) — patrón `bn-item` de welver.html: ícono sobre etiqueta, marca superior
 * en el destino activo, 56 px de alto y zona segura. Máximo 5 destinos. El activo sigue al scroll.
 */
import { useEffect, useState } from "react"
import { House, Sparkles, Tag, MessageSquareQuote, Mail, type LucideIcon } from "lucide-react"
import { BottomTabBar } from "@real/ui"
import { SECTION_LINKS } from "@/components/section-links"

const ICONS: Record<(typeof SECTION_LINKS)[number]["id"], LucideIcon> = {
  top: House, features: Sparkles, pricing: Tag, reviews: MessageSquareQuote, contact: Mail,
}

export function SectionTabBar() {
  const [active, setActive] = useState<string>("top")

  useEffect(() => {
    const targets = SECTION_LINKS.map((l) => document.getElementById(l.id)).filter((el): el is HTMLElement => !!el)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    )
    targets.forEach((t) => observer.observe(t))
    const onTop = () => { if (window.scrollY < 120) setActive("top") }
    window.addEventListener("scroll", onTop, { passive: true })
    return () => { observer.disconnect(); window.removeEventListener("scroll", onTop) }
  }, [])

  return (
    <BottomTabBar
      activeId={active}
      items={SECTION_LINKS.map((l) => ({ id: l.id, label: l.label, href: l.id === "top" ? "#" : `#${l.id}`, icon: ICONS[l.id] }))}
    />
  )
}
