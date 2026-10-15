import Markdoc, { type Config, type RenderableTreeNode, Tag, nodes } from '@markdoc/markdoc'

/**
 * Whitelist de contenido (ADR-020, norte 12 §4).
 *
 * Solo existen los nodos y tags declarados acá. Un tag desconocido en el body no se
 * ejecuta ni se renderiza como HTML: Markdoc lo descarta. El contenido NUNCA es MDX
 * ni HTML crudo.
 */

export interface DocHeading {
  id: string
  level: number
  title: string
}

export function textOf(children: RenderableTreeNode[]): string {
  return children
    .map((child) => {
      if (typeof child === 'string') return child
      if (Tag.isTag(child)) return textOf(child.children)
      return ''
    })
    .join('')
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const CALLOUT_TYPES = ['note', 'tip', 'warning', 'danger'] as const

export const markdocConfig: Config = {
  nodes: {
    heading: {
      ...nodes.heading,
      render: 'Heading',
      transform(node, config) {
        const children = node.transformChildren(config)
        const id = slugify(textOf(children))
        return new Tag('Heading', { level: node.attributes.level, id }, children)
      },
    },
    fence: {
      render: 'CodeBlock',
      attributes: {
        content: { type: String, required: true },
        language: { type: String },
      },
    },
    link: { ...nodes.link, render: 'DocLink' },
    table: { ...nodes.table, render: 'DocTable' },
  },
  tags: {
    callout: {
      render: 'Callout',
      attributes: {
        type: { type: String, default: 'note', matches: [...CALLOUT_TYPES] },
        title: { type: String },
      },
    },
    steps: { render: 'Steps' },
    step: {
      render: 'Step',
      attributes: { title: { type: String, required: true } },
    },
    tabs: {
      render: 'Tabs',
      transform(node, config) {
        const labels = node.children
          .filter((child) => child.type === 'tag' && child.tag === 'tab')
          .map((child) => String(child.attributes.label ?? ''))
        return new Tag('Tabs', { labels }, node.transformChildren(config))
      },
    },
    badge: {
      render: 'InlineBadge',
      attributes: { color: { type: String } },
    },
    tab: {
      render: 'Tab',
      attributes: { label: { type: String, required: true } },
    },
  },
}

/** Recorre el árbol renderizable y junta los h2/h3 para la tabla de contenidos. */
export function collectHeadings(node: RenderableTreeNode): DocHeading[] {
  if (!Tag.isTag(node)) return []
  const own: DocHeading[] = []
  if (node.name === 'Heading') {
    const level = Number(node.attributes.level)
    if (level === 2 || level === 3) {
      own.push({ id: String(node.attributes.id), level, title: textOf(node.children) })
    }
  }
  return [...own, ...node.children.flatMap(collectHeadings)]
}

export { Markdoc }
