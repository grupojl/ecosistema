import type { CommonDictionary } from './types';

export const es = {
  common: {
    save:     'Guardar',
    cancel:   'Cancelar',
    close:    'Cerrar',
    back:     'Volver',
    retry:    'Reintentar',
    loading:  'Cargando…',
    language: 'Idioma',
  },
  auth: {
    signInHint:         'Iniciá sesión con el Gmail de tu organización',
    continueWithGoogle: 'Continuar con Google',
    continueInBrowser:  'Continuar en el navegador',
    browserNote:        'Se abrirá tu navegador para iniciar sesión de forma segura.',
    verifyingSession:   'Verificando tu sesión…',
    connecting:         'Conectando…',
    lastUsed:           'Último usado',
    signedInTitle:      'Sesión iniciada',
    signedInText:       'Te llevamos a tu panel en un momento.',
    popupBlocked: { title: 'Tu navegador bloqueó la ventana', text: 'Permití las ventanas emergentes para este sitio e intentá de nuevo.' },
    accountExists: { title: 'Ese correo ya tiene una cuenta', text: 'Entrá con el método que usaste la primera vez. Después podrás vincular los demás.' },
    network: { title: 'Sin conexión', text: 'Revisá tu internet y volvé a intentarlo. No perdiste nada.' },
    unauthorizedDomain: { title: 'Este sitio no está autorizado', text: 'Avisá al equipo para habilitar el dominio.' },
    tooManyRequests: { title: 'Demasiados intentos', text: 'Esperá un minuto antes de volver a probar.' },
    generic: { title: 'No pudimos iniciar sesión', text: 'Intentá de nuevo en unos segundos. Tus datos están a salvo.' },
  },
} satisfies CommonDictionary;
