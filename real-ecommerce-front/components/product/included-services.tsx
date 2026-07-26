import type { Service } from "@/types/product"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface IncludedServicesProps {
  services: Service[]
}

export function IncludedServices({ services }: IncludedServicesProps) {
  return (
    <section className="py-12 md:py-16">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-8 text-balance">
        Your new product comes with so much more
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((service, index) => (
          <Card key={index} className="text-center">
            <CardHeader>
              <div className="text-5xl mb-4">{service.icon}</div>
              <CardTitle className="text-xl">{service.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
              {service.trialDuration && <p className="text-xs font-semibold text-primary">{service.trialDuration}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
