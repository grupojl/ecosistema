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
