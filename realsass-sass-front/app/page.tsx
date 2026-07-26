import { Navbar } from "@/components/navbar"
import { SaasHero } from "@/components/saas-hero"
import { StatsSection } from "@/components/stats-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { ReviewsSection } from "@/components/reviews-section"
import { CtaBand } from "@/components/cta-band"
import { Footer } from "@/components/footer"
import { BottomTabBar } from "@/components/bottom-tab-bar"

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
