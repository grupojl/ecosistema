# 12 — Norte: documentación del ecosistema (docs-front)

> Los referentes mundiales de documentación de producto y qué tomamos de cada uno.
> Leer antes de tocar `realsass-docs-front`, el modelo de contenido o el editor de
> superadmin. Decisión formal: ADR-020.

## El norte en una línea

**Stripe Docs** (calidad y experiencia) · **Diátaxis** (estructura del contenido) ·
**Google Developer Documentation Style Guide** (cómo se escribe) ·
**Markdoc** (formato de contenido seguro) · **Sanity / Contentful** (modelo de CMS headless)

**Principio unificador:** *el contenido es dato, no código: lo edita el superadmin,
lo versiona el sistema y el front solo lo renderiza.*

---

## 1. Stripe Docs — la experiencia

**Qué resolvieron:** documentación de un producto complejo que se lee de corrido
(guías) y se consulta de a saltos (referencia), con ejemplos de código copiables.

**Qué adoptamos:**
- Layout de 3 columnas: navegación · contenido · "en esta página".
- Bloques de código con copia, callouts, pasos numerados.
- Anterior / Siguiente al final de cada página.

**Qué NO copiamos (todavía):** ejemplos de código en el idioma del lector,
API explorer interactivo, búsqueda semántica.

**Señal de cumplimiento:** un integrador llega de la home a su primer "hola mundo"
sin salir de las docs.

---

## 2. Diátaxis — la estructura

**Qué resolvieron:** las docs se pudren cuando un mismo texto mezcla enseñar,
resolver y consultar. Diátaxis separa cuatro necesidades distintas del lector.

| Tipo | Pregunta del lector | Forma |
|---|---|---|
| `tutorial` | "Quiero aprender" | Camino guiado, un resultado visible al final |
| `how-to` | "Quiero resolver X" | Pasos para una tarea concreta, sin teoría |
| `reference` | "Quiero consultar" | Seca, completa, ordenada como el sistema |
| `explanation` | "Quiero entender por qué" | Contexto, decisiones, alternativas |

**Qué adoptamos:** `kind` es un campo obligatorio de cada página. El front lo
muestra como badge y el editor lo exige.

**Señal de cumplimiento:** ninguna página puede publicarse sin `kind`.

---

## 3. Google Developer Documentation Style Guide — la redacción

**Qué adoptamos** (checklist de revisión, no código):
- Voz activa, segunda persona, presente.
- Título descriptivo que dice qué vas a lograr.
- Un ejemplo real antes que una definición abstracta.
- Una idea por párrafo; listas para pasos.

---

## 4. Markdoc — el formato

**Qué resolvieron:** Stripe necesitaba que contenido escrito por humanos se
renderice con componentes propios **sin ejecutar código del autor**.

**Por qué no MDX:** MDX compila JavaScript. Si el contenido viene de la base de datos
y lo escribe un humano, MDX equivale a ejecutar código arbitrario con nuestros
permisos en el servidor. Markdoc es Markdown con *tags* declarativos y una lista
cerrada de nodos y componentes.

**Qué adoptamos:**
- El contenido se guarda como texto Markdoc.
- El front mantiene una **whitelist** de tags: `callout`, `steps`, `step`, `tabs`,
  `tab`, `badge`. Un tag fuera de la lista falla la validación al **guardar**
  (en superadmin) y se omite al **renderizar** (en el front).
- El HTML crudo no se renderiza nunca.

**Señal de cumplimiento:** un tag desconocido en un borrador nunca llega a
producción como JavaScript ni como HTML sin sanitizar.

---

## 5. Sanity / Contentful — el modelo de CMS

**Qué adoptamos:**
- Ciclo `draft` → `published`. El front solo lee `published`.
- Historial de versiones por página.
- Vista previa de un borrador antes de publicar.
- Al publicar se invalida la caché por tag; no hay redeploy del front.

---

## Reglas no negociables

```
Contenido   Markdoc en DB. Nunca MDX, nunca HTML crudo. Tags en whitelist
Estructura  Toda página declara kind: tutorial | how-to | reference | explanation
Estados     draft → published, con versiones. El front solo lee published
Transporte  tRPC server caller (como el resto). Ningún fetch manual
Cache       ISR + revalidateTag al publicar desde superadmin
URL/idioma  /{es|pt|en}/docs/{seccion}/{slug}. Reglas de ADR-016
Errores     NOT_FOUND → 404 · cualquier otra falla → 5xx
Acceso      Lectura pública. Edición solo desde superadmin (RBAC)
Mock        Sin contenido hardcodeado en componentes: todo pasa por DocsRepository
```

## Modelo de contenido (contrato objetivo)

```ts
type DocKind = 'tutorial' | 'how-to' | 'reference' | 'explanation'

interface DocPage {
  slug: string            // 'primeros-pasos/crear-organizacion'
  section: string         // 'primeros-pasos'
  locale: 'es' | 'pt' | 'en'
  kind: DocKind
  title: string
  description: string
  body: string            // Markdoc
  order: number
  status: 'draft' | 'published'
  updatedAt: string       // ISO
}
```

Este shape es el que el router tRPC `docs` deberá devolver. Hasta que exista, el
front lo consume por la interfaz `DocsRepository` (`lib/docs/repository.ts`) con
una implementación mock marcada como temporal.

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| F0 | Maqueta del front con `DocsRepository` mock | hecha |
| F1 | Lectura desde superadmin (ADR-021, REST interno en vez de tRPC) | hecha, sin probar contra superadmin real |
| F2 | Editor en superadmin (ADR-024 de superadmin) | hecha sin preview |
| F3 | Búsqueda, i18n completo (es/pt/en), hreflang | pendiente |

## Preguntas abiertas

1. ¿Qué backend es dueño del contenido? (hoy, ninguno)
2. ¿Hay una sección privada para colaboradores autenticados o todo es público?
3. ¿Se importa la documentación de `.claude/` como contenido inicial?
