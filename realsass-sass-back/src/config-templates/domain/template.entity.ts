export interface ContentTemplate {
  id:             string;
  organizationId: string;
  key:            string;
  content:        string;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface CreateTemplateInput {
  organizationId: string;
  key:            string;
  content:        string;
}
