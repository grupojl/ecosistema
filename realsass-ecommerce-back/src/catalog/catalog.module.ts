import { Module } from '@nestjs/common';
import { CatalogService } from '@/catalog/catalog.service';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { CATALOG_REPOSITORY } from '@/catalog/repository/catalog.repository.interface';

@Module({
  controllers: [ Public],
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
