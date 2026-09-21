import { Module }                  from "@nestjs/common";
import { OrdersService }           from "./orders.service";
import { PrismaOrdersRepository }  from "./repository/prisma-orders.repository";
import { ORDERS_REPOSITORY }       from "./repository/orders.repository.interface";
import { ActivityModule }          from "../activity/activity.module";
import { InventoryModule }         from "../inventory/inventory.module";

@Module({
  imports:   [ActivityModule, InventoryModule],
  providers: [
    OrdersService,
    PrismaOrdersRepository,
    { provide: ORDERS_REPOSITORY, useClass: PrismaOrdersRepository },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
