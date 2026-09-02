/**
 * app/categoria/[categoria]/page.tsx
 *
 * Ruta legacy — redirige permanentemente a /tienda/[slug]/categoria/[categoria].
 *
 * La ruta canónica multi-tenant es /tienda/[slug]/.
 * Este redirect asegura SEO correcto (308) y no rompe bookmarks existentes.
 *
 * TODO: cuando no haya más tráfico a /categoria/, eliminar este archivo.
 */
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ categoria: string }>;
}

export default async function CategoriaLegacyPage({ params }: PageProps) {
  const { categoria } = await params;
  // 308 Permanent Redirect — transferencia de SEO juice
  redirect(`/tienda/${categoria}`);
}

// Sin generateStaticParams — las rutas legacy no se pre-generan
// para no crear páginas duplicadas en el sitemap.
