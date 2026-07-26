"use client"

import { motion } from "framer-motion"
import { Check, ArrowRight } from "lucide-react"

const plans = [
  {
    name: "Starter",
    description: "For independent agents getting started.",
    price: 29,
    period: "/mo",
    features: [
      "Up to 50 listings",
      "Basic analytics",
      "1 team member",
      "Email support",
      "Client portal",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Professional",
    description: "For growing agencies that need more power.",
    price: 79,
    period: "/mo",
    features: [
      "Unlimited listings",
      "Advanced analytics",
      "Up to 10 team members",
      "Priority support",
      "CRM integrations",
      "Workflow automation",
      "Custom branding",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "For large agencies with custom needs.",
    price: 199,
    period: "/mo",
    features: [
      "Everything in Professional",
      "Unlimited team members",
      "Dedicated account manager",
      "SSO & advanced security",
      "API access",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
}

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-xs font-semibold tracking-widest text-primary uppercase">Pricing</span>
          <h2 className="mt-3 font-serif text-3xl text-foreground text-balance md:text-4xl lg:text-5xl">
            Plans that scale with you
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Start free for 14 days. No credit card required. Upgrade or downgrade any time.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={item}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 md:p-8 ${
                plan.highlighted
                  ? "border-primary bg-card shadow-xl shadow-primary/10"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 right-0 left-0 h-1 bg-primary" />
              )}

              <div>
                <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-serif text-4xl text-foreground md:text-5xl">
                  {"$"}{plan.price}
                </span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="mt-8 flex flex-col gap-3" role="list">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-2">
                <a
                  href="#"
                  className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
