'use client';

import { useEffect } from 'react';

/** Desregistra service workers viejos (antes era un <script> inline en el layout). */
export function SwCleanup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) registration.unregister();
    });
  }, []);
  return null;
}
