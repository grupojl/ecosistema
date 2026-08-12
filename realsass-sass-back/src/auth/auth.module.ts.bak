import { Module }           from '@nestjs/common';
import { AuthController }   from './auth.controller';
import { AuthService }      from './auth.service';
import { UsersModule }      from '../users/users.module';
import { AffiliatesModule } from '../affiliate/affiliate.module';

@Module({
  imports:     [UsersModule, AffiliatesModule],
  controllers: [AuthController],
  providers:   [AuthService],
  exports:     [AuthService],
})
export class AuthModule {}
