# 07 — Reglas de deploy en Railway para monorepos pnpm

> Reglas específicas de Railway que contradicen guías genéricas de Docker.
> Aplica a los tres monorepos: `superadmin`, `ecosistema`, `ecosistema-ms`.

---

## Configuración en Railway — reglas fijas

```
Root Directory: /                         ← raíz del monorepo, siempre
Dockerfile Path: <servicio>/Dockerfile    ← relativo a la raíz
Build Command: (vacío)
Start Command: (vacío)
```

**No usar Root Directory por servicio** — `pnpm install` no puede resolver los
packages locales del workspace sin la raíz.

---

## Cache mounts en Railway

**No persisten entre builds** — Railway usa runners efímeros.
El beneficio viene de la estructura de layers, no de los mounts.
Se mantienen en el Dockerfile porque sí ayudan en local y GitHub Actions.

| Entorno | Cache mount persiste |
|---------|---------------------|
| Docker Desktop local | ✅ sí |
| GitHub Actions | ✅ sí (con `actions/cache`) |
| Railway | ❌ no |

---

## Variables de entorno

**Backend** — variables de runtime, configuradas en Railway como variables del servicio.

**Frontend** — `NEXT_PUBLIC_*` deben estar en Railway como **build variables** además
de runtime. Si solo se configuran como runtime, el bundle tendrá `undefined`.

---

## Health checks

- Todo backend: `GET /health` → `200` en < 200ms
- Railway apunta a `/health`, no a `/`
- `HOSTNAME=0.0.0.0` obligatorio en frontends Next.js standalone

---

## Redeploy sin cambios de código

```bash
make git-empty
# o:
git commit --allow-empty -m "chore: force redeploy [$(date +%Y-%m-%d)]"
git push
```

---

## Package compartido modificado

Railway no detecta que un servicio necesita rebuild cuando cambia un package del workspace.

```bash
git push
git commit --allow-empty -m "chore: rebuild after shared package update"
git push
```

---

## Resumen vs. guías genéricas

| Guía genérica | En Railway |
|---------------|------------|
| Cache mounts aceleran CI | No persisten — layers importan |
| Root Directory al subdirectorio | Siempre `/` |
| `NEXT_PUBLIC_*` opcionales en build | Obligatorias en build |
| Health check a `/` | Siempre a `/health` |
| HOSTNAME no necesario | `HOSTNAME=0.0.0.0` obligatorio |
