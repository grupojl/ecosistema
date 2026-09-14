#!/bin/sh
# entrypoint.sh — ejecuta migraciones Prisma antes de arrancar el servidor
# Railway corre esto con dumb-init como PID 1 wrapper
set -e

echo "[entrypoint] Ejecutando prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Iniciando servidor..."
exec node dist/main
