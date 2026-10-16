/**
 * Cuándo se renovó por última vez la cookie __session desde este origen.
 *
 * Recargar la página (F5) ejecutaba cada vez toda la cadena de arranque — auth.sync → token → POST /auth/session →
 * auth.me — y POST /auth/session tiene un límite de 10 req/min por IP: con unos cuantos F5 daba 429 y el front
 * quedaba "preparando la sesión". La cookie dura 14 días, así que alcanza con renovarla cada tanto.
 */
const KEY = 'real_session_refreshed_at';
const MAX_AGE_MS = 30 * 60 * 1000;

/** true si hay que (re)crear la cookie: nunca se hizo, pasaron más de 30 min, o el reloj no cuadra. */
export function sessionRefreshDue(): boolean {
  try {
    const t = Number(window.localStorage.getItem(KEY));
    return !t || t > Date.now() || Date.now() - t > MAX_AGE_MS;
  } catch {
    return true; // storage bloqueado: se renueva siempre (comportamiento anterior)
  }
}

export function markSessionRefreshed(): void {
  try { window.localStorage.setItem(KEY, String(Date.now())); } catch { /* sin storage */ }
}

export function clearSessionRefreshed(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* sin storage */ }
}
