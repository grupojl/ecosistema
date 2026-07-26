"use client"

interface Feature {
  id: number
  title: string
  description: string
  icon: string
}

interface CatalogFeaturesProps {
  features: Feature[]
}

export function CatalogFeatures({ features }: CatalogFeaturesProps) {
  return (
    <section className="bg-white px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-balance text-4xl font-bold tracking-tight">Get to know our products.</h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="group overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 transition-transform hover:scale-105 cursor-pointer"
            >
              <div className="mb-4 text-4xl">{feature.icon}</div>
              <h3 className="mb-3 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
