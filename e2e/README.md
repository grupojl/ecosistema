# e2e — Playwright contra el stack real

Levanta **el ecosistema real** en local, sin mocks de backend: emulador de Firebase Auth (9099), sass-back (3027) con una base Postgres descartable sembrada, y los dos fronts (sass-front 3024, dashboard 3029). Recorre la UI en un navegador real (escritorio y Pixel 7).

El emulador de **Auth** corre en Node: **no hace falta Java** (solo Firestore/Storage lo piden). Firebase real nunca interviene; los backs reciben una clave RSA efímera solo para arrancar.

```bash
pnpm contracts          # prisma generate + @real/trpc build (una vez, o tras cambiar routers)
pnpm exec playwright install chromium
pnpm e2e                # todo (≈2 min)
pnpm e2e --project=desktop -g "Dispositivos"
```

Necesita un Postgres local (por defecto `postgres:postgres@localhost:5432`; sobrescribible con `E2E_ADMIN_DATABASE_URL`). `e2e/setup/prepare.mjs` crea `welver_sass_e2e` desde cero y **se niega a correr contra un host que no sea local**. Si el stack ya está levantado (por ejemplo de una corrida anterior), Playwright lo reutiliza fuera de CI; para forzar un arranque limpio, bajá los procesos de los puertos 3024, 3027, 3029 y 9099.

Con `E2E_REDIS_URL` el sass-back usa un Redis real para la cola de webhooks (el job de CI lo hace). Sin Redis local funciona igual, con ruido de `ECONNREFUSED` en los logs del sass-back.

## Qué cubre

| Archivo | Flujo |
|---|---|
| `auth-owner.spec.ts` | Dueño: login en sass-front → usuario y organización por defecto → **sesión compartida** con el dashboard → «Dispositivos» → cerrar sesión en todos los fronts; **cerrar OTRA sesión**: la cookie vieja da 401, el dispositivo cerrado no vuelve a entrar solo y sí puede con un login nuevo |
| `auth-referrals.spec.ts` | Referidos: todo usuario nace con perfil de afiliado; quien entra por `?ref=` queda asentado y suma al contador (una sola vez) |

## Cómo agregar un escenario

- Datos sembrados: `setup/prepare.mjs` (un usuario dueño y un municipio de prueba). Si un test necesita otros datos, agregarlos ahí: la base se recrea en cada arranque.
- Login: `tests/helpers/emulator.ts` (`signInWithGoogleViaEmulator`, `signInExistingViaEmulator` para un segundo dispositivo, `emulatorIdToken` para llamar al back como esa persona).
- Importar `test`/`expect` de `tests/helpers/diagnostics`: adjunta al reporte los errores de consola y las respuestas ≥ 400 **solo si el test falla**.
- Hacer los tests **relativos al estado previo** (la base persiste entre repeticiones de una misma corrida) y con emails únicos (`uniqueEmail`).
