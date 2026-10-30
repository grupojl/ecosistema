/**
 * login-messages.ts — traduce el acceso (LoginPanel de @real/ui) desde el diccionario común.
 * Uso: <LoginPanel {...loginPanelTexts(d.auth)} … />
 */
import type { LoginPanelMessages } from '@real/ui';
import type { CommonDictionary } from './dictionaries/types';

export function loginPanelTexts(auth: CommonDictionary['auth']): {
  connectingLabel: string;
  lastUsedLabel:   string;
  messages:        LoginPanelMessages;
} {
  return {
    connectingLabel: auth.connecting,
    lastUsedLabel:   auth.lastUsed,
    messages: {
      signedInTitle: auth.signedInTitle,
      signedInText:  auth.signedInText,
      genericError:  auth.generic,
      errors: {
        'auth/popup-blocked':                            auth.popupBlocked,
        'auth/account-exists-with-different-credential': auth.accountExists,
        'auth/network-request-failed':                   auth.network,
        'auth/unauthorized-domain':                      auth.unauthorizedDomain,
        'auth/too-many-requests':                        auth.tooManyRequests,
      },
    },
  };
}
