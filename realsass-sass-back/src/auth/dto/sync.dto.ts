import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SyncUserDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}