import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { PublicCatalogController } from './public-catalog.controller';
import { PrismaCatalogRepository } from './repository/prisma-catalog.repository';
import { CATALOG_REPOSITORY } from './repository/catalog.repository.interface';

@Module({
  controllers: [CatalogController, PublicCatalogController],
  providers: [
    CatalogService,
    {
      provide: CATALOG_REPOSITORY,
      useClass: PrismaCatalogRepository,
    },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
