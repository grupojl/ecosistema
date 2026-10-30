"use client"

import { motion } from "framer-motion"
import { Card, SectionIntro, CardContent, CardDescription, CardHeader, CardTitle } from "@real/ui"
import { LayoutGrid, ChartColumn, Zap, Shield, Bell, Repeat } from "lucide-react"

const features = [
  {
    icon: LayoutGrid,
    title: "Listing Management",
    description:
      "Create, edit, and publish listings in seconds. Multi-portal syndication keeps your properties visible everywhere.",
  },
  {
    icon: ChartColumn,
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

const MotionCard = motion.create(Card)

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
        >
          <SectionIntro
            eyebrow="Features"
            title="Everything your agency needs"
            description="One platform to manage your entire pipeline, from listing creation to contract signing."
          />
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
            <MotionCard
              key={feature.title}
              variants={item}
              className="group flex flex-col transition-colors hover:border-primary/40"
            >
              <CardHeader className="space-y-4">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </MotionCard>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
