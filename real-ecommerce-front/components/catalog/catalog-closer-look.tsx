"use client"

import { Button } from "@/components/ui/button"
import { PlayCircle } from "lucide-react"

interface CloserLookProps {
  title: string
  description: string
}

export function CatalogCloserLook({ title, description }: CloserLookProps) {
  return (
    <section className="bg-gray-50 px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-balance text-4xl font-bold tracking-tight">Take a closer look.</h2>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Video Section */}
          <div className="relative overflow-hidden rounded-3xl bg-gray-900">
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <PlayCircle className="mx-auto h-16 w-16 text-white mb-4 opacity-80" />
                <p className="text-white/60 text-sm">Video Content</p>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex flex-col justify-center gap-8">
            <div>
              <h3 className="mb-4 text-2xl font-bold">{title}</h3>
              <p className="text-2xl font-light text-gray-600">{description}</p>
            </div>

            <p className="text-lg leading-relaxed text-gray-600">
              Descubre las características más destacadas. Desde la tecnología más avanzada hasta el diseño más
              innovador, cada detalle está diseñado para ofrecerte la mejor experiencia.
            </p>

            <Button size="lg" className="w-fit gap-2">
              Watch the video
              <PlayCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
