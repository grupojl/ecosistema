"use client"

import { motion } from "framer-motion"
import { LayoutGrid, BarChart3, Zap, Shield, Bell, Repeat } from "lucide-react"

const features = [
  {
    icon: LayoutGrid,
    title: "Listing Management",
    description:
      "Create, edit, and publish listings in seconds. Multi-portal syndication keeps your properties visible everywhere.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Real-time dashboards track views, leads, and conversions so you know exactly what performs.",
  },
  {
    icon: Zap,
    title: "Workflow Automation",
    description:
      "Automate follow-ups, scheduling, and document generation. Close deals without the busywork.",
  },
  {
    icon: Shield,
    title: "Secure Client Portal",
    description:
      "Give buyers and tenants a branded portal for documents, tours, and offer tracking.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "AI-powered alerts surface hot leads, price changes, and market shifts as they happen.",
  },
  {
    icon: Repeat,
    title: "CRM Integration",
    description:
      "Sync with your existing CRM, email marketing tools, and accounting software out of the box.",
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
}

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-xs font-semibold tracking-widest text-primary uppercase">Features</span>
          <h2 className="mt-3 font-serif text-3xl text-foreground text-balance md:text-4xl lg:text-5xl">
            Everything your agency needs
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            One platform to manage your entire pipeline, from listing creation to contract signing.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.article
              key={feature.title}
              variants={item}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 md:p-8"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <feature.icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
