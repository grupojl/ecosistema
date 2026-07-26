import { IsEnum, IsNotEmpty } from 'class-validator';

export enum UserRole {
  OWNER = 'owner',
  AFFILIATE = 'affiliate',
}

export class SelectRoleDto {
  @IsEnum(UserRole, {
    message: 'El rol debe ser "owner" o "affiliate"',
  })
  @IsNotEmpty()
  role: UserRole;
}