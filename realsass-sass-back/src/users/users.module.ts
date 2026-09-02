import { Module }                  from '@nestjs/common';
import { UsersService }            from './users.service';
import { PrismaUsersRepository }   from './repository/prisma-users.repository';
import { USERS_REPOSITORY }        from './repository/users.repository.interface';
import { PrismaModule }            from '../prisma/prisma.module';
import { OrganizationsModule }     from '../organizations/organizations.module';

@Module({
  imports:     [PrismaModule, OrganizationsModule],
  
  providers:   [
    UsersService,
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
  ],
  exports:     [UsersService],
})
export class UsersModule {}
