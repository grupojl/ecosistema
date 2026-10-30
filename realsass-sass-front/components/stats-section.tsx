"use client"

import { motion } from "framer-motion"
import { StatCard } from "@real/ui"
import { TrendingUp, Users, Building2, Globe } from "lucide-react"

const stats = [
  {
    icon: Building2,
    value: "120K+",
    label: "Active Listings",
    description: "Properties managed through our platform",
  },
  {
    icon: Users,
    value: "2,400+",
    label: "Agencies",
    description: "Real estate teams trusting Propiedad",
  },
  {
    icon: TrendingUp,
    value: "34%",
    label: "Faster Closings",
    description: "Average improvement in deal speed",
  },
  {
    icon: Globe,
    value: "30",
    label: "Countries",
    description: "Global reach across markets",
  },
]

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
}

export function StatsSection() {
  return (
    <section className="border-y border-border bg-card/50 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={item}>
              <StatCard
                className="h-full p-6"
                icon={<stat.icon aria-hidden="true" />}
                label={stat.label}
                value={stat.value}
                hint={stat.description}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
