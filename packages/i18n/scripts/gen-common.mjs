// Genera dictionaries/{es,en,pt,fr,de}.ts. Los textos viven acá para escribirlos en un solo lugar; el resultado se versiona.
import { writeFileSync } from 'node:fs';

const D = {
  es: {
    common: ['Guardar', 'Cancelar', 'Cerrar', 'Volver', 'Reintentar', 'Cargando…', 'Idioma'],
    auth: {
      signInHint: 'Iniciá sesión con el Gmail de tu organización', continueWithGoogle: 'Continuar con Google',
      continueInBrowser: 'Continuar en el navegador', browserNote: 'Se abrirá tu navegador para iniciar sesión de forma segura.',
      verifyingSession: 'Verificando tu sesión…', connecting: 'Conectando…', lastUsed: 'Último usado',
      signedInTitle: 'Sesión iniciada', signedInText: 'Te llevamos a tu panel en un momento.',
      popupBlocked: ['Tu navegador bloqueó la ventana', 'Permití las ventanas emergentes para este sitio e intentá de nuevo.'],
      accountExists: ['Ese correo ya tiene una cuenta', 'Entrá con el método que usaste la primera vez. Después podrás vincular los demás.'],
      network: ['Sin conexión', 'Revisá tu internet y volvé a intentarlo. No perdiste nada.'],
      unauthorizedDomain: ['Este sitio no está autorizado', 'Avisá al equipo para habilitar el dominio.'],
      tooManyRequests: ['Demasiados intentos', 'Esperá un minuto antes de volver a probar.'],
      generic: ['No pudimos iniciar sesión', 'Intentá de nuevo en unos segundos. Tus datos están a salvo.'],
    },
  },
  en: {
    common: ['Save', 'Cancel', 'Close', 'Back', 'Try again', 'Loading…', 'Language'],
    auth: {
      signInHint: "Sign in with your organization's Gmail", continueWithGoogle: 'Continue with Google',
      continueInBrowser: 'Continue in the browser', browserNote: 'Your browser will open so you can sign in securely.',
      verifyingSession: 'Verifying your session…', connecting: 'Connecting…', lastUsed: 'Last used',
      signedInTitle: 'Signed in', signedInText: "We're taking you to your dashboard.",
      popupBlocked: ['Your browser blocked the window', 'Allow pop-ups for this site and try again.'],
      accountExists: ['That email already has an account', 'Sign in with the method you used the first time. You can link the others afterwards.'],
      network: ['No connection', "Check your internet and try again. You haven't lost anything."],
      unauthorizedDomain: ["This site isn't authorized", 'Let the team know so they can enable the domain.'],
      tooManyRequests: ['Too many attempts', 'Wait a minute before trying again.'],
      generic: ["We couldn't sign you in", 'Try again in a few seconds. Your data is safe.'],
    },
  },
  pt: {
    common: ['Salvar', 'Cancelar', 'Fechar', 'Voltar', 'Tentar novamente', 'Carregando…', 'Idioma'],
    auth: {
      signInHint: 'Entre com o Gmail da sua organização', continueWithGoogle: 'Continuar com o Google',
      continueInBrowser: 'Continuar no navegador', browserNote: 'Seu navegador será aberto para você entrar com segurança.',
      verifyingSession: 'Verificando sua sessão…', connecting: 'Conectando…', lastUsed: 'Último usado',
      signedInTitle: 'Sessão iniciada', signedInText: 'Estamos levando você ao seu painel.',
      popupBlocked: ['Seu navegador bloqueou a janela', 'Permita as janelas pop-up deste site e tente novamente.'],
      accountExists: ['Esse e-mail já tem uma conta', 'Entre com o método que você usou da primeira vez. Depois poderá vincular os outros.'],
      network: ['Sem conexão', 'Verifique sua internet e tente novamente. Você não perdeu nada.'],
      unauthorizedDomain: ['Este site não está autorizado', 'Avise a equipe para habilitar o domínio.'],
      tooManyRequests: ['Muitas tentativas', 'Aguarde um minuto antes de tentar de novo.'],
      generic: ['Não conseguimos iniciar sua sessão', 'Tente novamente em alguns segundos. Seus dados estão seguros.'],
    },
  },
  fr: {
    common: ['Enregistrer', 'Annuler', 'Fermer', 'Retour', 'Réessayer', 'Chargement…', 'Langue'],
    auth: {
      signInHint: 'Connectez-vous avec le Gmail de votre organisation', continueWithGoogle: 'Continuer avec Google',
      continueInBrowser: 'Continuer dans le navigateur', browserNote: "Votre navigateur va s'ouvrir pour vous connecter en toute sécurité.",
      verifyingSession: 'Vérification de votre session…', connecting: 'Connexion…', lastUsed: 'Dernier utilisé',
      signedInTitle: 'Connecté', signedInText: 'Nous vous emmenons vers votre espace.',
      popupBlocked: ['Votre navigateur a bloqué la fenêtre', 'Autorisez les fenêtres contextuelles pour ce site et réessayez.'],
      accountExists: ['Cet e-mail a déjà un compte', "Connectez-vous avec la méthode utilisée la première fois. Vous pourrez ensuite lier les autres."],
      network: ['Pas de connexion', "Vérifiez votre connexion internet et réessayez. Vous n'avez rien perdu."],
      unauthorizedDomain: ["Ce site n'est pas autorisé", "Prévenez l'équipe pour qu'elle active le domaine."],
      tooManyRequests: ['Trop de tentatives', 'Patientez une minute avant de réessayer.'],
      generic: ["Nous n'avons pas pu vous connecter", 'Réessayez dans quelques secondes. Vos données sont en sécurité.'],
    },
  },
  de: {
    common: ['Speichern', 'Abbrechen', 'Schließen', 'Zurück', 'Erneut versuchen', 'Wird geladen…', 'Sprache'],
    auth: {
      signInHint: 'Melde dich mit dem Gmail deiner Organisation an', continueWithGoogle: 'Weiter mit Google',
      continueInBrowser: 'Im Browser fortfahren', browserNote: 'Dein Browser wird geöffnet, damit du dich sicher anmelden kannst.',
      verifyingSession: 'Sitzung wird überprüft…', connecting: 'Verbindung wird hergestellt…', lastUsed: 'Zuletzt verwendet',
      signedInTitle: 'Angemeldet', signedInText: 'Wir bringen dich gleich zu deinem Bereich.',
      popupBlocked: ['Dein Browser hat das Fenster blockiert', 'Erlaube Pop-ups für diese Seite und versuche es erneut.'],
      accountExists: ['Diese E-Mail hat bereits ein Konto', 'Melde dich mit der Methode an, die du beim ersten Mal verwendet hast. Die anderen kannst du danach verknüpfen.'],
      network: ['Keine Verbindung', 'Prüfe deine Internetverbindung und versuche es erneut. Es ist nichts verloren gegangen.'],
      unauthorizedDomain: ['Diese Seite ist nicht autorisiert', 'Sag dem Team Bescheid, damit die Domain freigeschaltet wird.'],
      tooManyRequests: ['Zu viele Versuche', 'Warte eine Minute, bevor du es erneut versuchst.'],
      generic: ['Anmeldung nicht möglich', 'Versuche es in ein paar Sekunden erneut. Deine Daten sind sicher.'],
    },
  },
};

const q = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
const pair = (name, [title, text]) => `    ${name}: { title: ${q(title)}, text: ${q(text)} },`;

for (const [loc, v] of Object.entries(D)) {
  const [save, cancel, close, back, retry, loading, language] = v.common;
  const a = v.auth;
  const out = `import type { CommonDictionary } from './types';

export const ${loc} = {
  common: {
    save:     ${q(save)},
    cancel:   ${q(cancel)},
    close:    ${q(close)},
    back:     ${q(back)},
    retry:    ${q(retry)},
    loading:  ${q(loading)},
    language: ${q(language)},
  },
  auth: {
    signInHint:         ${q(a.signInHint)},
    continueWithGoogle: ${q(a.continueWithGoogle)},
    continueInBrowser:  ${q(a.continueInBrowser)},
    browserNote:        ${q(a.browserNote)},
    verifyingSession:   ${q(a.verifyingSession)},
    connecting:         ${q(a.connecting)},
    lastUsed:           ${q(a.lastUsed)},
    signedInTitle:      ${q(a.signedInTitle)},
    signedInText:       ${q(a.signedInText)},
${pair('popupBlocked', a.popupBlocked)}
${pair('accountExists', a.accountExists)}
${pair('network', a.network)}
${pair('unauthorizedDomain', a.unauthorizedDomain)}
${pair('tooManyRequests', a.tooManyRequests)}
${pair('generic', a.generic)}
  },
} satisfies CommonDictionary;
`;
  writeFileSync(new URL(`../src/dictionaries/${loc}.ts`, import.meta.url), out);
}
