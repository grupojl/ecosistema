import type { OwnDictionary } from './types';

export const fr = {
  nav: {
    userMenu:       'Menu utilisateur',
    profile:        'Mon profil',
    signOut:        'Se déconnecter',
    signIn:         'Se connecter',
    loadingSession: 'Chargement de la session',
    avatarAlt:      'Avatar',
  },
  login: {
    title:               'Accédez à votre espace',
    description:         "Choisissez comment vous connecter. Si c'est votre première fois, nous créons votre compte automatiquement.",
    continueWithApple:   'Continuer avec Apple',
    continueWithFacebook: 'Continuer avec Facebook',
  },
} satisfies OwnDictionary;
