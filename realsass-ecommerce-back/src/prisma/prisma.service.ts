import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';
import * as pg from 'pg';
import { withTenant } from '@/prisma/tenant-scope';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  /** Cliente limitado a una organización: inyecta organizationId y rechaza salirse de ella (ADR-029). */
  forTenant(organizationId: string) {
    return withTenant(this, organizationId);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * PrismaTransactionClient — tipo del cliente dentro de $transaction.
 *
 * Con @prisma/adapter-pg, el callback de $transaction recibe un cliente
 * que en runtime tiene todos los modelos de PrismaClient ($executeRaw,
 * .cart, .order, .inventory, etc.). El tipo generado Prisma.TransactionClient
 * no los expone porque es el tipo del cliente interactivo sin adaptador.
 *
 * Usamos Omit para quitar los métodos de ciclo de vida que no están
 * disponibles dentro de una transacción ($connect, $disconnect, $transaction).
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * ÚNICO punto donde el cliente interactivo de `$transaction` se convierte en `PrismaTransactionClient`.
 *
 * Con `@prisma/adapter-pg` el callback de `$transaction` recibe, en runtime, un cliente con todos los modelos, pero su
 * tipo generado (`Prisma.TransactionClient`) no los expone (ver el comentario de `PrismaTransactionClient`). Antes
 * había un `as unknown as` repetido en cada llamador; ahora hay uno solo, acá, justificado.
 */
export function toTransactionClient(raw: unknown): PrismaTransactionClient {
  return raw as PrismaTransactionClient; // @real/cast:sdk el tipo generado por Prisma omite los modelos que el adaptador sí provee
}
