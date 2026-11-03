import { z } from 'zod';
import type { Prisma } from '@/generated/prisma';

/**
 * Borde con las columnas `Json` de Prisma (norte de tipos, ADR-030).
 *
 * Escribir un objeto de dominio (`Record<string, unknown>`) en una columna Json NO necesita `as`: se valida que sea
 * serializable a JSON con Zod y el resultado ya tiene el tipo que Prisma espera. Si el objeto trae algo que JSON no
 * puede representar (una función, un Date, `undefined` anidado…), falla acá con un error claro en vez de en la base.
 */
const JsonObject = z.record(z.string(), z.json());

export function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JsonObject.parse(value);
}

/** Estrechamiento sin `as`: ¿es un objeto simple (no null, no arreglo)? */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
