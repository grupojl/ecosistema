import { Module }                          from '@nestjs/common';
import { OrganizationsController }         from './organizations.controller';
import { OrganizationsService }            from './organizations.service';
import { PrismaOrganizationsRepository }   from './repository/prisma-organizations.repository';
import { ORGANIZATIONS_REPOSITORY }        from './repository/organizations.repository.interface';
import { PrismaModule }                    from '../prisma/prisma.module';
import { MarketsModule }                   from '../markets/markets.module';

@Module({
  // MarketsModule solo importa PrismaModule → sin dependencia circular.
  imports:     [PrismaModule, MarketsModule],
  controllers: [OrganizationsController],
  providers:   [
    OrganizationsService,
    { provide: ORGANIZATIONS_REPOSITORY, useClass: PrismaOrganizationsRepository },
  ],
  exports:     [OrganizationsService],
})
export class OrganizationsModule {}
