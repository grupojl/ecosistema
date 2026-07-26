import {
  IsEmail,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class InviteCollaboratorDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty()
  email: string;

  // Permisos — todos opcionales (default en el modelo)
  @IsBoolean() @IsOptional() canViewListings?: boolean;
  @IsBoolean() @IsOptional() canCreateListings?: boolean;
  @IsBoolean() @IsOptional() canEditListings?: boolean;
  @IsBoolean() @IsOptional() canDeleteListings?: boolean;
  @IsBoolean() @IsOptional() canViewStats?: boolean;
  @IsBoolean() @IsOptional() canManageLeads?: boolean;
  @IsBoolean() @IsOptional() canManageCollaborators?: boolean;
}