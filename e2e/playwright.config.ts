/**
 * Playwright — e2e del ecosistema (DT-TEST-04). Levanta el stack REAL en local, sin mocks de backend:
 *   emulador de Firebase Auth (9099) + sass-back (3027) + ecommerce-back (3026) con bases Postgres descartables
 *   sembradas + storefront (3028) + sass-front (3024) + dashboard-front (3029).
 * Firebase real nunca interviene: los backs y los fronts apuntan al emulador de Auth (no requiere Java).
 * Los backs reciben una clave RSA efímera solo para arrancar.
 *
 *   pnpm e2e            (o: pnpm exec playwright test -c e2e/playwright.config.ts)
 *
 * Necesita: Postgres local (E2E_ADMIN_DATABASE_URL, por defecto postgres:postgres@localhost:5432) y `pnpm contracts`.
 */
import { defineConfig, devices } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { AUTH_EMULATOR, FIREBASE_PROJECT, INTERNAL_API_KEY, PORTS, dbUrl } from './setup/constants.mjs';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const host = 'http://localhost';
const origin = (port: number) => `${host}:${port}`;
const reuse = !process.env.CI;

const backFirebase = {
  FIREBASE_PROJECT_ID: FIREBASE_PROJECT,
  FIREBASE_CLIENT_EMAIL: `e2e@${FIREBASE_PROJECT}.iam.gserviceaccount.com`,
  FIREBASE_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'),
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR,
};
const frontFirebase = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'e2e-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${FIREBASE_PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: FIREBASE_PROJECT,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${FIREBASE_PROJECT}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:1:web:e2e',
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR,
};
const allowedOrigins = [PORTS.storefront, PORTS.sassFront, PORTS.dashboardFront].map(origin).join(',');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Los flujos con login comparten el emulador y las bases: se ejecutan de a uno. El storefront público es de solo lectura.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: origin(PORTS.storefront),
    locale: 'es-AR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /auth-.*\.spec\.ts/ },
  ],
  webServer: [
    {
      name: 'firebase-auth',
      command: `pnpm exec firebase emulators:start --only auth --project ${FIREBASE_PROJECT} --config e2e/firebase/firebase.json`,
      cwd: '..',
      url: `http://${AUTH_EMULATOR}`,
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      name: 'sass-back',
      command: 'node e2e/setup/prepare.mjs sass && pnpm --filter realsass-sass-back exec nest build && node realsass-sass-back/dist/main.js',
      cwd: '..',
      url: `${origin(PORTS.sass)}/health`,
      reuseExistingServer: reuse,
      timeout: 240_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(PORTS.sass),
        DATABASE_URL: dbUrl('welver_sass_e2e'),
        ALLOWED_ORIGINS: allowedOrigins,
        INTERNAL_API_KEY,
        CONFIG_MASTER_KEY: '0'.repeat(64),
        DASHBOARD_FRONT_URL: origin(PORTS.dashboardFront),
        REDIS_ENABLED: process.env.E2E_REDIS_URL ? 'true' : 'false',
        // La cola de webhooks (BullMQ) SIEMPRE necesita Redis; sin E2E_REDIS_URL solo hay ruido de ECONNREFUSED en los logs.
        ...(process.env.E2E_REDIS_URL ? { REDIS_URL: process.env.E2E_REDIS_URL } : {}),
        LOG_LEVEL: 'warn',
        ...backFirebase,
      },
    },
    {
      name: 'ecommerce-back',
      command: 'node e2e/setup/prepare.mjs ecommerce && pnpm --filter realsass-ecommerce-back exec nest build && node realsass-ecommerce-back/dist/main.js',
      cwd: '..',
      url: `${origin(PORTS.ecommerce)}/api/v1/health`,
      reuseExistingServer: reuse,
      timeout: 240_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(PORTS.ecommerce),
        DATABASE_URL: dbUrl('welver_ecommerce_e2e'),
        ALLOWED_ORIGINS: allowedOrigins,
        SASS_BACK_URL: origin(PORTS.sass),
        ORGANIZATIONS_SERVICE_URL: origin(PORTS.sass),
        ORGANIZATIONS_SERVICE_PREFIX: '/api/v1',
        INTERNAL_API_KEY,
        REDIS_ENABLED: 'false',
        OUTBOX_ENABLED: 'true',
        LOG_LEVEL: 'warn',
        ...backFirebase,
      },
    },
    {
      name: 'storefront',
      command: `pnpm --filter real-ecommerce-front exec next dev -p ${PORTS.storefront}`,
      cwd: '..',
      url: `${origin(PORTS.storefront)}/robots.txt`,
      reuseExistingServer: reuse,
      timeout: 180_000,
      env: {
        ECOMMERCE_BACK_URL: origin(PORTS.ecommerce),
        NEXT_PUBLIC_ECOMMERCE_BACK_URL: origin(PORTS.ecommerce),
        NEXT_PUBLIC_ECOMMERCE_API_URL: origin(PORTS.ecommerce),
        SITE_URL: origin(PORTS.storefront),
        ...frontFirebase,
      },
    },
    {
      name: 'sass-front',
      command: `pnpm --filter realsass-sass-front exec next dev -p ${PORTS.sassFront}`,
      cwd: '..',
      url: `${origin(PORTS.sassFront)}/robots.txt`,
      reuseExistingServer: reuse,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: origin(PORTS.sass),
        NEXT_PUBLIC_SASS_BACK_URL: origin(PORTS.sass),
        NEXT_PUBLIC_DASHBOARD_FRONT_URL: origin(PORTS.dashboardFront),
        NEXT_PUBLIC_SITE_URL: origin(PORTS.sassFront),
        ...frontFirebase,
      },
    },
    {
      name: 'dashboard-front',
      command: `pnpm --filter realsass-dashboard-front exec next dev -p ${PORTS.dashboardFront}`,
      cwd: '..',
      url: `${origin(PORTS.dashboardFront)}/robots.txt`,
      reuseExistingServer: reuse,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_SASS_BACK_URL: origin(PORTS.sass),
        NEXT_PUBLIC_REAL_BACK_URL: origin(PORTS.sass),
        NEXT_PUBLIC_ECOMMERCE_API_URL: origin(PORTS.ecommerce),
        ECOMMERCE_BACK_URL: origin(PORTS.ecommerce),
        NEXT_PUBLIC_STORE_FRONT_URL: origin(PORTS.storefront),
        NEXT_PUBLIC_SASS_FRONT_URL: origin(PORTS.sassFront),
        ...frontFirebase,
      },
    },
  ],
});
