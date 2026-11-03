// Valores compartidos por la preparación de datos, la configuración de Playwright y los tests.
export const ORG_ID = '00000000-0000-4000-8000-0000000000a1';
export const STORE_SLUG = 'e2e-tienda';
export const PORTS = { sass: 3027, ecommerce: 3026, storefront: 3028, sassFront: 3024, dashboardFront: 3029 };
export const INTERNAL_API_KEY = 'e2e-internal-key';
/** Emulador de Firebase Auth (e2e/firebase/firebase.json). */
export const AUTH_EMULATOR = '127.0.0.1:9099';
export const FIREBASE_PROJECT = 'e2e-project';
/** Postgres local descartable (docker-compose o servicio local). Sobrescribible con E2E_ADMIN_DATABASE_URL. */
export const adminUrl = process.env.E2E_ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
export const dbUrl = (db) => {
  const u = new URL(adminUrl);
  u.pathname = `/${db}`;
  return u.toString();
};
