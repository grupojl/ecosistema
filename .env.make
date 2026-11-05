# =================================================================
# .env.make — FUENTE DE VERDAD DE VARIABLES DEL MONOREPO
# Editá acá. Luego corré:  make env
# ⚠  Agregá al .gitignore si ponés secrets reales
# =================================================================


# -----------------------------------------------------------------
# [TODOS LOS PROYECTOS]
# -----------------------------------------------------------------
NODE_ENV=development


# -----------------------------------------------------------------
# [realsass-sass-back]
# -----------------------------------------------------------------

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
SASS_DB_NAME=sass_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=change-me-in-production-min-32-chars
JWT_REFRESH_SECRET=change-me-refresh-in-production-32c
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Firebase Admin SDK (servidor)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=


# -----------------------------------------------------------------
# [realsass-sass-back]
# -----------------------------------------------------------------

PORT_SASS_BACK=3004
SASS_BACK_ALLOWED_ORIGINS=http://localhost:3021,http://localhost:3022

# Cifrado de secretos — generar con: openssl rand -hex 32
CONFIG_MASTER_KEY=

# Cache TTLs (segundos)
CONFIG_CACHE_TTL_THEME=300
CONFIG_CACHE_TTL_FLAGS=60
CONFIG_CACHE_TTL_TEMPLATES=120
CONFIG_CACHE_TTL_QUOTAS=10

# Webhooks
WEBHOOK_DELIVERY_TIMEOUT=5000
WEBHOOK_MAX_RETRIES=3


# -----------------------------------------------------------------
# [realsass-dashboard-front]
# -----------------------------------------------------------------

PORT_DASHBOARD_FRONT=3021


# -----------------------------------------------------------------
# [realsass-sass-front]
# -----------------------------------------------------------------

PORT_SASS_FRONT=3022


# -----------------------------------------------------------------
# [realsass-dashboard-front] + [realsass-sass-front]
# -----------------------------------------------------------------

# Firebase Web SDK (cliente — expuesto en el browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=