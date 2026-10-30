/**
 * Contrato del diccionario COMÚN a todos los paneles (acciones, estados, acceso).
 * Agregar una key acá obliga (en compile time) a traducirla en cada idioma: cada archivo usa `satisfies CommonDictionary`.
 * Cada front suma sus propios textos con su diccionario y lo une con `mergeDictionaries`.
 *
 * es.ts … de.ts se generan con `node scripts/gen-common.mjs` (los textos se escriben juntos, un idioma al lado del otro).
 */
export interface TitledText {
  title: string;
  text:  string;
}

export interface CommonDictionary {
  common: {
    save:     string;
    cancel:   string;
    close:    string;
    back:     string;
    retry:    string;
    loading:  string;
    language: string;
  };
  auth: {
    signInHint:         string;
    continueWithGoogle: string;
    continueInBrowser:  string;
    browserNote:        string;
    verifyingSession:   string;
    connecting:         string;
    lastUsed:           string;
    signedInTitle:      string;
    signedInText:       string;
    /** Errores de Firebase Authentication (auth/*): qué pasó + qué hacer, sin culpar. */
    popupBlocked:       TitledText;
    accountExists:      TitledText;
    network:            TitledText;
    unauthorizedDomain: TitledText;
    tooManyRequests:    TitledText;
    generic:            TitledText;
  };
}
