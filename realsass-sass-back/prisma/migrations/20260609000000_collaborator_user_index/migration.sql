-- Asegurar índice en collaborators.userId para query de colaboraciones del usuario
CREATE INDEX IF NOT EXISTS "collaborators_userId_idx" ON "collaborators"("userId");
