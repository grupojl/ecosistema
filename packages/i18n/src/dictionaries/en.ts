import type { CommonDictionary } from './types';

export const en = {
  common: {
    save:     'Save',
    cancel:   'Cancel',
    close:    'Close',
    back:     'Back',
    retry:    'Try again',
    loading:  'Loading…',
    language: 'Language',
  },
  auth: {
    signInHint:         "Sign in with your organization's Gmail",
    continueWithGoogle: 'Continue with Google',
    continueInBrowser:  'Continue in the browser',
    browserNote:        'Your browser will open so you can sign in securely.',
    verifyingSession:   'Verifying your session…',
    connecting:         'Connecting…',
    lastUsed:           'Last used',
    signedInTitle:      'Signed in',
    signedInText:       "We're taking you to your dashboard.",
    popupBlocked: { title: 'Your browser blocked the window', text: 'Allow pop-ups for this site and try again.' },
    accountExists: { title: 'That email already has an account', text: 'Sign in with the method you used the first time. You can link the others afterwards.' },
    network: { title: 'No connection', text: "Check your internet and try again. You haven't lost anything." },
    unauthorizedDomain: { title: "This site isn't authorized", text: 'Let the team know so they can enable the domain.' },
    tooManyRequests: { title: 'Too many attempts', text: 'Wait a minute before trying again.' },
    generic: { title: "We couldn't sign you in", text: 'Try again in a few seconds. Your data is safe.' },
  },
} satisfies CommonDictionary;
