import type { DocKind } from './types'

/** Metadatos de presentación de cada tipo Diátaxis (norte 12 §2). */
export const KIND_META: Record<DocKind, { label: string; question: string; description: string; className: string }> = {
  tutorial: {
    label: 'Tutorial',
    question: 'Quiero aprender',
    description: 'Un camino guiado con un resultado visible al final.',
    className: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-violet-500/30',
  },
  'how-to': {
    label: 'Guía',
    question: 'Quiero resolver algo',
    description: 'Los pasos para una tarea concreta, sin teoría de más.',
    className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/30',
  },
  reference: {
    label: 'Referencia',
    question: 'Quiero consultar',
    description: 'Información completa y ordenada, para buscar un dato.',
    className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  },
  explanation: {
    label: 'Explicación',
    question: 'Quiero entender por qué',
    description: 'El contexto y las decisiones detrás de cada parte.',
    className: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  },
}
