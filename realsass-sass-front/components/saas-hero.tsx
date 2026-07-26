"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { ArrowRight, Play } from "lucide-react"

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function SaasHero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24 lg:pt-44">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
              New: AI-Powered Valuations
              <ArrowRight className="size-3" />
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="mt-6 max-w-4xl font-serif text-4xl leading-tight tracking-tight text-foreground text-balance md:text-5xl lg:text-7xl lg:leading-[1.1]"
          >
            The platform that modern agencies trust
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.3 }}
            className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Manage listings, automate workflows, and close deals faster with an all-in-one real estate platform built for high-performing agencies.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.4 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            <a
              href="#pricing"
              className="flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Start free trial
              <ArrowRight className="size-4" />
            </a>
            <button className="flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-7 text-sm font-semibold text-foreground transition-all hover:bg-secondary active:scale-[0.98]">
              <Play className="size-4 fill-current" />
              Watch demo
            </button>
          </motion.div>

          {/* Social proof line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-6 text-xs text-muted-foreground"
          >
            {"Trusted by 2,400+ agencies across 30 countries"}
          </motion.p>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.5 }}
            className="relative mt-12 w-full max-w-5xl md:mt-16"
          >
            {/* <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl shadow-foreground/5 md:rounded-2xl">
              <Image
                src="/images/dashboard-preview.jpg"
                alt="Propiedad dashboard showing property management interface"
                width={1920}
                height={1080}
                className="w-full"
                priority
              />
            </div> */}
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-primary/5 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
