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

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/** Cliente dentro de `$transaction` con todos los modelos (el tipo generado con adaptador no los expone). */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** ÚNICO punto donde el cliente interactivo de `$transaction` se convierte en `PrismaTransactionClient`. */
export function toTransactionClient(raw: unknown): PrismaTransactionClient {
  return raw as PrismaTransactionClient; // @real/cast:sdk el tipo generado por Prisma omite los modelos que el adaptador sí provee
}
