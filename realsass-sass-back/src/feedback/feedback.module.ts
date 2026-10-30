import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { FeedbackService } from '@/feedback/feedback.service';

@Module({
  imports: [PrismaModule],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
