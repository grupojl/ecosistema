'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthProvider as BaseAuthProvider } from '@/context/auth-context'
import type { ReactNode } from 'react'

function AuthProviderInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const refCode = searchParams?.get('ref') ?? undefined
  return <BaseAuthProvider refCode={refCode}>{children}</BaseAuthProvider>
}

// Suspense es obligatorio porque useSearchParams requiere un boundary
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </Suspense>
  )
}