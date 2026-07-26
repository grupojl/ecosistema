import type { ShippingAdapter, ShipmentDetails, CarrierQuote } from "@/types/shipping"
import { selectCarrier } from "./carrier-selector"

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
