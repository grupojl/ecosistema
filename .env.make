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
# [realsass-ecommerce-back] + [realsass-sass-back]
# -----------------------------------------------------------------

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
ECOMMERCE_DB_NAME=ecommerce_db
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
# [realsass-ecommerce-back]
# -----------------------------------------------------------------

PORT_ECOMMERCE_BACK=3003
ECOMMERCE_BACK_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Llamada inter-servicio → realsass-sass-back
ORGANIZATIONS_SERVICE_PREFIX=/api/v1
CONFIG_CACHE_TTL_ORG_ACCESS=30


# -----------------------------------------------------------------
# [realsass-sass-back]
# -----------------------------------------------------------------

PORT_SASS_BACK=3004
SASS_BACK_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002

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
# [real-ecommerce-front]
# -----------------------------------------------------------------

PORT_ECOMMERCE_FRONT=3000

# ID de la organización que sirve este storefront (1 front = 1 org)
NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID=


# -----------------------------------------------------------------
# [realsass-dashboard-front]
# -----------------------------------------------------------------

PORT_DASHBOARD_FRONT=3001


# -----------------------------------------------------------------
# [realsass-sass-front]
# -----------------------------------------------------------------

PORT_SASS_FRONT=3002


# -----------------------------------------------------------------
# [realsass-dashboard-front] + [realsass-sass-front]
# -----------------------------------------------------------------

# Firebase Web SDK (cliente — expuesto en el browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=