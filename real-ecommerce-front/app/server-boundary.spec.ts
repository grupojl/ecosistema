// Frontera servidor/cliente del App Router.
//
// Bug real (2026-10-10): 4 páginas (Server Components) llamaban a useStore(), un hook de contexto de
// cliente => "Attempted to call useStore() from the server". El typecheck no lo ve y el render de
// prueba tampoco (el error lo lanza el bundler de RSC), así que se vigila estáticamente: un archivo
// de app/ que NO declara 'use client' no puede usar hooks de React ni los hooks del contexto de la tienda.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const APP_DIR = __dirname
const SERVER_ENTRY = /^(page|layout|template|not-found|loading|error|default)\.tsx$|^(robots|sitemap)\.ts$/
const CLIENT_HOOK = /\buse(State|Effect|LayoutEffect|Reducer|Context|Store|Router|Pathname|SearchParams|Params|Query|Mutation)\s*\(/
const USE_CLIENT = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const serverFiles = walk(APP_DIR).filter(
  (f) => SERVER_ENTRY.test(path.basename(f)) && !USE_CLIENT.test(readFileSync(f, 'utf8')),
)

describe('frontera servidor/cliente', () => {
  it('hay Server Components para vigilar', () => {
    expect(serverFiles.length).toBeGreaterThan(0)
  })

  it.each(serverFiles.map((f) => [path.relative(APP_DIR, f), f]))(
    '%s (Server Component) no usa hooks de cliente',
    (_rel, file) => {
      const offending = readFileSync(file as string, 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && CLIENT_HOOK.test(line))

      expect(offending).toEqual([])
    },
  )
})
