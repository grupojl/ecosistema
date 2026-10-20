/**
 * Pista local del último usuario visto (iniciales y foto) para pintar el avatar en el primer cuadro, mientras la sesión real
 * se verifica con el back. NO es una sesión ni da acceso a nada: si la verificación dice que no hay sesión, se descarta.
 * Solo guarda lo que el navbar ya muestra; sin tokens ni ids.
 */
const KEY = 'welver.sass.auth-hint'

export interface AuthHint {
  initials: string
  photoUrl: string | null
}

export function readAuthHint(storage: Pick<Storage, 'getItem'> | null | undefined): AuthHint | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<AuthHint>
    if (typeof v.initials !== 'string' || v.initials.length === 0 || v.initials.length > 4) return null
    // La foto solo se acepta si es https: viene de un almacenamiento que cualquier script del origen puede tocar.
    const photoUrl = typeof v.photoUrl === 'string' && v.photoUrl.startsWith('https://') ? v.photoUrl : null
    return { initials: v.initials, photoUrl }
  } catch { return null }
}

export function writeAuthHint(storage: Pick<Storage, 'setItem'> | null | undefined, hint: AuthHint): void {
  try { storage?.setItem(KEY, JSON.stringify(hint)) } catch { /* sin almacenamiento: simplemente no hay pista */ }
}

export function clearAuthHint(storage: Pick<Storage, 'removeItem'> | null | undefined): void {
  try { storage?.removeItem(KEY) } catch { /* idem */ }
}

export function initialsOf(email: string | null | undefined): string {
  return email ? email.slice(0, 2).toUpperCase() : 'U'
}
