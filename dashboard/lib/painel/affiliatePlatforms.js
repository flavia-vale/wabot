/* Config das plataformas de afiliado para a tela "IDs de afiliada" do novo
 * painel. Centraliza a configuração das plataformas exibidas nas credenciais — é config de
 * UI (rótulos, campos, instruções), sem regra de negócio. O salvamento usa os
 * mesmos endpoints (api.credentials / api.saveCredential). */

export const AFFILIATE_PLATFORMS = [
  {
    id: 'shopee',
    label: 'Shopee',
    instructions: 'Onde pegar: no site de afiliados da Shopee, em Ferramentas → API de Afiliados → Gerar credenciais. A chave secreta é sua: não passe para ninguém.',
    actionLinks: [
      {
        label: 'Pedir seu acesso na Shopee',
        href: 'https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=',
      },
      {
        label: 'Abrir a página da loja',
        href: 'https://affiliate.shopee.com.br/open_api',
      },
    ],
    fields: [
      { key: 'appId', label: 'App ID da Shopee', hint: 'Número que identifica seu acesso na Shopee.' },
      { key: 'secretKey', label: 'Chave secreta da Shopee', hint: 'Guarde só aqui — não passe para mais ninguém.', sensitive: true },
    ],
  },
  {
    id: 'cookieEditorInfo',
    type: 'info',
    label: 'Extensão necessária',
    instructions: 'Para pegar os dados das lojas abaixo, use um computador com Google Chrome e instale esta extensão gratuita:',
    actionLinks: [
      {
        label: 'Cookie-Editor',
        href: 'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm?pli=1',
      },
    ],
  },
  {
    id: 'amazon',
    label: 'Amazon',
    instructions: 'Onde pegar: no site de associados da Amazon (link abaixo). A etiqueta aparece na própria tela. O código de acesso é o que deixa o link curtinho — prefira o código completo: os três códigos separados vencem em poucos dias.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://associados.amazon.com.br',
      },
    ],
    platformWarning: 'Com a etiqueta e o código de acesso, o link da oferta sai curtinho. Só com a etiqueta, a oferta sai do mesmo jeito — o link só fica mais comprido.',
    sessionCareNote: 'Depois de colar o código aqui, NÃO clique em "Sair" na Amazon e não use janela anônima. Sair da conta derruba o código na hora, e você vai precisar cadastrar tudo de novo. Pode fechar a aba normalmente — só não sair da conta.',
    fields: [
      { key: 'tag', label: 'Sua etiqueta de afiliada (ID de associado)', hint: 'É o código que identifica suas vendas. Ex.: suaetiqueta-20' },
      { key: 'cookie', label: 'Código de acesso da sua conta (recomendado)', required: false, sensitive: true, cookieField: true, hint: 'Necessário para o link da oferta sair curtinho. Use este ou os três códigos alternativos abaixo.', help: 'No computador, entre em associados.amazon.com.br já logada, clique na extensão Cookie-Editor → botão Export (canto inferior direito) → JSON. O código é copiado sozinho; é só colar aqui.' },
      { key: 'ubid-acbbr', label: 'Código alternativo 1 (ubid-acbbr)', required: false, cookieField: true, hint: 'Só se você não usar o código completo acima.', sensitive: true, help: 'Só precisa se NÃO colou o código completo acima. É um dos três códigos separados da Amazon, encontrados na mesma extensão Cookie-Editor.' },
      { key: 'at-acbbr', label: 'Código alternativo 2 (at-acbbr)', required: false, cookieField: true, hint: 'Só se você não usar o código completo acima.', sensitive: true, help: 'Só precisa se NÃO colou o código completo acima. Mesmo lugar da extensão Cookie-Editor.' },
      { key: 'x-acbbr', label: 'Código alternativo 3 (x-acbbr)', required: false, cookieField: true, hint: 'Só se você não usar o código completo acima.', sensitive: true, help: 'Só precisa se NÃO colou o código completo acima. Mesmo lugar da extensão Cookie-Editor.' },
    ],
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    instructions: 'Onde pegar: no Gerador de Links do Mercado Livre (link abaixo). A etiqueta aparece na própria tela; o código de acesso (SSID) você copia com a extensão Cookie-Editor, no computador.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://www.mercadolivre.com.br/afiliados/linkbuilder#hub',
      },
    ],
    platformWarning: 'Com a etiqueta e o código de acesso, o link da oferta sai curtinho. Só com a etiqueta, a oferta sai do mesmo jeito — o link só fica mais comprido.',
    sessionCareNote: 'Depois de colar o código aqui, NÃO clique em "Sair" no Mercado Livre e não use janela anônima. Sair da conta derruba o código na hora, e você vai precisar cadastrar tudo de novo. Pode fechar a aba normalmente — só não sair da conta.',
    fields: [
      { key: 'tag', label: 'Sua etiqueta de afiliada', hint: 'Copie igualzinho ao que aparece no Mercado Livre.', help: 'É a "etiqueta em uso" que aparece na tela do Gerador de Links do Mercado Livre.' },
      { key: 'ssid', label: 'Código de acesso da sua conta (SSID)', hint: 'Necessário para o link da oferta sair curtinho.', sensitive: true, cookieField: true, help: 'No computador, com o Mercado Livre aberto e logado, clique na extensão Cookie-Editor, procure o item chamado ssid e copie o valor dele. Não passe esse código para mais ninguém.' },
      { key: 'vitrineUrl', label: 'Link da sua vitrine (opcional)', required: false, hint: 'Serve para quando chega um link da lojinha de outra pessoa, sem produto específico.', help: 'Cole o link da SUA vitrine no Mercado Livre (ex.: mercadolivre.com.br/social/seu-usuario). Quando chegar um link da vitrine de outra pessoa, em vez de descartar a mensagem o robô troca pelo link da sua.' },
    ],
  },
  {
    id: 'magazineluiza',
    label: 'Magazine Luiza',
    instructions: 'Onde pegar: no painel de afiliados do Magazine Luiza. Copie a etiqueta que aparece nos seus links.',
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
    instructions: 'Onde pegar: no painel de afiliada da SHEIN, use o Gerador de Link para gerar o seu link de afiliada. Cole aqui o link inteiro ou apenas o seu número de afiliada. O link do botão de compartilhar do aplicativo não serve — ele é para uso pessoal, não para cadastro.',
    actionLinks: [
      {
        label: 'Abrir a página da loja',
        href: 'https://www.shein.com/affiliate',
      },
    ],
    fields: [
      { key: 'tag', label: 'Seu link de afiliada da SHEIN (ou seu número de afiliada)', hint: 'Cole o link que você gera no painel de afiliada, ou só o número.' },
    ],
  },
]

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
