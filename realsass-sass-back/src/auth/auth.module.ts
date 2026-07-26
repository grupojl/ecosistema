import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AffiliatesModule } from '../affiliate/affiliate.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AffiliatesModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
