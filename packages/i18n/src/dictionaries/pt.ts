import type { CommonDictionary } from './types';

export const pt = {
  common: {
    save:     'Salvar',
    cancel:   'Cancelar',
    close:    'Fechar',
    back:     'Voltar',
    retry:    'Tentar novamente',
    loading:  'Carregando…',
    language: 'Idioma',
  },
  auth: {
    signInHint:         'Entre com o Gmail da sua organização',
    continueWithGoogle: 'Continuar com o Google',
    continueInBrowser:  'Continuar no navegador',
    browserNote:        'Seu navegador será aberto para você entrar com segurança.',
    verifyingSession:   'Verificando sua sessão…',
    connecting:         'Conectando…',
    lastUsed:           'Último usado',
    signedInTitle:      'Sessão iniciada',
    signedInText:       'Estamos levando você ao seu painel.',
    popupBlocked: { title: 'Seu navegador bloqueou a janela', text: 'Permita as janelas pop-up deste site e tente novamente.' },
    accountExists: { title: 'Esse e-mail já tem uma conta', text: 'Entre com o método que você usou da primeira vez. Depois poderá vincular os outros.' },
    network: { title: 'Sem conexão', text: 'Verifique sua internet e tente novamente. Você não perdeu nada.' },
    unauthorizedDomain: { title: 'Este site não está autorizado', text: 'Avise a equipe para habilitar o domínio.' },
    tooManyRequests: { title: 'Muitas tentativas', text: 'Aguarde um minuto antes de tentar de novo.' },
    generic: { title: 'Não conseguimos iniciar sua sessão', text: 'Tente novamente em alguns segundos. Seus dados estão seguros.' },
  },
} satisfies CommonDictionary;
