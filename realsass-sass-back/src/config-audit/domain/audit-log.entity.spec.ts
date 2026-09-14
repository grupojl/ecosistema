/**
 * audit-log.entity.spec.ts — Tests de dominio puro
 *
 * REGLA: este archivo NO puede importar @nestjs/* ni @prisma/client
 * Si lo hace, es un bug de arquitectura — la lógica de dominio está acoplada a infraestructura.
 */

// import { audit-log } from './audit-log.entity';

describe('audit-log domain', () => {
  it.todo('crear entidad con datos válidos');
  it.todo('rechazar datos inválidos con DomainError tipado');
  it.todo('invariantes de negocio se mantienen en update');
});
