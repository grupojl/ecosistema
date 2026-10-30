import { Module } from '@nestjs/common';
import { OrdersService } from '@/orders/orders.service';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { ORDERS_REPOSITORY } from '@/orders/repository/orders.repository.interface';
import { ActivityModule } from '@/activity/activity.module';
import { InventoryModule } from '@/inventory/inventory.module';
import { OutboxModule } from '@/outbox/outbox.module';

@Module({
  imports: [ActivityModule, InventoryModule, OutboxModule],
  providers: [
    OrdersService,
    PrismaOrdersRepository,
    { provide: ORDERS_REPOSITORY, useClass: PrismaOrdersRepository },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
