import Link from "next/link"
import { Button } from "@real/ui"

interface HeroLink {
  label: string
  href: string
}

interface ProductHeroProps {
  title: string
  subtitle: string
  description?: string
  image?: string
  darkBg: boolean
  /** Uso de la home genérica (sin tienda): botones de muestra sin destino. */
  buttons?: string[]
  /** Uso en las tiendas: botones con destino real. */
  primary?: HeroLink
  secondary?: HeroLink
  /** Texto cuando el producto no tiene imagen (hoy ningún producto tiene). */
  noImageLabel?: string
  /** Una página debe tener UN solo <h1>: el hero principal usa h1 (por defecto) y los demás h2. */
  headingLevel?: 'h1' | 'h2'
}

export default function ProductHero({
  title, subtitle, description, image, darkBg, buttons, primary, secondary, noImageLabel, headingLevel = 'h1',
}: ProductHeroProps) {
  const Heading = headingLevel
  const primaryClass = "px-8 py-2 rounded-full font-semibold bg-blue-500 hover:bg-blue-600 text-white"
  const secondaryClass = `px-8 py-2 rounded-full font-semibold ${
    darkBg ? "border-white text-white hover:bg-white/10" : "border-black text-black hover:bg-black/5"
  }`
  const linkBase = "inline-flex items-center justify-center text-sm transition-colors"
  const hasActions = Boolean(primary || secondary || buttons?.length)

  return (
    <section className={`w-full py-20 md:py-32 ${darkBg ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Content Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <Heading className="text-5xl md:text-6xl font-bold tracking-tight mb-2">{title}</Heading>
          <p className={`text-lg md:text-xl font-semibold ${darkBg ? "text-gray-400" : "text-gray-600"} mb-2`}>
            {subtitle}
          </p>
          {description && (
            <p className={`text-base max-w-2xl ${darkBg ? "text-gray-400" : "text-gray-600"}`}>{description}</p>
          )}

          {/* Buttons */}
          {hasActions && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              {primary ? (
                <Link href={primary.href} className={`${linkBase} ${primaryClass}`}>{primary.label}</Link>
              ) : buttons?.[0] ? (
                <Button variant="default" className={primaryClass}>{buttons[0]}</Button>
              ) : null}
              {secondary ? (
                <Link href={secondary.href} className={`${linkBase} border ${secondaryClass}`}>{secondary.label}</Link>
              ) : buttons?.[1] ? (
                <Button variant="outline" className={secondaryClass}>{buttons[1]}</Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Image Section — solo si hay imagen o se pidió un placeholder */}
        {(image || noImageLabel !== undefined) && (
          <div className="flex justify-center">
            <div className="relative w-full max-w-2xl aspect-square">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={title} className="w-full h-full object-contain" />
              ) : (
                <div
                  className={`w-full h-full rounded-3xl flex items-center justify-center text-sm ${
                    darkBg ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400"
                  }`}
                  aria-hidden="true"
                >
                  {noImageLabel}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
