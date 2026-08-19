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
