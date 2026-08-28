export interface ContentTemplate {
  id:             string;
  organizationId: string;
  key:            string;
  content:        string;
  description:    string | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface CreateTemplateInput {
  organizationId: string;
  key:            string;
  content:        string;
  description?:   string;
}
