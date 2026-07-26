"use client"

import { motion } from "framer-motion"
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
          className="grid grid-cols-2 gap-8 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={item} className="flex flex-col items-center text-center md:items-start md:text-left">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className="size-5 text-primary" />
              </div>
              <p className="mt-4 font-serif text-3xl text-foreground md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{stat.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stat.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
