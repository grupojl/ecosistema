// Ruta legacy — mismo motivo que /products/[handle]: sin slug no hay destino canónico.
import { redirect } from 'next/navigation'

export default async function CategoriaLegacyPage() {
  redirect('/tienda')
}
