/* Config das plataformas de afiliado para a tela "IDs de afiliada" do novo
 * painel. Centraliza a configuração das plataformas exibidas nas credenciais — é config de
 * UI (rótulos, campos, instruções), sem regra de negócio. O salvamento usa os
 * mesmos endpoints (api.credentials / api.saveCredential). */

export const AFFILIATE_PLATFORMS = [
  {
    id: 'shopee',
    label: 'Shopee',
    instructions: 'Onde obter: affiliate.shopee.com.br → Ferramentas → API de Afiliados → Gerar credenciais. Mantenha o Secret Key privado.',
    actionLinks: [
      {
        label: 'Solicite sua API Shopee',
        href: 'https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=',
      },
      {
        label: 'Pegue suas credenciais',
        href: 'https://affiliate.shopee.com.br/open_api',
      },
    ],
    fields: [
      { key: 'appId', label: 'App ID', hint: 'Identificador do seu app na Shopee.' },
      { key: 'secretKey', label: 'Secret Key', hint: 'Chave secreta do app (não compartilhe).', sensitive: true },
    ],
  },
  {
    id: 'cookieEditorInfo',
    type: 'info',
    label: 'Extensão necessária',
    instructions: 'Para pegar as credenciais das lojas abaixo é necessário você estar em um computador e instalar essa extensão em seu Google Chrome:',
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
    instructions: 'Onde obter: associados.amazon.com.br. A Tag vem do painel. Para o link curto (amzn.to) sair de forma estável, cole o Cookie completo da sessão logada na Amazon Brasil (recomendado) — os 3 cookies separados param de autenticar em poucos dias e precisarão ser renovados.',
    actionLinks: [
      {
        label: 'Pegue suas credenciais',
        href: 'https://associados.amazon.com.br',
      },
    ],
    platformWarning: 'Para gerar link curto (amzn.to), preencha a Tag e o Cookie completo da sessão Amazon. Sem isso, a oferta ainda sai (com o link longo ?tag=), mas sem encurtar.',
    fields: [
      { key: 'tag', label: 'ID de associado/StoreID', hint: 'Ex.: suatag-20' },
      { key: 'cookie', label: 'Cookie completo da sessão (recomendado)', required: false, sensitive: true, hint: 'Sessão completa logada da Amazon Brasil — mais estável que os 3 cookies separados.', help: 'Logada em https://associados.amazon.com.br/ use a extensão Cookie-Editor → Export (botão no lado direito inferior) → JSON. Automaticamente o código é copiado e é só colá-lo aqui.' },
      { key: 'ubid-acbbr', label: 'Cookie ubid-acbbr (alternativo)', required: false, hint: 'Alternativa legada ao Cookie completo. Cookie de sessão da Amazon Brasil.', sensitive: true, help: 'Só precisa preencher se NÃO usar o Cookie completo acima. DevTools → Application → Cookies → amazon.com.br → copie o valor do cookie ubid-acbbr.' },
      { key: 'at-acbbr', label: 'Cookie at-acbbr (alternativo)', required: false, hint: 'Alternativa legada ao Cookie completo. Cookie de autenticação da Amazon Brasil.', sensitive: true, help: 'Só precisa preencher se NÃO usar o Cookie completo acima. Mesmo painel do DevTools: copie o valor do cookie at-acbbr.' },
      { key: 'x-acbbr', label: 'Cookie x-acbbr (alternativo)', required: false, hint: 'Alternativa legada ao Cookie completo. Cookie de identificação da Amazon Brasil.', sensitive: true, help: 'Só precisa preencher se NÃO usar o Cookie completo acima. Mesmo painel do DevTools: copie o valor do cookie x-acbbr.' },
    ],
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    instructions: 'Onde obter: https://www.mercadolivre.com.br/afiliados/linkbuilder#hub . A Etiqueta em uso vem do Gerador de Links; SSID é o cookie da sessão ativa e deve ser pegado usando o Cookies Editor.',
    actionLinks: [
      {
        label: 'Pegue suas credenciais',
        href: 'https://www.mercadolivre.com.br/afiliados/linkbuilder#hub',
      },
    ],
    platformWarning: 'Para gerar link curto (meli.la), preencha Etiqueta em uso e SSID.',
    fields: [
      { key: 'tag', label: 'Etiqueta em uso', hint: 'Copie exatamente como aparece no Mercado Livre.', help: 'Copie a etiqueta em uso exibida no Gerador de Links do Mercado Livre.' },
      { key: 'ssid', label: 'SSID (cookie)', hint: 'Cookie da sessão ativa do Mercado Livre.', sensitive: true, help: 'No navegador, acesse os cookies do Mercado Livre na sua sessão ativa e copie apenas o valor do cookie ssid. Não compartilhe esse valor fora do painel.' },
      { key: 'vitrineUrl', label: 'Link da sua vitrine (opcional)', required: false, hint: 'Usado quando um link compartilhado é a vitrine/perfil de OUTRA loja — o Mercado Livre não permite gerar link de afiliado para vitrine de terceiro.', help: 'Cole aqui o link da SUA própria vitrine/perfil de afiliada no Mercado Livre (ex.: mercadolivre.com.br/social/seu-usuario). Quando um link compartilhado for uma vitrine de outra loja (sem produto específico), em vez de descartar a mensagem o bot substitui pelo link da sua vitrine.' },
    ],
  },
  {
    id: 'magazineluiza',
    label: 'Magazine Luiza',
    instructions: 'Onde obter: painel de afiliados do Magazine Luiza. Copie a tag usada nos seus links de afiliado.',
    fields: [{ key: 'tag', label: 'Tag de afiliado', hint: 'Ex.: parceiro123' }],
  },
]

export const CRED_STATUS = {
  configured: { label: 'Configurado', cls: 'is-success' },
  incomplete: { label: 'Incompleto', cls: 'is-flight' },
  pending: { label: 'Pendente', cls: 'is-skip' },
}

export function getPlatformStatus(platform, values) {
  const required = platform.fields.filter((field) => field.required !== false)
  const filled = required.filter((field) => String(values?.[field.key] ?? '').trim())
  if (filled.length === 0) return 'pending'
  if (filled.length < required.length) return 'incomplete'
  return 'configured'
}
