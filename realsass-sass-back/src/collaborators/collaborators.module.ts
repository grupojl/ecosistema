import { Module }                         from '@nestjs/common';
import { CollaboratorsService }           from './collaborators.service';
import { PrismaCollaboratorsRepository }  from './repository/prisma-collaborators.repository';
import { COLLABORATORS_REPOSITORY }       from './repository/collaborators.repository.interface';
import { PrismaModule }                   from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  
  providers:   [
    CollaboratorsService,
    { provide: COLLABORATORS_REPOSITORY, useClass: PrismaCollaboratorsRepository },
  ],
  exports:     [CollaboratorsService],
})
export class CollaboratorsModule {}
