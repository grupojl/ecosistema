import { cn } from '@real/ui'
import { KIND_META } from '@/lib/docs/kinds'
import type { DocKind } from '@/lib/docs/types'

export function KindBadge({ kind, className }: { kind: DocKind; className?: string }) {
  const meta = KIND_META[kind]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
