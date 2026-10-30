'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui'

const WIDTHS = { compact: 390, medium: 720, expanded: 1100 } as const
type Cls = keyof typeof WIDTHS

export function DevicePreview() {
  const [cls, setCls] = useState<Cls>('compact')
  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Clase de tamaño"
        value={cls}
        onValueChange={setCls}
        options={[
          { value: 'compact', label: `Compact · ${WIDTHS.compact}` },
          { value: 'medium', label: `Medium · ${WIDTHS.medium}` },
          { value: 'expanded', label: `Expanded · ${WIDTHS.expanded}` },
        ]}
      />
      <div className="overflow-x-auto rounded-lg border bg-muted p-3">
        <iframe
          title={`Vista previa ${cls}`}
          src="/"
          loading="lazy"
          className="mx-auto block h-[600px] max-w-none rounded-md border bg-background"
          style={{ width: WIDTHS[cls] }}
        />
      </div>
    </div>
  )
}
