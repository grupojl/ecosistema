# Checklist: activar Bull Board en sass-back

**E8-02 — Fase 3 Hardening**

## Pasos para activar

1. Instalar dependencias:
   ```bash
   pnpm --filter realsass-sass-back add @bull-board/api @bull-board/nestjs @bull-board/express
   ```

2. Importar en `realsass-sass-back/src/app.module.ts`:
   ```ts
   import { BullBoardAppModule } from '@/bull-board/bull-board.module';
   // Agregar en imports[]:
   BullBoardAppModule,
   ```

3. Verificar acceso (requiere INTERNAL_API_KEY en header):
   ```bash
   curl -H "x-api-key: $INTERNAL_API_KEY" \
     https://<sass-back-url>/api/v1/admin/queues
   ```

4. La ruta está protegida por ApiKeyGuard — el mismo guard de `/internal/*`.

## Estado: ⏳ Pendiente instalar dependencias
