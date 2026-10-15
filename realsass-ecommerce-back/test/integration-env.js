// Apunta el PrismaService (y Redis) a las bases de pruebas y se niega a correr si no hay o si no parecen locales/efímeras.
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL es obligatoria para los tests de integración (ver jest.integration.config.js).');
}
if (!/@(localhost|127\.0\.0\.1|postgres|db)[:/]/.test(url)) {
  throw new Error('TEST_DATABASE_URL no parece una base local/efímera: se rechaza para no truncar datos reales.');
}
process.env.DATABASE_URL = url;

// ADR-027: el spec de Row Level Security se conecta con el rol de aplicación (eco_app, sin SUPERUSER ni BYPASSRLS).
// Con el administrador (TEST_DATABASE_URL) las políticas no se aplican, así que ese spec no probaría nada.
const appUrl = process.env.TEST_APP_DATABASE_URL;
if (appUrl) {
  if (!/@(localhost|127\.0\.0\.1|postgres|db)[:/]/.test(appUrl)) {
    throw new Error('TEST_APP_DATABASE_URL no parece una base local/efímera: se rechaza.');
  }
} else if (process.env.CI) {
  throw new Error('TEST_APP_DATABASE_URL es obligatoria en el CI (los tests de RLS no pueden saltearse en silencio).');
}

// Redis es opcional en local (los specs de redis se saltean con aviso) y obligatorio en el CI.
// OJO: el RedisService de ecommerce-back lee REDIS_ENABLED al cargar el módulo, por eso se define acá (setupFiles).
const redis = process.env.TEST_REDIS_URL;
if (redis) {
  if (!/^redis:\/\/([^@/]*@)?(localhost|127\.0\.0\.1|redis)(:\d+)?(\/\d+)?$/.test(redis)) {
    throw new Error('TEST_REDIS_URL no parece un Redis local/efímero: se rechaza para no tocar un Redis compartido.');
  }
  process.env.REDIS_URL = redis;
  process.env.REDIS_ENABLED = 'true';
} else if (process.env.CI) {
  throw new Error('TEST_REDIS_URL es obligatoria en el CI (los tests de Redis no pueden saltearse en silencio).');
} else {
  process.env.REDIS_ENABLED = 'false';
}
