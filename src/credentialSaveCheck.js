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

// Lojas com sondagem ativa da credencial. Magalu fica de fora: só tem etiqueta
// de afiliada, que a loja não recusa.
//
// A Shopee entrou depois (RCA ago/2026): a suposição de que a chave dela "não
// vence" custou dias de ofertas descartadas em silêncio, com o painel mostrando
// a loja em verde. Aqui a chave não vence por tempo — é recusada de uma vez —
// mas o efeito para a cliente é o mesmo e o aviso precisa existir.
export const PLATFORMS_WITH_SESSION_CHECK = ['mercadolivre', 'amazon', 'shopee']

export function platformSupportsSessionCheck(platform) {
  return PLATFORMS_WITH_SESSION_CHECK.includes(platform)
}

const STORE_LABEL = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  shopee: 'Shopee',
  aliexpress: 'AliExpress',
}

// Como a credencial se chama na tela de cada loja. Na Shopee não é "código de
// acesso" (não é cookie de sessão): a cliente cola App ID + chave secreta.
const CREDENTIAL_NOUN = {
  mercadolivre: 'código de acesso',
  amazon: 'código de acesso',
  shopee: 'chave',
}

// O que se perde além do link curto, por loja. Precisa ser verdade: no ML o
// cupom sem produto deixa de ser convertido; na Amazon não.
const EXTRA_LOSS = {
  mercadolivre: ' e cupons sem produto deixam de ser convertidos',
  amazon: '',
}

/**
 * O que muda quando esta é a PRIMEIRA loja da conta.
 *
 * Frente C do plano de ativação de 2026-09-08: 18 das 114 pessoas que não
 * pagaram conectaram o WhatsApp e nunca cadastraram loja nenhuma. Sem etiqueta
 * o robô se RECUSA a publicar (`skip:no_valid_conversions`), para não dar a
 * comissão ao afiliado do grupo de origem — mas do lado de fora isso parece
 * produto quebrado, e a pessoa some achando que não funciona.
 *
 * Esse save é o instante exato em que o robô sai de "não publica nada" para
 * "publica" — e era o único momento do produto que não dizia isso. Uma frase
 * genérica de "atualizado com sucesso" desperdiça o único marco que a cliente
 * consegue sentir.
 *
 * Só entra em save que deu certo: anunciar destravamento junto de uma chave
 * recusada seria a mentira mais cara da tela.
 */
export const FIRST_CREDENTIAL_HEADLINE = 'Pronto — agora o robô já pode publicar suas ofertas.'

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
 * @param {boolean} [args.isFirstCredential]  esta é a primeira loja da conta
 * @returns {{ tone: 'success'|'error'|'warn', message: string }}
 */
export function describeSaveSessionCheck({ platform, validation, probe, fallbackMessage, isFirstCredential = false }) {
  const label = STORE_LABEL[platform] || validation?.label || 'loja'

  // O marco só se aplica ao save que deu certo — ver FIRST_CREDENTIAL_HEADLINE.
  const comMarco = (resultado) => (
    isFirstCredential && resultado.tone === 'success'
      ? { ...resultado, message: `${FIRST_CREDENTIAL_HEADLINE} ${resultado.message}`, firstCredential: true }
      : resultado
  )

  // Campo faltando ou loja sem sondagem: comportamento histórico intacto.
  if (!validation?.configured) return { tone: 'error', message: fallbackMessage }
  // Magalu e SHEIN não têm sondagem (só etiqueta, que a loja não recusa) — e
  // são justamente as lojas mais rápidas de cadastrar, então é por aqui que a
  // maioria vai destravar o robô pela primeira vez.
  if (!platformSupportsSessionCheck(platform)) {
    if (platform === 'aliexpress') {
      return {
        tone: 'warn',
        message: 'Salvamos os dados da AliExpress. A loja só consegue confirmá-los ao converter a primeira oferta; se algum dado for recusado, o motivo aparecerá nos registros.',
      }
    }
    return comMarco({ tone: validation.warnings?.length ? 'warn' : 'success', message: fallbackMessage })
  }

  const noun = CREDENTIAL_NOUN[platform] || 'código de acesso'

  // A loja RECUSOU a credencial. É o caso que motivou este módulo: dizer na
  // cara, no mesmo lugar onde a pessoa acabou de colar, que aquilo não serve.
  if (probe?.alive === false) {
    // Shopee é o caso GRAVE e o texto precisa dizer isso: sem chave aceita não
    // há plano B — a oferta não é publicada e as ofertas automáticas param.
    // Reaproveitar aqui o "continuam saindo" das outras duas lojas seria mentira.
    if (platform === 'shopee') {
      return {
        tone: 'error',
        message:
          'Salvamos, mas a Shopee não aceitou essa chave. Enquanto ela não for aceita, as ofertas da Shopee param de sair '
          + '(as outras lojas seguem normalmente). Gere um App ID e uma chave secreta novos no painel de afiliada da Shopee e cole aqui.',
      }
    }
    return {
      tone: 'error',
      message:
        `Salvamos, mas a ${label} não aceitou esse ${noun} — ele já venceu. ` +
        `Pegue um código novo e cole aqui. Enquanto isso suas ofertas continuam saindo e a comissão continua sendo sua, ` +
        `só que o link fica mais comprido${EXTRA_LOSS[platform] || ''}.`,
    }
  }

  // Testamos e funcionou. Vale dizer que testamos — é o que dá confiança de que
  // o verde significa alguma coisa.
  if (probe?.alive === true) {
    if (validation.warnings?.length) return { tone: 'warn', message: fallbackMessage }
    if (platform === 'shopee') {
      return comMarco({
        tone: 'success',
        message: 'Testamos agora e a Shopee aceitou sua chave. Suas ofertas já saem com a sua comissão.',
      })
    }
    return comMarco({
      tone: 'success',
      message: `Testamos agora e o ${noun} da ${label} está funcionando. Suas ofertas já saem com a sua comissão e com link curto.`,
    })
  }

  // Não deu para saber (loja fora do ar, bloqueio momentâneo, limite de
  // tentativas). Não podemos dizer nem que funciona nem que não funciona —
  // afirmar qualquer um dos dois é pior do que admitir a dúvida.
  if (platform === 'shopee') {
    return {
      tone: 'warn',
      message:
        'Salvamos, mas não deu para testar a chave agora — a Shopee não respondeu. '
        + 'Se as ofertas da Shopee não saírem, volte aqui e confira se a chave está certa.',
    }
  }
  return {
    tone: 'warn',
    message:
      `Salvamos, mas não deu para testar o ${noun} agora — a ${label} não respondeu. ` +
      `Se as ofertas começarem a sair com link mais comprido, volte aqui e cole um código novo.`,
  }
}
