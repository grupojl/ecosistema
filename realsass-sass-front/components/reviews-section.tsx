"use client"

import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const reviews = [
  {
    name: "Carolina Mendez",
    role: "Director, Mendez & Asociados",
    initials: "CM",
    rating: 5,
    text: "Propiedad completely transformed our operation. We went from juggling spreadsheets to managing 300+ listings with a team of six. The analytics alone paid for itself in the first month.",
  },
  {
    name: "James Whitfield",
    role: "CEO, Whitfield Realty Group",
    initials: "JW",
    rating: 5,
    text: "The CRM integration was seamless. Our agents were productive from day one, and the automated follow-ups have increased our close rate by over 20%.",
  },
  {
    name: "Sofia Restrepo",
    role: "Broker, Urban Living Co.",
    initials: "SR",
    rating: 5,
    text: "I have tried every real estate platform out there. Propiedad is the first one that actually feels like it was designed by people who understand the industry. Clean, fast, and intuitive.",
  },
  {
    name: "Michael Torres",
    role: "COO, Pacific Properties",
    initials: "MT",
    rating: 5,
    text: "The client portal is a game changer. Buyers can track their offers in real time, which drastically reduced our back-and-forth communication overhead.",
  },
  {
    name: "Elena Vasquez",
    role: "Managing Partner, Vasquez Group",
    initials: "EV",
    rating: 5,
    text: "We switched from a legacy CRM and saw immediate results. Our team loves the workflow automation features -- they save us at least 10 hours per week.",
  },
  {
    name: "David Kim",
    role: "Founder, Horizon Estates",
    initials: "DK",
    rating: 5,
    text: "Outstanding support and a product that just works. The multi-portal syndication keeps our properties visible across every major marketplace effortlessly.",
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
}

export function ReviewsSection() {
  return (
    <section id="reviews" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-xs font-semibold tracking-widest text-primary uppercase">Reviews</span>
          <h2 className="mt-3 font-serif text-3xl text-foreground text-balance md:text-4xl lg:text-5xl">
            Loved by agencies worldwide
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {"Don't take our word for it. Here's what our customers have to say."}
          </p>
        </motion.div>

        {/* Masonry-ish Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-14 columns-1 gap-5 md:columns-2 lg:columns-3"
        >
          {reviews.map((review) => (
            <motion.article
              key={review.name}
              variants={item}
              className="mb-5 inline-block w-full break-inside-avoid rounded-2xl border border-border bg-card p-6 md:p-7"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-primary text-primary" />
                ))}
              </div>

              {/* Text */}
              <p className="mt-4 text-sm leading-relaxed text-foreground">
                {`"${review.text}"`}
              </p>

              {/* Author */}
              <div className="mt-5 flex items-center gap-3">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                    {review.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{review.name}</p>
                  <p className="text-xs text-muted-foreground">{review.role}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
