"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import ShoppingBagModal from "./shopping-bag-modal"
import { getCategories, type Category } from "@/lib/ecommerce"

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const cats = await getCategories()
        setCategories(cats)
      } finally {
        setIsLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  const staticNavItems = [{ label: "Store", href: "/" }]

  const categoryNavItems = categories.map((cat) => ({
    label: cat.name,
    href: `/categoria/${cat.handle}`,
  }))

  const additionalNavItems = [{ label: "Support", href: "#" }]

  const navItems = [...staticNavItems, ...categoryNavItems, ...additionalNavItems]

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span className="text-sm font-semibold text-white tracking-tight">Nimbus Store</span>
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {isLoadingCategories ? (
              <span className="text-sm text-gray-500">Cargando categorías...</span>
            ) : (
              navItems.map((item) => (
                <Link key={item.label} href={item.href} className="text-sm text-gray-300 hover:text-white transition">
                  {item.label}
                </Link>
              ))
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-900 rounded-full transition">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="p-2 hover:bg-gray-900 rounded-full transition"
              >
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </button>

              {isCartOpen && (
                <div className="absolute right-0 mt-2 w-96">
                  <ShoppingBagModal onClose={() => setIsCartOpen(false)} />
                </div>
              )}
            </div>

            <button className="p-2 hover:bg-gray-900 rounded-full transition lg:hidden">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
