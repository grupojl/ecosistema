/**
 * cross-tenant.spec.ts
 *
 * Tests de seguridad multi-tenant.
 * PRIORIDAD MÁXIMA — un fallo aquí es una filtración de datos entre clientes.
 *
 * Patrón:
 *   1. Crear dos organizaciones (A y B) con datos distintos
 *   2. Autenticar como miembro de org A
 *   3. Intentar acceder a datos de org B
 *   4. Verificar: 0 resultados (no data ajena, no 403 que revela existencia)
 */

// TODO: implementar usando Supertest + PrismaService de test
// Guía en .claude/checklists/tests-roadmap.md

describe('Cross-tenant security', () => {
  it.todo('org A no puede ver datos de org B');
  it.todo('colaborador sin permiso recibe 403');
  it.todo('query sin organizationId es rechazado');
  it.todo('org A no puede modificar datos de org B');
});
