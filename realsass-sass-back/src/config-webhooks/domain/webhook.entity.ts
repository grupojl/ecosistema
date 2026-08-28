export interface WebhookEndpoint {
  id:             string;
  organizationId: string;
  url:            string;
  events:         string[];
  isActive:       boolean;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface WebhookDeliveryLog {
  id:             string;
  webhookId:      string;
  event:          string;
  statusCode:     number | null;
  success:        boolean;
  responseBody:   string | null;
  createdAt:      Date;
}

export interface CreateWebhookInput {
  organizationId: string;
  url:            string;
  events:         string[];
}
