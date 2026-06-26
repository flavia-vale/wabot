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
        href: 'https://espelhagrupos.com.br/painel/tutorial#:~:text=Acesse%20o%20painel%20Shopee%20Open%20API',
      },
    ],
    fields: [
      { key: 'appId', label: 'App ID', hint: 'Identificador do seu app na Shopee.' },
      { key: 'secretKey', label: 'Secret Key', hint: 'Chave secreta do app (não compartilhe).', sensitive: true },
    ],
  },
  {
    id: 'amazon',
    label: 'Amazon',
    instructions: 'Onde obter: affiliate-program.amazon.com.br. A Tag vem do painel. Os cookies ubid-acbbr, at-acbbr e x-acbbr precisam ser copiados da sessão ativa logada na Amazon Brasil.',
    platformWarning: 'Para gerar link curto (amzn.to), preencha Tag e os 3 cookies da sua sessão Amazon.',
    fields: [
      { key: 'tag', label: 'ID de associado/StoreID', hint: 'Ex.: suatag-20' },
      { key: 'ubid-acbbr', label: 'Cookie ubid-acbbr', hint: 'Cookie de sessão da Amazon Brasil.', sensitive: true, help: 'Acesse amazon.com.br logado, abra o DevTools → Application → Cookies → amazon.com.br e copie o valor do cookie ubid-acbbr.' },
      { key: 'at-acbbr', label: 'Cookie at-acbbr', hint: 'Cookie de autenticação da Amazon Brasil.', sensitive: true, help: 'Mesmo painel do DevTools: copie o valor do cookie at-acbbr.' },
      { key: 'x-acbbr', label: 'Cookie x-acbbr', hint: 'Cookie de identificação da Amazon Brasil.', sensitive: true, help: 'Mesmo painel do DevTools: copie o valor do cookie x-acbbr.' },
    ],
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    instructions: 'Onde obter: afiliados.mercadolivre.com.br. A Etiqueta em uso vem do Gerador de Links; SSID é o cookie da sessão ativa e deve ser tratado como dado sensível.',
    platformWarning: 'Para gerar link curto (meli.la), preencha Etiqueta em uso e SSID.',
    fields: [
      { key: 'tag', label: 'Etiqueta em uso', hint: 'Copie exatamente como aparece no Mercado Livre.', help: 'Copie a etiqueta em uso exibida no Gerador de Links do Mercado Livre.' },
      { key: 'ssid', label: 'SSID (cookie)', hint: 'Cookie da sessão ativa do Mercado Livre.', sensitive: true, help: 'No navegador, acesse os cookies do Mercado Livre na sua sessão ativa e copie apenas o valor do cookie ssid. Não compartilhe esse valor fora do painel.' },
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
