# Checklist: release SEO + idioma (ADR-016)

## Pre-deploy (infraestructura)

- [ ] **Railway watchPatterns** configurados por servicio para que cada push
      reconstruya solo lo afectado (y un commit de `.claude/` no reconstruya nada):

      | Servicio | watchPatterns |
      |----------|---------------|
      | realsass-sass-back | `realsass-sass-back/**`, `packages/auth-server/**`, `pnpm-lock.yaml` |
      | realsass-ecommerce-back | `realsass-ecommerce-back/**`, `packages/**`, `pnpm-lock.yaml` |
      | real-ecommerce-front | `real-ecommerce-front/**`, `packages/ui/**`, `packages/trpc/**`, `packages/auth-client/**`, `realsass-ecommerce-back/src/trpc/**`, `pnpm-lock.yaml` |

- [ ] `SITE_URL` configurado en Railway (real-ecommerce-front), sin barra final.
- [ ] Cloudflare en modo **proxied** delante del dominio del storefront (habilita `CF-IPCountry`).
- [ ] Propiedad del dominio verificada en Google Search Console.

## Deploy — en este orden, esperando healthy entre pasos

- [ ] 1. `realsass-sass-back`
      `curl -s $SASS_BACK/api/v1/organizations/public/by-slug/{slug}` → incluye `countryCode`, `ecommerceEnabled: true`
- [ ] 2. `realsass-ecommerce-back`
      slug inexistente → tRPC `NOT_FOUND`; con sass-back detenido en staging → `SERVICE_UNAVAILABLE`
- [ ] 3. `real-ecommerce-front`

## Post-deploy (verificación con curl)

```bash
SITE=https://tu-storefront.com; SLUG=mi-marca

# Negociación por navegador → 307 a /pt
curl -sI -H 'Accept-Language: pt-BR,pt;q=0.9' "$SITE/tienda/$SLUG" | grep -iE '^(HTTP|location|x-locale-source|vary)'

# Cookie explícita gana sobre Accept-Language → /en
curl -sI -H 'Cookie: NEXT_LOCALE=en' -H 'Accept-Language: es' "$SITE/tienda/$SLUG" | grep -i location

# Crawler: la URL con idioma NUNCA redirige → 200
curl -sI -A 'Googlebot/2.1' "$SITE/pt/tienda/$SLUG" | head -1

# Metadata: lang, canonical, hreflang, robots
curl -s "$SITE/es/tienda/$SLUG" | grep -oE '<html lang="[a-z]+"|rel="canonical"[^>]*|hreflang="[^"]*"|name="robots"[^>]*'

# JSON-LD presente y escapado
curl -s "$SITE/es/tienda/$SLUG/productos/{handle}" | grep -c 'application/ld+json'

# Sitemap y robots
curl -s "$SITE/sitemaps/$SLUG" | head -20
curl -s "$SITE/robots.txt"

# Paginación fuera de rango → 404 real
curl -sI "$SITE/es/tienda/$SLUG/productos?page=9999" | head -1
```

## Search Console

- [ ] Enviar `/sitemaps/{slug}` de cada tienda activa (hasta que exista el sitemap index).
- [ ] Inspección de URL de un producto → "La URL está en Google" + canonical elegido = declarado.
- [ ] Prueba de resultados enriquecidos (Rich Results Test) sobre un producto → `Product` válido.
- [ ] Revisar a los 7 y 28 días: cobertura, "Duplicada: Google eligió un canonical diferente" = 0.

## Rollback

Un commit por servicio → `git revert <sha>` del servicio afectado. Revertir en
orden inverso (front → ecommerce-back → sass-back). El contrato es aditivo:
revertir el front no rompe los backs.
