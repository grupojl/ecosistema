/**
 * Select appropriate carrier based on shipment characteristics
 */
export function selectCarrier(weight: number, value: number): "envia" | "welivery" | "correo" {
  // Envia: Light packages < 5kg, any value
  if (weight < 5) {
    return "envia"
  }

  // Welivery: Medium packages 5-20kg, value $50-$2000
  if (weight >= 5 && weight <= 20 && value >= 50 && value <= 2000) {
    return "welivery"
  }

  // Correo: Heavy packages > 20kg or high value > $2000
  if (weight > 20 || value > 2000) {
    return "correo"
  }

  // Default to welivery for edge cases
  return "welivery"
}
