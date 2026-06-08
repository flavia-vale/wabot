export const mobileCredentialPlatforms = [
  {
    id: 'shopee',
    label: 'Shopee',
    color: '#EE4D2D',
    instructions: 'Use App ID e Secret Key da API de Afiliados da Shopee.',
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
      { key: 'appId', label: 'App ID', required: true },
      { key: 'secretKey', label: 'Secret Key', required: true, sensitive: true },
    ],
  },
  {
    id: 'amazon',
    label: 'Amazon',
    color: '#FF9900',
    instructions: 'Use sua tag de associado e cookies ativos da Amazon Brasil para links curtos.',
    fields: [
      { key: 'tag', label: 'ID de associado/StoreID', required: true },
      { key: 'ubid-acbbr', label: 'Cookie ubid-acbbr', required: true, sensitive: true },
      { key: 'at-acbbr', label: 'Cookie at-acbbr', required: true, sensitive: true },
      { key: 'x-acbbr', label: 'Cookie x-acbbr', required: true, sensitive: true },
    ],
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    color: '#FFE600',
    instructions: 'Use sua tag numérica e SSID da sessão ativa do Mercado Livre.',
    fields: [
      { key: 'tag', label: 'Tag numérica', required: true },
      { key: 'ssid', label: 'SSID (cookie)', required: true, sensitive: true },
    ],
  },
  {
    id: 'magazineluiza',
    label: 'Magalu',
    color: '#0086FF',
    instructions: 'Use a tag de afiliado do painel Magazine Luiza.',
    fields: [
      { key: 'tag', label: 'Tag de afiliado', required: true },
    ],
  },
]

export function isCredentialComplete(platform, data = {}) {
  return platform.fields
    .filter((field) => field.required !== false)
    .every((field) => String(data[field.key] ?? '').trim().length > 0)
}

export function credentialSummary(platform, data = {}) {
  const required = platform.fields.filter((field) => field.required !== false)
  const filled = required.filter((field) => String(data[field.key] ?? '').trim()).length
  if (filled === 0) return 'não conectado'
  if (filled < required.length) return `${filled}/${required.length} campos`
  return 'ativo'
}
