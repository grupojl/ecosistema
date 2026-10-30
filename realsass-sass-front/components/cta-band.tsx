"use client"

import { motion } from "framer-motion"
import { Button } from "@real/ui"
import { ArrowRight } from "lucide-react"

export function CtaBand() {
  return (
    <section className="border-t border-border bg-foreground py-20 dark:bg-card md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
        className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center lg:px-8"
      >
        <h2 className="font-display text-3xl text-background text-balance dark:text-foreground md:text-4xl lg:text-5xl">
          Ready to modernize your agency?
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-background/60 dark:text-muted-foreground">
          Join 2,400+ agencies already using Propiedad. Start your free 14-day trial today.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg"><a href="#">
            Start free trial
            <ArrowRight className="size-4" />
          </a></Button>
          <Button asChild size="lg" variant="outline"><a href="#">
            Talk to sales
          </a></Button>
        </div>
      </motion.div>
    </section>
  )
}
