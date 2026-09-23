import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Global() // disponible en toda la app sin reimportar
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
