import { Module }                      from "@nestjs/common";
import { InventoryService }            from "./inventory.service";
import { PrismaInventoryRepository }   from "./repository/prisma-inventory.repository";
import { INVENTORY_REPOSITORY }        from "./repository/inventory.repository.interface";

@Module({
  providers: [
    InventoryService,
    PrismaInventoryRepository,
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
  ],
  exports: [InventoryService, INVENTORY_REPOSITORY],
})
export class InventoryModule {}
