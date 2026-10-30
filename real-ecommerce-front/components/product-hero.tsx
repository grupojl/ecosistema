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
  const hasActions = Boolean(primary || secondary || buttons?.length)

  return (
    <section className={`w-full py-16 medium:py-24 expanded:py-32 text-foreground ${darkBg ? "bg-muted/50" : "bg-background"}`}>
      <div className="max-w-7xl mx-auto px-4 medium:px-6 expanded:px-8">
        {/* Content Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <Heading className="font-display text-4xl medium:text-5xl expanded:text-6xl font-semibold tracking-tight text-balance mb-2">{title}</Heading>
          <p className="text-lg medium:text-xl font-medium text-muted-foreground mb-2">
            {subtitle}
          </p>
          {description && (
            <p className="text-base max-w-2xl text-muted-foreground">{description}</p>
          )}

          {/* Buttons */}
          {hasActions && (
            <div className="flex flex-col medium:flex-row gap-3 justify-center mt-8">
              {primary ? (
                <Button asChild size="lg"><Link href={primary.href}>{primary.label}</Link></Button>
              ) : buttons?.[0] ? (
                <Button size="lg">{buttons[0]}</Button>
              ) : null}
              {secondary ? (
                <Button asChild variant="outline" size="lg"><Link href={secondary.href}>{secondary.label}</Link></Button>
              ) : buttons?.[1] ? (
                <Button variant="outline" size="lg">{buttons[1]}</Button>
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
                  className="w-full h-full rounded-lg border flex items-center justify-center text-sm bg-muted text-muted-foreground"
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
