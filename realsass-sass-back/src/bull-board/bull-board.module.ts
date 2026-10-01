/**
 * bull-board.module.ts — realsass-sass-back
 *
 * Dashboard visual para monitorear la queue de webhook-delivery.
 * Accesible en /api/v1/admin/queues — protegido con ApiKeyGuard.
 *
 * Requiere instalar:
 *   pnpm --filter realsass-sass-back add @bull-board/api @bull-board/nestjs @bull-board/express
 *
 * Ruta: GET /api/v1/admin/queues
 * Auth: header x-api-key: <INTERNAL_API_KEY>
 *
 * E8-02 — Fase 3 Hardening
 *
 * NOTA: este módulo está preparado pero requiere instalar las dependencias
 * antes de importarlo en app.module.ts. Ver comentario en app.module.ts.
 */
import { Module }         from '@nestjs/common';
import { BullBoardModule, BullBoardController } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter }  from '@bull-board/api/bullMQAdapter';
import { BullModule }     from '@nestjs/bullmq';
import { WEBHOOK_QUEUE }  from '@/config-webhooks/webhook-delivery.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    BullBoardModule.forRoot({
      route:   '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name:    WEBHOOK_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [BullBoardController],
})
export class BullBoardAppModule {}
