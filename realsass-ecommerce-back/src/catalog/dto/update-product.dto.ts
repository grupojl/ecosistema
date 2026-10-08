export interface UpdateProductDto {
  name?:        string;
  description?: string;
  status?:      'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
