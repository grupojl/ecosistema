// El precio que devuelve real-ecommerce-back ya está en dólares (el
// serializer del backend hace esa conversión una sola vez, del lado del
// servidor) — acá solo se formatea para mostrar.
export function formatPrice(amount: number, currencyCode = "USD"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}
