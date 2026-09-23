// Ruta legacy sin contexto de tienda — no podemos resolver a qué slug ni
// idioma pertenece, así que mandamos a la raíz de tiendas (307: decisión
// de negocio, no transferencia permanente de autoridad SEO — no sabemos el destino real).
import { redirect } from 'next/navigation'

export default async function ProductLegacyPage() {
  redirect('/tienda')
}
