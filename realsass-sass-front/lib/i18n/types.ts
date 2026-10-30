/** Textos propios de sass-front; los comunes (acceso, acciones) vienen de @real/i18n. */
export interface OwnDictionary {
  nav: {
    userMenu:       string;
    profile:        string;
    signOut:        string;
    signIn:         string;
    loadingSession: string;
    avatarAlt:      string;
  };
  login: {
    title:                string;
    description:          string;
    continueWithApple:    string;
    continueWithFacebook: string;
  };
}
