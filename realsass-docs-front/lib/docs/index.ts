import { internalDocsRepository } from './internal-repository'
import type { DocsRepository } from './repository'

/** Punto único de resolución del repositorio. */
export const docs: DocsRepository = internalDocsRepository
