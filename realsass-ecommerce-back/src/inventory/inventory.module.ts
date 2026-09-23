import { Module }                      from "@nestjs/common";
import { InventoryService }            from "@/inventory/inventory.service";
import { PrismaInventoryRepository }   from "@/inventory/repository/prisma-inventory.repository";
import { INVENTORY_REPOSITORY }        from "@/inventory/repository/inventory.repository.interface";

@Module({
  providers: [
    InventoryService,
    PrismaInventoryRepository,
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
  ],
  exports: [InventoryService, INVENTORY_REPOSITORY],
})
export class InventoryModule {}
