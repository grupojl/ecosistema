import { Module } from '@nestjs/common';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import { OrganizationsModule } from '@/organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
