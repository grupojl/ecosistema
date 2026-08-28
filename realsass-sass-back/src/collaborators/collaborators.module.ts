import { Module }                         from '@nestjs/common';
import { CollaboratorsController }        from './collaborators.controller';
import { CollaboratorsService }           from './collaborators.service';
import { PrismaCollaboratorsRepository }  from './repository/prisma-collaborators.repository';
import { COLLABORATORS_REPOSITORY }       from './repository/collaborators.repository.interface';
import { PrismaModule }                   from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [CollaboratorsController],
  providers:   [
    CollaboratorsService,
    { provide: COLLABORATORS_REPOSITORY, useClass: PrismaCollaboratorsRepository },
  ],
  exports:     [CollaboratorsService],
})
export class CollaboratorsModule {}
