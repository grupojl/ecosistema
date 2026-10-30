'use client'

import { useCallback, useEffect, useState } from 'react'

/** Estado persistido en localStorage (por navegador). Si no hay almacenamiento, vive en memoria. */
export function useStore<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`design:${key}`)
      if (raw) setValue(JSON.parse(raw) as T)
    } catch { /* sin almacenamiento */ }
  }, [key])
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try { window.localStorage.setItem(`design:${key}`, JSON.stringify(v)) } catch { /* idem */ }
      return v
    })
  }, [key])
  return [value, set]
}
