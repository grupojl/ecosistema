/**
 * app/products/[handle]/page.tsx
 *
 * Ruta legacy — redirige permanentemente a /tienda/[slug]/productos/[handle].
 *
 * La ruta canónica multi-tenant es /tienda/[slug]/productos/[handle].
 * Sin contexto de slug no podemos resolver la org, así que redirigimos
 * a la raíz de /tienda/ para que el usuario elija la tienda correcta.
 *
 * TODO: cuando no haya más tráfico a /products/, eliminar este archivo.
 */
import { redirect } from 'next/navigation';

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export default async function ProductLegacyPage({ params }: ProductPageProps) {
  const { handle } = await params;
  // 308 Permanent Redirect hacia la ruta canónica de tienda
  redirect(`/tienda`);
}
