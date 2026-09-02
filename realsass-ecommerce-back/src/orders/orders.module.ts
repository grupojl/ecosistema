import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [InventoryModule, ActivityModule],
  
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
