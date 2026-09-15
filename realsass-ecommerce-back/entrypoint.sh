#!/bin/sh
# entrypoint.sh — corre prisma migrate deploy antes de arrancar el servidor
# Se ejecuta con dumb-init para manejar señales correctamente en Docker
set -e

echo "[entrypoint] Corriendo prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Arrancando servidor..."
exec node dist/main.js
