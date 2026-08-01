/**
 * @real/trpc — AppRouter opaco
 *
 * AppRouter se declara como tipo opaco para que Next.js no intente
 * compilar el árbol de dependencias del backend (NestJS, class-validator).
 * En runtime tRPC solo necesita la URL — los tipos son solo para inferencia.
 */
import type { AnyRouter } from '@trpc/server';

// Tipo opaco que representa AppRouter sin importar el backend.
// Next.js no puede compilar decoradores de NestJS (emitDecoratorMetadata).
// El cliente tRPC funciona igual — solo usa la URL para los requests.
export type AppRouter = AnyRouter;