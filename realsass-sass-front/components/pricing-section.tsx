"use client"

import { motion } from "framer-motion"
import { Badge, Button, Card, SectionIntro, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@real/ui"
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

const MotionCard = motion.create(Card)

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
        >
          <SectionIntro
            eyebrow="Pricing"
            title="Plans that scale with you"
            description="Start free for 14 days. No credit card required. Upgrade or downgrade any time."
          />
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
            <MotionCard
              key={plan.name}
              variants={item}
              className={`relative flex flex-col overflow-hidden ${plan.highlighted ? "border-primary shadow-lg" : ""}`}
            >
              {plan.highlighted && <div className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />}

              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.highlighted && <Badge>Popular</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline gap-1 pt-3">
                  <span className="font-display text-4xl text-foreground md:text-5xl">
                    {"$"}{plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="flex flex-col gap-3" role="list">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button asChild size="lg" variant={plan.highlighted ? "default" : "outline"} className="w-full">
                  <a href="#">
                    {plan.cta}
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </CardFooter>
            </MotionCard>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
