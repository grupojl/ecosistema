export * from "../shipping/shipping-service"
export * from "../shipping/carrier-selector"

export interface ShipmentDetails {
  weight: number // kg
  value: number // currency
  origin: string
  destination: string
  dimensions?: {
    length: number
    width: number
    height: number
  }
}

export interface CarrierQuote {
  carrier: "envia" | "welivery" | "correo"
  price: number
  estimatedDays: number
  service: string
}

export interface ShippingAdapter {
  name: string
  calculateShipping(details: ShipmentDetails): Promise<CarrierQuote>
  createShipment(details: ShipmentDetails): Promise<{ trackingNumber: string; label: string }>
  getTracking(trackingNumber: string): Promise<any>
}

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

export class ShippingService {
  private adapters: Map<string, ShippingAdapter> = new Map()

  registerAdapter(carrier: string, adapter: ShippingAdapter) {
    this.adapters.set(carrier, adapter)
  }

  async getQuotes(details: ShipmentDetails): Promise<CarrierQuote[]> {
    const quotes: CarrierQuote[] = []

    for (const [_, adapter] of this.adapters) {
      try {
        const quote = await adapter.calculateShipping(details)
        quotes.push(quote)
      } catch (error) {
        console.error(`[v0] Error getting quote from ${adapter.name}:`, error)
      }
    }

    return quotes.sort((a, b) => a.price - b.price)
  }

  async createShipment(details: ShipmentDetails, carrier?: string): Promise<{ trackingNumber: string; label: string }> {
    const selectedCarrier = carrier || selectCarrier(details.weight, details.value)
    const adapter = this.adapters.get(selectedCarrier)

    if (!adapter) {
      throw new Error(`Carrier ${selectedCarrier} not found`)
    }

    return adapter.createShipment(details)
  }

  async trackShipment(carrier: string, trackingNumber: string) {
    const adapter = this.adapters.get(carrier)

    if (!adapter) {
      throw new Error(`Carrier ${carrier} not found`)
    }

    return adapter.getTracking(trackingNumber)
  }
}
