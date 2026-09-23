import { Module } from '@nestjs/common';
import { StoreService } from '@/store/store.service';

@Module({
  
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
