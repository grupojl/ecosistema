"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export function CtaBand() {
  return (
    <section className="border-t border-border bg-foreground py-20 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
        className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center lg:px-8"
      >
        <h2 className="font-serif text-3xl text-background text-balance md:text-4xl lg:text-5xl">
          Ready to modernize your agency?
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-background/60">
          Join 2,400+ agencies already using Propiedad. Start your free 14-day trial today.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="#"
            className="flex h-12 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Start free trial
            <ArrowRight className="size-4" />
          </a>
          <a
            href="#"
            className="flex h-12 items-center gap-2 rounded-xl border border-background/20 px-7 text-sm font-semibold text-background transition-all hover:bg-background/10 active:scale-[0.98]"
          >
            Talk to sales
          </a>
        </div>
      </motion.div>
    </section>
  )
}
