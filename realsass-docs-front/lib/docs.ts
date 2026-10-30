/**
 * lib/docs.ts — lee las páginas de `content/*.md` (solo en el servidor, en build).
 *
 * El orden sale del prefijo numérico del archivo (`01-empezar.md`); el título, del primer `# Título`.
 * El slug es el nombre sin prefijo ni extensión. Esta carpeta es la documentación PARA USUARIOS: la de arquitectura
 * vive en `.claude/` y no se publica.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export interface DocPage {
  slug: string
  title: string
  body: string
}

async function readAll(): Promise<DocPage[]> {
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md')).sort()
  return Promise.all(files.map(async (file) => {
    const body = await readFile(path.join(CONTENT_DIR, file), 'utf8')
    const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '')
    const title = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? slug
    return { slug, title, body }
  }))
}

export const listDocs = readAll

export async function getDoc(slug: string): Promise<DocPage | undefined> {
  return (await readAll()).find((d) => d.slug === slug)
}
