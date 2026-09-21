import { z } from 'zod'

// ── Zod schema del fulfillmentConfig (JSONB) ──────────────────────────────────
export const FulfillmentConfigSchema = z.object({
  provider:     z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes:        z.string().optional(),
  priority:     z.number().int().min(1).default(1),
})
export type FulfillmentConfig = z.infer<typeof FulfillmentConfigSchema>

// ── Entidad de dominio pura ───────────────────────────────────────────────────
export interface MarketProps {
  id:                string
  organizationId:    string
  countryCode:       string   // ISO 3166-1 alpha-2
  isDefault:         boolean
  isActive:          boolean
  fulfillmentConfig: FulfillmentConfig
  createdAt:         Date
  updatedAt:         Date
}

export class Market {
  readonly id:                string
  readonly organizationId:    string
  readonly countryCode:       string
  readonly isDefault:         boolean
  readonly isActive:          boolean
  readonly fulfillmentConfig: FulfillmentConfig
  readonly createdAt:         Date
  readonly updatedAt:         Date

  private constructor(props: MarketProps) {
    this.id                = props.id
    this.organizationId    = props.organizationId
    this.countryCode       = props.countryCode.toUpperCase()
    this.isDefault         = props.isDefault
    this.isActive          = props.isActive
    this.fulfillmentConfig = props.fulfillmentConfig
    this.createdAt         = props.createdAt
    this.updatedAt         = props.updatedAt
  }

  static fromPrisma(raw: MarketProps): Market {
    // Validar fulfillmentConfig con Zod al hidratar desde DB
    const config = FulfillmentConfigSchema.parse(
      typeof raw.fulfillmentConfig === 'string'
        ? JSON.parse(raw.fulfillmentConfig)
        : raw.fulfillmentConfig
    )
    return new Market({ ...raw, fulfillmentConfig: config })
  }

  toDTO(): MarketDTO {
    return {
      id:                this.id,
      organizationId:    this.organizationId,
      countryCode:       this.countryCode,
      isDefault:         this.isDefault,
      isActive:          this.isActive,
      fulfillmentConfig: this.fulfillmentConfig,
      createdAt:         this.createdAt.toISOString(),
      updatedAt:         this.updatedAt.toISOString(),
    }
  }
}

export type MarketDTO = {
  id:                string
  organizationId:    string
  countryCode:       string
  isDefault:         boolean
  isActive:          boolean
  fulfillmentConfig: FulfillmentConfig
  createdAt:         string
  updatedAt:         string
}
