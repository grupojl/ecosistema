import { Module }                          from '@nestjs/common';
import { OrganizationsController }         from './organizations.controller';
import { OrganizationsService }            from './organizations.service';
import { PrismaOrganizationsRepository }   from './repository/prisma-organizations.repository';
import { ORGANIZATIONS_REPOSITORY }        from './repository/organizations.repository.interface';
import { PrismaModule }                    from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [OrganizationsController],
  providers:   [
    OrganizationsService,
    { provide: ORGANIZATIONS_REPOSITORY, useClass: PrismaOrganizationsRepository },
  ],
  exports:     [OrganizationsService],
})
export class OrganizationsModule {}
