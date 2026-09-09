// Como o BLOQUEIO POR FALTA DE CREDENCIAL é descrito no painel. Puro — sem
// DB, sem SMTP, testável isolado. Espelha o desenho de
// src/credentialExpiry/message.js, onde a inversão de vocabulário da Shopee
// já está resolvida e comentada: aqui é o MESMO comportamento (Shopee é o
// OPOSTO de ML/Amazon/Magalu), só que para o caso "nunca cadastrou" em vez
// de "cadastrou e venceu" — este módulo se cala assim que existe uma
// `Credential` para a loja, mesmo vencida (FR-020); quem avisa esse outro
// caso é src/credentialExpiry/.
//
// contracts/credential-block-alert.md tem o contrato completo da rota que
// consome buildCredentialBlockAlerts().

const STORE_LABELS = {
  shopee: 'Shopee',
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  magazineluiza: 'Magalu',
  shein: 'SHEIN',
}

// --- Shopee: SEM chave aceita, a conversão falha por completo — nenhuma
// oferta dessa loja é publicada (AGENTS.md, "Shopee é o caso OPOSTO"). Texto
// numa constante PRÓPRIA, nunca fundida com a de ML/Amazon/Magalu — é
// exatamente essa fusão que o teste "guarda dedicada contra fusão de texto"
// existe para pegar.
function buildShopeeAlert(storeLabel) {
  return {
    headline: `As ofertas da ${storeLabel} não estão saindo`,
    body: `Sem a chave da ${storeLabel} aceita, as ofertas da ${storeLabel} param de sair — a conversão falha por completo e nada é publicado.`,
    nextStep: `Cadastre a chave da ${storeLabel} (App ID + chave secreta) em "Minhas credenciais" para as ofertas voltarem a sair.`,
  }
}

// --- SHEIN: entra na FAMÍLIA DA SHOPEE, não na de ML/Amazon/Magalu.
// `src/converters/shein.js#convert()` faz `if (!tag) return null` — sem a
// etiqueta de afiliada, NADA é resolvido e a oferta vira
// `skip:no_valid_conversions` (não existe plano B com link mais comprido,
// diferente de ML/Amazon/Magalu). Constante própria, nunca fundida com
// `buildShopeeAlert`/`buildSessionAlert` (T045 espelha a exigência de T021(d)
// para a Shopee).
function buildSheinAlert(storeLabel) {
  return {
    headline: `As ofertas da ${storeLabel} não estão saindo`,
    body: `Sem a etiqueta de afiliada da ${storeLabel}, as ofertas da ${storeLabel} param de sair — a conversão falha por completo e nada é publicado.`,
    nextStep: `Cadastre a etiqueta de afiliada da ${storeLabel} em "Minhas credenciais" para as ofertas voltarem a sair.`,
  }
}

// --- Mercado Livre / Amazon / Magalu: SEM o código de acesso, o plano B
// continua publicando — só com o link mais comprido, sem a sua etiqueta de
// afiliada curta. Magalu entra nesta família (e não na da Shopee) porque o
// mecanismo de conversão dela não bloqueia a oferta por falta de credencial
// (AGENTS.md, "Conversão de link de cupom": Magalu converte via partner_id
// em qualquer URL) — o mesmo "continua saindo, só mais comprido" de ML/Amazon.
function buildSessionAlert(storeLabel) {
  return {
    headline: `Faltou cadastrar o código de acesso da ${storeLabel}`,
    body: `As ofertas da ${storeLabel} continuam saindo, só que com o link mais comprido — sem o código de acesso não dá para trocar pelo link curto com a sua etiqueta de afiliada.`,
    nextStep: `Cadastre o código de acesso da ${storeLabel} em "Minhas credenciais" para o link voltar a sair curto.`,
  }
}

const ALERT_BUILDERS = {
  shopee: buildShopeeAlert,
  mercadolivre: buildSessionAlert,
  amazon: buildSessionAlert,
  magazineluiza: buildSessionAlert,
  shein: buildSheinAlert,
}

/**
 * Monta os avisos de "envio bloqueado por falta de credencial" para o
 * painel — só para lojas SEM `Credential` cadastrada (FR-020: loja
 * cadastrada, mesmo com código vencido, é assunto de src/credentialExpiry/,
 * não deste módulo).
 *
 * @param {{ blockedByPlatform: Array<{platform: string, blockedCount: number, lastBlockedAt: string}>, configuredPlatforms: string[] }} params
 * @returns {Array<{platform: string, storeLabel: string, blockedCount: number, lastBlockedAt: string, headline: string, body: string, nextStep: string, href: string}>}
 */
export function buildCredentialBlockAlerts({ blockedByPlatform = [], configuredPlatforms = [] } = {}) {
  const configured = new Set(configuredPlatforms)
  const stores = []

  for (const item of blockedByPlatform) {
    const platform = item?.platform
    if (!platform || configured.has(platform)) continue // FR-020/FR-021

    const storeLabel = STORE_LABELS[platform]
    const buildAlert = ALERT_BUILDERS[platform]
    if (!storeLabel || !buildAlert) continue // loja desconhecida: fail-safe, não inventa aviso genérico

    const texts = buildAlert(storeLabel)
    stores.push({
      platform,
      storeLabel,
      blockedCount: item.blockedCount,
      lastBlockedAt: item.lastBlockedAt,
      ...texts,
      href: '/painel/ids-afiliada',
    })
  }

  return stores
}

// --------------------------------------------------------------------------
// Como a MESMA falta de credencial é nomeada no histórico de envios e no aviso
// global do painel (2026-09-02).
//
// Motivo: a cliente abria a aba Envios, lia "ignorado" e mandava print para o
// suporte perguntando o que era — o motivo real só aparecia depois de clicar
// em "Ver motivo", coisa que quase ninguém fez. O status agora diz a causa na
// própria etiqueta, e o botão de ajuda abre a explicação junto com o vídeo.
// Vocabulário obrigatório de sempre: "etiqueta de afiliada"/"código de acesso"
// /"chave", nunca "credencial da API", "token" ou nome de campo técnico.

/** Prefixo canônico de `MessageLog.errorMsg` para "nada pôde ser convertido". */
export const CREDENTIAL_BLOCK_ERROR_PREFIX = 'skip:no_valid_conversions'

/** A linha do histórico é uma oferta perdida por falta de cadastro da loja? */
export function isCredentialBlockErrorMsg(errorMsg) {
  return typeof errorMsg === 'string' && errorMsg.startsWith(CREDENTIAL_BLOCK_ERROR_PREFIX)
}

/**
 * Etiqueta de status do histórico para esse caso. Deliberadamente NÃO é
 * "ignorado" nem "falhou": as duas escondem que a oferta se perdeu por um
 * cadastro que falta, que é a única informação capaz de gerar ação.
 */
export const CREDENTIAL_BLOCK_STATUS_TAG = Object.freeze({
  cls: 'is-error',
  label: 'faltou cadastrar a loja',
})

/**
 * Conteúdo do diálogo de ajuda que abre ao lado da linha do histórico.
 * `videoUrl` entra de fora (o painel resolve pelo `src/tutorialVideo.js`) para
 * este módulo continuar sem dependência nenhuma.
 */
export function buildCredentialBlockHelp(platform) {
  const storeLabel = STORE_LABELS[platform] || null
  const buildAlert = ALERT_BUILDERS[platform]
  const alert = buildAlert ? buildAlert(storeLabel) : null

  return {
    platform: platform || null,
    storeLabel,
    title: storeLabel
      ? `Falta cadastrar a ${storeLabel} para essa oferta sair`
      : 'Falta cadastrar a loja para essa oferta sair',
    paragraphs: [
      // NÃO reaproveitar `alert.body` aqui: para Mercado Livre/Amazon/Magalu
      // ele diz "as ofertas continuam saindo, só com o link mais comprido",
      // que é verdade quando o código de acesso VENCEU — e mentira nesta
      // linha do histórico, onde a oferta comprovadamente não foi publicada.
      storeLabel
        ? `Essa oferta era da ${storeLabel} e não foi publicada: sem os seus dados da ${storeLabel} cadastrados, o robô não consegue montar o link com a sua identificação de afiliada.`
        : 'Essa oferta não foi publicada: o robô não conseguiu transformar nenhum link da mensagem em link de afiliada com a sua identificação.',
      'O robô nunca publica o link de outra pessoa: sem os seus dados da loja, a comissão iria para quem publicou a oferta original. Por isso ele prefere não enviar.',
      'É um cadastro só, feito uma vez por loja — depois disso as ofertas dessa loja voltam a sair sozinhas.',
    ],
    nextStep: alert ? alert.nextStep : 'Cadastre os dados dessa loja em "Minhas credenciais" para as ofertas voltarem a sair.',
    credentialsHref: '/painel/ids-afiliada',
    credentialsLabel: 'Cadastrar agora',
    videoLabel: storeLabel ? `Ver no vídeo como pegar os dados da ${storeLabel}` : 'Ver o vídeo passo a passo',
  }
}

/**
 * Aviso do topo de TODAS as abas do painel para quem não cadastrou NENHUMA
 * loja. Sem isso o robô conecta, espelha e descarta tudo — e a cliente conclui
 * que o produto não funciona.
 */
export function buildNoCredentialBanner() {
  return {
    headline: 'Falta cadastrar suas lojas — sem isso o robô não publica nenhuma oferta',
    body: 'O robô só publica uma oferta depois de trocar o link pelo seu, com a sua identificação de afiliada. Enquanto nenhuma loja estiver cadastrada, ele recebe as ofertas e não envia nada.',
    ctaLabel: 'Cadastrar minhas lojas',
    ctaHref: '/painel/ids-afiliada',
    videoLabel: 'Ver o vídeo passo a passo',
  }
}

/**
 * O passo seguinte, na tela de conexão, para quem ACABOU de conectar o WhatsApp
 * e não tem nenhuma loja cadastrada.
 *
 * Frente C do plano de ativação de 2026-09-08. É o mesmo fato do
 * `buildNoCredentialBanner`, dito em outro momento — e o momento muda o texto:
 * ali a pessoa está navegando e descobre que algo está errado; aqui ela acabou
 * de vencer a parte mais difícil do produto (entregar o WhatsApp) e o que ela
 * precisa é saber que falta UMA coisa, não levar um susto.
 *
 * Sem isso, a tela de conexão terminava em "conectado" — e 18 das 114 pessoas
 * que não pagaram pararam exatamente aí, achando que tinham terminado, com o
 * robô recebendo ofertas e publicando zero.
 */
export function buildJustConnectedNextStep() {
  return {
    headline: 'WhatsApp conectado! Falta um passo — e é o rápido.',
    body: 'Você já passou pela parte mais chata. Agora cadastre pelo menos uma loja: sem a sua etiqueta de afiliada o robô não publica nenhuma oferta, porque a comissão da venda iria para outra pessoa. Ele prefere não enviar a te fazer trabalhar de graça.',
    ctaLabel: 'Cadastrar minha primeira loja',
    ctaHref: '/painel/ids-afiliada',
    hint: 'Leva menos de um minuto: tem loja que pede só a sua etiqueta.',
  }
}
