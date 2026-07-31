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
