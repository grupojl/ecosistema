export interface WebhookEndpoint {
  id:              string;
  organizationId:  string;
  url:             string;
  events:          string[];
  description:     string | null;
  isActive:        boolean;
  /** Pista para reconocer el secreto de firma (últimos 4). El secreto completo solo se muestra al crearlo o rotarlo. */
  secretHint:      string;
  lastTriggeredAt: Date | null;
  failureCount:    number;
  createdAt:       Date;
  updatedAt:       Date;
}

export interface WebhookDeliveryLog {
  id:             string;
  webhookId:      string;
  event:          string;
  statusCode:     number | null;
  success:        boolean;
  duration:       number | null;
  attempt:        number;
  error:          string | null;
  createdAt:      Date;
}

export interface CreateWebhookInput {
  organizationId: string;
  url:            string;
  events:         string[];
  description?:   string;
}

/** Datos que el service calcula (secreto cifrado) y el cliente nunca envía. */
export interface PersistWebhookInput extends CreateWebhookInput {
  secretEncrypted: string;
  secretHint:      string;
}
