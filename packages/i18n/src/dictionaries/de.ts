import type { CommonDictionary } from './types';

export const de = {
  common: {
    save:     'Speichern',
    cancel:   'Abbrechen',
    close:    'Schließen',
    back:     'Zurück',
    retry:    'Erneut versuchen',
    loading:  'Wird geladen…',
    language: 'Sprache',
  },
  auth: {
    signInHint:         'Melde dich mit dem Gmail deiner Organisation an',
    continueWithGoogle: 'Weiter mit Google',
    continueInBrowser:  'Im Browser fortfahren',
    browserNote:        'Dein Browser wird geöffnet, damit du dich sicher anmelden kannst.',
    verifyingSession:   'Sitzung wird überprüft…',
    connecting:         'Verbindung wird hergestellt…',
    lastUsed:           'Zuletzt verwendet',
    signedInTitle:      'Angemeldet',
    signedInText:       'Wir bringen dich gleich zu deinem Bereich.',
    popupBlocked: { title: 'Dein Browser hat das Fenster blockiert', text: 'Erlaube Pop-ups für diese Seite und versuche es erneut.' },
    accountExists: { title: 'Diese E-Mail hat bereits ein Konto', text: 'Melde dich mit der Methode an, die du beim ersten Mal verwendet hast. Die anderen kannst du danach verknüpfen.' },
    network: { title: 'Keine Verbindung', text: 'Prüfe deine Internetverbindung und versuche es erneut. Es ist nichts verloren gegangen.' },
    unauthorizedDomain: { title: 'Diese Seite ist nicht autorisiert', text: 'Sag dem Team Bescheid, damit die Domain freigeschaltet wird.' },
    tooManyRequests: { title: 'Zu viele Versuche', text: 'Warte eine Minute, bevor du es erneut versuchst.' },
    generic: { title: 'Anmeldung nicht möglich', text: 'Versuche es in ein paar Sekunden erneut. Deine Daten sind sicher.' },
  },
} satisfies CommonDictionary;
