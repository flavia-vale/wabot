// Mensagem honesta ao salvar o código de acesso de uma loja.
//
// RCA 2026-08-15: um cliente novo (`matheuschaves308@gmail.com`) salvou a
// credencial do Mercado Livre 17 vezes em 4h30 sem conseguir. `PUT /credentials`
// só conferia se os CAMPOS estavam preenchidos — nunca se o código FUNCIONA — e
// devolvia "Tudo certo! ... suas ofertas já saem com a sua comissão". Ele via
// verde, saía da tela, e só descobria o problema pelo erro nas ofertas. Na 18a
// tentativa acertou; das 27 recusas do dia, todas estão nessa janela.
//
// Módulo puro de propósito (sem I/O, sem db): a decisão de qual frase mostrar é
// testável sem rede e sem banco. Quem faz a sondagem é a rota.
//
// Vocabulário obrigatório (AGENTS.md, "Linguagem para a usuária"): "código de
// acesso" (nunca cookie/SSID), "etiqueta de afiliada" (nunca tag), "link mais
// comprido" (nunca ?tag=/partner_id), "venceu" (nunca "sessão expirada"). E
// nunca dizer que o envio está pausado — o plano B segue enviando.

// Lojas que têm sondagem de código de acesso. Shopee e Magalu usam chave de API
// (não há sessão para vencer), então continuam com a mensagem de sempre.
export const PLATFORMS_WITH_SESSION_CHECK = ['mercadolivre', 'amazon']

export function platformSupportsSessionCheck(platform) {
  return PLATFORMS_WITH_SESSION_CHECK.includes(platform)
}

const STORE_LABEL = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
}

// O que se perde além do link curto, por loja. Precisa ser verdade: no ML o
// cupom sem produto deixa de ser convertido; na Amazon não.
const EXTRA_LOSS = {
  mercadolivre: ' e cupons sem produto deixam de ser convertidos',
  amazon: '',
}

/**
 * Decide a mensagem e o tom do save a partir da validação de campos e do
 * resultado da sondagem.
 *
 * @param {object} args
 * @param {string} args.platform
 * @param {object} args.validation  saída de validateCredentialData
 * @param {object|null} args.probe  saída de checkMercadoLivreSession/checkAmazonSession
 *                                  (`alive`: true = funciona, false = recusado,
 *                                  null/ausente = não deu para saber)
 * @param {string} args.fallbackMessage  mensagem histórica (getCredentialSaveMessage)
 * @returns {{ tone: 'success'|'error'|'warn', message: string }}
 */
export function describeSaveSessionCheck({ platform, validation, probe, fallbackMessage }) {
  const label = STORE_LABEL[platform] || validation?.label || 'loja'

  // Campo faltando ou loja sem sondagem: comportamento histórico intacto.
  if (!validation?.configured) return { tone: 'error', message: fallbackMessage }
  if (!platformSupportsSessionCheck(platform)) {
    return { tone: validation.warnings?.length ? 'warn' : 'success', message: fallbackMessage }
  }

  // A loja RECUSOU o código. É o caso que motivou este módulo: dizer na cara,
  // no mesmo lugar onde a pessoa acabou de colar, que aquele código não serve.
  if (probe?.alive === false) {
    return {
      tone: 'error',
      message:
        `Salvamos, mas a ${label} não aceitou esse código de acesso — ele já venceu. ` +
        `Pegue um código novo e cole aqui. Enquanto isso suas ofertas continuam saindo e a comissão continua sendo sua, ` +
        `só que o link fica mais comprido${EXTRA_LOSS[platform] || ''}.`,
    }
  }

  // Testamos e funcionou. Vale dizer que testamos — é o que dá confiança de que
  // o verde significa alguma coisa.
  if (probe?.alive === true) {
    if (validation.warnings?.length) return { tone: 'warn', message: fallbackMessage }
    return {
      tone: 'success',
      message: `Testamos agora e o código de acesso da ${label} está funcionando. Suas ofertas já saem com a sua comissão e com link curto.`,
    }
  }

  // Não deu para saber (loja fora do ar, bloqueio momentâneo, limite de
  // tentativas). Não podemos dizer nem que funciona nem que não funciona —
  // afirmar qualquer um dos dois é pior do que admitir a dúvida.
  return {
    tone: 'warn',
    message:
      `Salvamos, mas não deu para testar o código agora — a ${label} não respondeu. ` +
      `Se as ofertas começarem a sair com link mais comprido, volte aqui e cole um código novo.`,
  }
}
