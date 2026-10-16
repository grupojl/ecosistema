import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { SaasHero } from "@/components/saas-hero"
import { StatsSection } from "@/components/stats-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { ReviewsSection } from "@/components/reviews-section"
import { CtaBand } from "@/components/cta-band"
import { Footer } from "@/components/footer"
import { BottomTabBar } from "@/components/bottom-tab-bar"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/[/]+$/, '')

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL ? `${SITE_URL}/` : '/' },
  openGraph: {
    type: 'website',
    title: 'Propiedad - The Real Estate Platform for Modern Agencies',
    description: 'Manage listings, automate workflows, and close deals faster with an all-in-one real estate platform.',
    ...(SITE_URL ? { url: SITE_URL } : {}),
  },
  twitter: { card: 'summary_large_image', title: 'Propiedad - The Real Estate Platform for Modern Agencies' },
}

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <SaasHero />
      <StatsSection />
      <FeaturesSection />
      <PricingSection />
      <ReviewsSection />
      <CtaBand />
      <Footer />
      <BottomTabBar />
    </main>
  )
}
