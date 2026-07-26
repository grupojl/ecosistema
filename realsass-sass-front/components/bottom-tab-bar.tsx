"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Home, Search, Heart } from "lucide-react"

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "saved", label: "Saved", icon: Heart },
]

export function BottomTabBar() {
  const [activeTab, setActiveTab] = useState("home")

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring" as const, stiffness: 300, damping: 30, delay: 0.4 }}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="flex items-center gap-1 rounded-2xl border border-border/40 p-1.5 shadow-lg backdrop-blur-xl"
        style={{ backgroundColor: "rgba(245, 240, 235, 0.9)" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl bg-primary"
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon
                className={`relative z-10 size-4.5 transition-colors ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              />
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="relative z-10 text-primary-foreground"
                >
                  {tab.label}
                </motion.span>
              )}
            </button>
          )
        })}
      </div>
    </motion.nav>
  )
}
