import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
