export interface Product {
  id: string
  name: string
  category: string
  price: number
  originalPrice?: number
  description: string
  images: string[]
  specifications: Specification[]
  whatsInBox: BoxItem[]
  includedServices?: Service[]
  relatedProducts?: RelatedProduct[]
  features: string[]
  colors?: ColorOption[]
}

export interface Specification {
  label: string
  value: string
}

export interface BoxItem {
  name: string
  image: string
}

export interface Service {
  name: string
  description: string
  icon: string
  trialDuration?: string
}

export interface RelatedProduct {
  id: string
  name: string
  image: string
  price: number
  description?: string
}

export interface ColorOption {
  name: string
  value: string
}
