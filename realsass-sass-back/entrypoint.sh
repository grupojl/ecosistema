#!/bin/sh
set -e

# La imagen copia node_modules a /app/node_modules (un nivel arriba del servicio), no al
# directorio de trabajo: se agrega su .bin al PATH para encontrar el CLI de Prisma.
cd "$(dirname "$0")"
# Sin hoisting, el CLI de Prisma está en el .bin del propio servicio (no en el de la raíz).
export PATH="$(pwd)/node_modules/.bin:$(pwd)/../node_modules/.bin:$PATH"

echo "[entrypoint] Running prisma migrate deploy..."
prisma migrate deploy

echo "[entrypoint] Starting server..."
exec node dist/main.js
