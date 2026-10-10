-- D3 (domain/flows/owner-organizacion.md): un usuario puede ser dueño de varias organizaciones.
-- Cambio no destructivo: se reemplaza el índice único de userId por uno común.
DROP INDEX "organizations_userId_key";
CREATE INDEX "organizations_userId_idx" ON "organizations"("userId");
