import type { CommonDictionary } from './types';

export const fr = {
  common: {
    save:     'Enregistrer',
    cancel:   'Annuler',
    close:    'Fermer',
    back:     'Retour',
    retry:    'Réessayer',
    loading:  'Chargement…',
    language: 'Langue',
  },
  auth: {
    signInHint:         'Connectez-vous avec le Gmail de votre organisation',
    continueWithGoogle: 'Continuer avec Google',
    continueInBrowser:  'Continuer dans le navigateur',
    browserNote:        "Votre navigateur va s'ouvrir pour vous connecter en toute sécurité.",
    verifyingSession:   'Vérification de votre session…',
    connecting:         'Connexion…',
    lastUsed:           'Dernier utilisé',
    signedInTitle:      'Connecté',
    signedInText:       'Nous vous emmenons vers votre espace.',
    popupBlocked: { title: 'Votre navigateur a bloqué la fenêtre', text: 'Autorisez les fenêtres contextuelles pour ce site et réessayez.' },
    accountExists: { title: 'Cet e-mail a déjà un compte', text: 'Connectez-vous avec la méthode utilisée la première fois. Vous pourrez ensuite lier les autres.' },
    network: { title: 'Pas de connexion', text: "Vérifiez votre connexion internet et réessayez. Vous n'avez rien perdu." },
    unauthorizedDomain: { title: "Ce site n'est pas autorisé", text: "Prévenez l'équipe pour qu'elle active le domaine." },
    tooManyRequests: { title: 'Trop de tentatives', text: 'Patientez une minute avant de réessayer.' },
    generic: { title: "Nous n'avons pas pu vous connecter", text: 'Réessayez dans quelques secondes. Vos données sont en sécurité.' },
  },
} satisfies CommonDictionary;
