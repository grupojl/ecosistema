import { Module }                  from '@nestjs/common';
import { UsersService }            from '@/users/users.service';
import { PrismaUsersRepository }   from '@/users/repository/prisma-users.repository';
import { USERS_REPOSITORY }        from '@/users/repository/users.repository.interface';
import { PrismaModule }            from '@/prisma/prisma.module';
import { OrganizationsModule }     from '@/organizations/organizations.module';

@Module({
  imports:     [PrismaModule, OrganizationsModule],
  
  providers:   [
    UsersService,
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
  ],
  exports:     [UsersService],
})
export class UsersModule {}
