import React, { type ReactNode } from 'react'
import { Callout, DocLink, DocTable, Heading, InlineBadge, Step, Steps } from '@/components/markdoc/blocks'
import { CodeBlock, Tab, Tabs } from '@/components/markdoc/interactive'
import { Markdoc, collectHeadings, markdocConfig, type DocHeading } from './config'

const components = { Heading, InlineBadge, Callout, Steps, Step, DocLink, DocTable, CodeBlock, Tabs, Tab }

export interface RenderedDoc {
  content: ReactNode
  headings: DocHeading[]
}

/**
 * Markdoc → React, solo con los componentes de la whitelist.
 * Un tag fuera de la lista se reporta y se descarta; nunca llega como HTML.
 */
export function renderDoc(body: string): RenderedDoc {
  const ast = Markdoc.parse(body)

  const problems = Markdoc.validate(ast, markdocConfig).filter(
    ({ error }) => error.level === 'error' || error.level === 'critical',
  )
  if (problems.length > 0) {
    console.error('[docs] contenido con tags inválidos:', problems.map(({ error }) => error.message))
  }

  const tree = Markdoc.transform(ast, markdocConfig)
  const nodes = Array.isArray(tree) ? tree : [tree]

  return {
    content: Markdoc.renderers.react(tree, React, { components }),
    headings: nodes.flatMap(collectHeadings),
  }
}
