/**
 * lib/seo/sitemap.ts — sitemap XML por tienda. PURO.
 * Solo URLs indexables (una URL noindex en el sitemap es una señal contradictoria).
 */
export interface SitemapAlternate {
  hreflang: string;
  href:     string;
}

export interface SitemapEntry {
  loc:        string;
  lastmod?:   Date;
  alternates: readonly SitemapAlternate[];
}

/** Límite del protocolo sitemaps.org por archivo. */
export const SITEMAP_MAX_URLS = 50_000;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.slice(0, SITEMAP_MAX_URLS).map((entry) => {
    const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod && !Number.isNaN(entry.lastmod.getTime()) && entry.lastmod.getTime() > 0) {
      lines.push(`    <lastmod>${entry.lastmod.toISOString()}</lastmod>`);
    }
    for (const alt of entry.alternates) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}"/>`,
      );
    }
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
  ].join('\n');
}
