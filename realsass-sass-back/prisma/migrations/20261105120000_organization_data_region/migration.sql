-- ADR-031: región de datos de la organización ('ar' = Argentina, 'us' = Estados Unidos).
-- Columna nueva con default, no destructiva. Las filas existentes se completan según su país.
ALTER TABLE "organizations" ADD COLUMN "data_region" TEXT NOT NULL DEFAULT 'us';

UPDATE "organizations" SET "data_region" = 'ar' WHERE UPPER("country_code") = 'AR';
