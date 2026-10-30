import type { OwnDictionary } from './types';

export const de = {
  nav: {
    userMenu:       'Benutzermenü',
    profile:        'Mein Profil',
    signOut:        'Abmelden',
    signIn:         'Anmelden',
    loadingSession: 'Sitzung wird geladen',
    avatarAlt:      'Avatar',
  },
  login: {
    title:               'Melde dich in deinem Bereich an',
    description:         'Wähle, wie du dich anmelden möchtest. Beim ersten Mal erstellen wir dein Konto automatisch.',
    continueWithApple:   'Weiter mit Apple',
    continueWithFacebook: 'Weiter mit Facebook',
  },
} satisfies OwnDictionary;
