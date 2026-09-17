/* Config das plataformas de afiliado para a tela "IDs de afiliada" do novo
 * painel. Centraliza a configuração das plataformas exibidas nas credenciais — é config de
 * UI (rótulos, campos, instruções), sem regra de negócio. O salvamento usa os
 * mesmos endpoints (api.credentials / api.saveCredential). */

/* Endereço da extensão que copia o código de acesso das lojas. Fica numa
 * constante porque três lojas apontam para ela: antes era um CARTÃO inteiro no
 * meio da lista ("Extensão necessária"), lido por quem não precisava dele e
 * ignorado por quem precisava. Agora vive na ajuda do campo que a usa. */
export const COOKIE_EDITOR_URL =
  'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm?pli=1'

export const AFFILIATE_PLATFORMS = [
  {
    id: 'shopee',
    label: 'Shopee',
    color: '#EE4D2D',
    initials: 'SP',
    instructions: 'No site de afiliados da Shopee, em Ferramentas → API de Afiliados.',
    actionLinks: [
      {
        label: 'Pedir acesso',
        href: 'https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=',
      },
      {
        label: 'Abrir a página da loja',
        href: 'https://affiliate.shopee.com.br/open_api',
      },
    ],
    fields: [
      { key: 'appId', label: 'App ID da Shopee', hint: 'Número que identifica seu acesso.' },
      { key: 'secretKey', label: 'Chave secreta da Shopee', hint: 'Guarde só aqui — não passe para ninguém.', sensitive: true },
    ],
  },
  {
    id: 'amazon',
    label: 'Amazon',
    color: '#FF9900',
    initials: 'AZ',
    badgeInk: true,
    instructions: 'No site de associados da Amazon: a etiqueta aparece na tela; o código de acesso você copia com a extensão Cookie-Editor, no computador.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://associados.amazon.com.br',
      },
    ],
    platformWarning: 'Com a etiqueta e o código de acesso o link sai curtinho; só com a etiqueta a oferta sai igual, o link é que fica mais comprido.',
    sessionCareNote: 'Depois de colar o código aqui, não clique em "Sair" na Amazon e não use janela anônima — sair da conta derruba o código na hora e você precisa cadastrar tudo de novo (fechar a aba pode).',
    fields: [
      { key: 'tag', label: 'Sua etiqueta de afiliada', hint: 'É o código que identifica suas vendas. Ex.: suaetiqueta-20' },
      { key: 'cookie', label: 'Código de acesso da conta', required: false, sensitive: true, cookieField: true, recommended: true, hint: 'Deixa o link da oferta curtinho.', help: 'No computador, entre em associados.amazon.com.br já logada, clique na extensão Cookie-Editor → botão Export (canto inferior direito) → JSON. O código é copiado sozinho; é só colar aqui.' },
      { key: 'ubid-acbbr', label: 'Código alternativo (ubid-acbbr)', required: false, cookieField: true, sensitive: true, advanced: true, help: 'Só precisa se NÃO colou o código de acesso acima. Mesmo lugar, na extensão Cookie-Editor.' },
      { key: 'at-acbbr', label: 'Código alternativo (at-acbbr)', required: false, cookieField: true, sensitive: true, advanced: true, help: 'Só precisa se NÃO colou o código de acesso acima. Mesmo lugar, na extensão Cookie-Editor.' },
      { key: 'x-acbbr', label: 'Código alternativo (x-acbbr)', required: false, cookieField: true, sensitive: true, advanced: true, help: 'Só precisa se NÃO colou o código de acesso acima. Mesmo lugar, na extensão Cookie-Editor.' },
    ],
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    color: '#FFC400',
    initials: 'ML',
    badgeInk: true,
    instructions: 'No Gerador de Links do Mercado Livre: a etiqueta aparece na tela; o código de acesso você copia com a extensão Cookie-Editor, no computador.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://www.mercadolivre.com.br/afiliados/linkbuilder#hub',
      },
    ],
    platformWarning: 'Com a etiqueta e o código de acesso o link sai curtinho; só com a etiqueta a oferta sai igual, o link é que fica mais comprido.',
    sessionCareNote: 'Depois de colar o código aqui, não clique em "Sair" no Mercado Livre e não use janela anônima — sair da conta derruba o código na hora e você precisa cadastrar tudo de novo (fechar a aba pode).',
    fields: [
      { key: 'tag', label: 'Sua etiqueta de afiliada', hint: 'Copie igualzinho ao que aparece no Mercado Livre.', help: 'É a "etiqueta em uso" que aparece na tela do Gerador de Links do Mercado Livre.' },
      { key: 'ssid', label: 'Código de acesso da conta (SSID)', hint: 'Deixa o link da oferta curtinho.', sensitive: true, cookieField: true, recommended: true, help: 'No computador, com o Mercado Livre aberto e logado, clique na extensão Cookie-Editor, procure o item chamado ssid e copie o valor dele. Não passe esse código para mais ninguém.' },
      { key: 'vitrineUrl', label: 'Link da sua vitrine (opcional)', required: false, advanced: true, hint: 'Serve para quando chega um link da lojinha de outra pessoa, sem produto específico.', help: 'Cole o link da SUA vitrine no Mercado Livre (ex.: mercadolivre.com.br/social/seu-usuario). Quando chegar um link da vitrine de outra pessoa, em vez de descartar a mensagem o robô troca pelo link da sua.' },
    ],
  },
  {
    id: 'magazineluiza',
    label: 'Magazine Luiza',
    color: '#0086FF',
    initials: 'MG',
    quickSetup: true,
    instructions: 'No painel de afiliados do Magazine Luiza, copie a etiqueta que aparece nos seus links.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://www.magazinevoce.com.br/admin',
      },
    ],
    fields: [{ key: 'tag', label: 'Sua etiqueta de afiliada', hint: 'Ex.: parceiro123' }],
  },
  {
    id: 'shein',
    label: 'SHEIN',
    color: '#1F2D2A',
    initials: 'SH',
    quickSetup: true,
    instructions: 'No painel de afiliada da SHEIN, em Minha conta — ou cole aqui o link de qualquer produto gerado ali.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://www.shein.com/affiliate',
      },
    ],
    platformWarning: 'Com o ID e o código de acesso o link sai curtinho; só com o ID a oferta sai igual, o link é que fica mais comprido.',
    sessionCareNote: 'Depois de colar o código aqui, não clique em "Sair" na SHEIN e não use janela anônima — sair da conta derruba o código na hora e você precisa cadastrar tudo de novo (fechar a aba pode).',
    fields: [
      {
        key: 'tag',
        label: 'ID de afiliada ou link de um produto',
        hint: 'O ID fica no painel de afiliada, em Minha conta.',
        help: 'Duas formas de preencher: copie o ID de afiliada em Painel de afiliada → Minha conta → ID de afiliada; ou abra o Gerador de Link, gere o link de um produto qualquer e cole aqui. Qualquer uma serve — o robô descobre o resto sozinho. O link do botão de compartilhar do aplicativo não serve: ele é de uso pessoal.',
      },
      {
        key: 'cookie',
        label: 'Código de acesso (opcional)',
        required: false,
        sensitive: true,
        cookieField: true,
        advanced: true,
        hint: 'Deixa o link da oferta curtinho. Sem ele a oferta sai igual, só com link mais comprido.',
        help: 'No computador, entre em https://m.shein.com/br/affiliate/ já logada, clique em CONVERTER LINK. Em seguida clique na extensão Cookie-Editor e use o botão Export (canto inferior direito) e em seguida clique em JSON. O código é copiado sozinho; é só colar aqui.',
      },
    ],
  },
  {
    id: 'aliexpress',
    label: 'AliExpress',
    color: '#E43225',
    initials: 'AE',
    instructions: 'Entre no portal de afiliados da AliExpress e exporte o JSON com a extensão Cookie-Editor.',
    actionLinks: [
      { label: 'Abrir o portal de afiliados', href: 'https://portals.aliexpress.com' },
    ],
    platformWarning: 'Não existe ID, chave ou segredo para procurar: o portal usa a sua conta conectada. Você só precisa colar o JSON exportado pelo Cookie-Editor.',
    sessionCareNote: 'Depois de colar o código aqui, não clique em "Sair" na AliExpress e não use janela anônima — sair da conta pode invalidar o código e você precisará cadastrar novamente.',
    fields: [
      { key: 'cookie', label: 'JSON do Cookie-Editor', hint: 'Cole aqui o JSON completo exportado enquanto estiver conectada no portal da AliExpress.', sensitive: true, cookieField: true, maxLength: 120000, help: 'No computador, entre em portals.aliexpress.com já conectada, clique na extensão Cookie-Editor → Export → JSON. O JSON é copiado sozinho; é só colar aqui.' },
    ],
  },
]

/**
 * Lojas que ficam prontas com UM campo obrigatório só.
 *
 * Frente C do plano de ativação de 2026-09-08: a tela mostra cinco lojas com o
 * mesmo peso, e a primeira da lista (Shopee) pede duas chaves geradas num
 * painel de API — enquanto Magalu e SHEIN pedem só a etiqueta. Quem chega sem
 * nenhuma loja cadastrada precisa saber por onde o caminho é curto; a medição
 * mostra que mais gente configura GRUPO (57 e 61 contas) do que cadastra LOJA
 * (53), ou seja, a loja é o obstáculo, não a falta de vontade.
 *
 * Deriva dos próprios campos — não é uma segunda lista para desencontrar da
 * primeira quando alguém mudar o formulário de uma loja.
 */
export function isQuickSetupPlatform(platform) {
  if (!platform?.quickSetup) return false
  return platform.fields.filter((f) => f.required !== false).length === 1
}

export function quickSetupPlatforms(platforms = AFFILIATE_PLATFORMS) {
  return platforms.filter(isQuickSetupPlatform)
}

export const CRED_STATUS = {
  configured: { label: 'Pronta para usar', cls: 'is-success' },
  incomplete: { label: 'Falta preencher', cls: 'is-flight' },
  pending: { label: 'Ainda não cadastrada', cls: 'is-skip' },
}

export function getPlatformStatus(platform, values) {
  const required = platform.fields.filter((field) => field.required !== false)
  const filled = required.filter((field) => String(values?.[field.key] ?? '').trim())
  if (filled.length === 0) return 'pending'
  if (filled.length < required.length) return 'incomplete'
  return 'configured'
}

// Regras de formato por campo de código de acesso — espelho de
// `ACCESS_CODE_RULES` em src/credentialHealth.js, que é a AUTORIDADE (o
// servidor recusa de novo). Aqui é só para avisar antes de enviar.
//
// `singleToken` marca o campo que é UM valor só. O código completo da Amazon e
// o pacote do ML são listas de pares (`a=1; b=2`) e podem ter espaço — aplicar
// a regra de espaço neles recusaria credencial legítima. `minLength` só existe
// onde há evidência do tamanho real: os códigos do ML que funcionam em produção
// têm 83-85 caracteres, então 30 é folgado e nunca barra quem está certo.
const ACCESS_CODE_RULES = {
  mercadolivre: {
    ssid: { singleToken: true, minLength: 30 },
    cookie: {},
  },
  amazon: {
    cookie: {},
    'ubid-acbbr': { singleToken: true },
    'at-acbbr': { singleToken: true },
    'x-acbbr': { singleToken: true },
  },
}

// Formato claramente errado no campo de código de acesso. Não é validação de
// "o código é válido na loja" (só a própria loja sabe) — é peneira para o que
// NUNCA pode funcionar: link colado no lugar do código, espaço onde não cabe,
// pedaço faltando. Sem isso, o painel respondia "Tudo certo!" para um link
// (caso real: conta com 537 recusas seguidas do Mercado Livre) e a pessoa não
// tinha como descobrir sozinha.
//
// Os textos precisam bater com os do servidor
// (test/credential-format-validation.test.js falha se divergirem).
export function describeInvalidAffiliateValue(platformId, fieldKey, rawValue) {
  if (platformId === 'aliexpress') {
    const value = String(rawValue ?? '').trim()
    if (!value) return ''
    if (fieldKey === 'cookie' && value.length > 120000) return 'Esse código está grande demais. Copie novamente usando o botão Export da extensão Cookie-Editor.'
    if (fieldKey === 'cookie' && /[\r\n\0]/.test(value)) {
      let unsafe = true
      try {
        const parsed = JSON.parse(value)
        const list = Array.isArray(parsed) ? parsed : [parsed]
        unsafe = list.some((item) => /[\r\n\0]/.test(String(item?.name ?? '')) || /[\r\n\0]/.test(String(item?.value ?? '')))
      } catch { unsafe = true }
      if (unsafe) return 'Esse código contém uma quebra inválida. Copie novamente usando o botão Export da extensão Cookie-Editor.'
    }
    let cookieLike = value.includes('=')
    if (!cookieLike && fieldKey === 'cookie') {
      try {
        const parsed = JSON.parse(value)
        cookieLike = Array.isArray(parsed) && parsed.some((item) => item && typeof item.name === 'string' && 'value' in item)
      } catch { cookieLike = false }
    }
    if (fieldKey === 'cookie' && !cookieLike) return 'Esse código não parece completo. Copie novamente usando o botão Export da extensão Cookie-Editor.'
    return ''
  }
  const regra = ACCESS_CODE_RULES[platformId]?.[fieldKey]
  if (!regra) return ''
  const value = String(rawValue ?? '').trim()
  if (!value) return ''

  if (/^https?:\/\//i.test(value)) {
    return 'Isso é um link, não o código de acesso. O código não começa com "http" — é uma sequência de letras e números que você copia com a extensão Cookie-Editor.'
  }
  if (regra.singleToken && /\s/.test(value)) {
    return 'O código não pode ter espaços no meio. Copie o valor inteiro, de uma vez só.'
  }
  if (regra.minLength && value.length < regra.minLength) {
    return 'Esse código está curto demais — parece que faltou um pedaço. Copie o valor inteiro do campo na extensão Cookie-Editor.'
  }
  return ''
}
