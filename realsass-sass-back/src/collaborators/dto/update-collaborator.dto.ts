import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCollaboratorDto {
  @IsBoolean() @IsOptional() canViewListings?: boolean;
  @IsBoolean() @IsOptional() canCreateListings?: boolean;
  @IsBoolean() @IsOptional() canEditListings?: boolean;
  @IsBoolean() @IsOptional() canDeleteListings?: boolean;
  @IsBoolean() @IsOptional() canViewStats?: boolean;
  @IsBoolean() @IsOptional() canManageLeads?: boolean;
  @IsBoolean() @IsOptional() canManageCollaborators?: boolean;
}