-- Migration: add_user_profile_fields
-- Agrega displayName y avatarUrl al modelo User
-- Estos campos existen en el schema.prisma pero faltaban en la DB

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl"   TEXT,
  ADD COLUMN IF NOT EXISTS "referredByCode" TEXT;
