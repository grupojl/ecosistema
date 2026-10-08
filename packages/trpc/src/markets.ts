/**
 * Hoja del contrato de Markets — sin dependencias de ningún back.
 *
 * Existe aparte de los routers para que ecommerce-back pueda importar
 * `MarketDTO` sin depender del contrato completo (que a su vez se genera
 * a partir de ecommerce-back → ciclo). Fuente de verdad del shape:
 * realsass-sass-back/src/markets/domain/market.entity.ts (MarketDTO).
 */
export type FulfillmentConfig = {
  provider?:     string;
  contactEmail?: string;
  notes?:        string;
  priority:      number;
};

export type MarketDTO = {
  id:                string;
  organizationId:    string;
  countryCode:       string;
  isDefault:         boolean;
  isActive:          boolean;
  fulfillmentConfig: FulfillmentConfig;
  createdAt:         string;
  updatedAt:         string;
};
