import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres' })
  description?: string;

  @IsUrl({}, { message: 'El logo debe ser una URL válida' })
  @IsOptional()
  logoUrl?: string;

  @IsUrl({}, { message: 'El sitio web debe ser una URL válida' })
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'El teléfono no puede superar los 20 caracteres' })
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'La dirección no puede superar los 200 caracteres' })
  address?: string;
}