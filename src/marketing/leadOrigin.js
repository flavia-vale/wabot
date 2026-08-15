/* Classificação de origem de lead (auditoria de funil, 2026-08).
 *
 * ⚠️ ARMADILHA QUE INVERTE A CONCLUSÃO — leia antes de mexer:
 *
 * Os campos `utm_source` / `utm_medium` gravados em `signup_created` NÃO dizem
 * de onde veio o tráfego. Os próprios botões do site os carimbam: veja
 * `buildRegisterHref` em dashboard/lib/marketing-attribution.js, que usa
 * `source: 'landing'` e `medium: 'organic'` por padrão. Ou seja, TODO cadastro
 * feito por um botão nosso nasce com `utm_medium=organic`, mesmo que a pessoa
 * tenha chegado por indicação, Instagram ou digitando o endereço.
 *
 * Agrupar cadastro por `utm_source` levaria à conclusão de que "quase tudo é
 * orgânico" — que é falso e faria investir no canal errado. Por isso a
 * classificação aqui usa, nesta ordem: código de parceiro > código de
 * indicação > PRIMEIRA PÁGINA visitada (`landing_page`, first-touch, gravada
 * por `captureFirstTouchLandingPage`). A primeira página é o sinal honesto:
 * quem cai num artigo do blog descobriu o site por conteúdo; quem cai na home
 * já sabia o nome.
 *
 * Módulo puro (sem I/O) para ser testável sem banco.
 */

export const LEAD_ORIGINS = {
  PARTNER: 'parceiro',
  REFERRAL: 'indicacao',
  CONTENT: 'conteudo',
  HOME: 'home',
  UNKNOWN: 'sem_atribuicao',
}

export const LEAD_ORIGIN_LABELS = {
  [LEAD_ORIGINS.PARTNER]: 'Parceiro / influenciador (link de afiliado)',
  [LEAD_ORIGINS.REFERRAL]: 'Indicação de outro cliente',
  [LEAD_ORIGINS.CONTENT]: 'Conteúdo (blog/LP) — sinal de descoberta por busca',
  [LEAD_ORIGINS.HOME]: 'Home direto — marca, link colado ou já conhecia',
  [LEAD_ORIGINS.UNKNOWN]: 'Sem atribuição (cadastro anterior ao rastreio)',
}

// Caminhos que NÃO são conteúdo de descoberta: são passos do próprio fluxo.
const NON_CONTENT_PATHS = new Set(['/', '/login', '/cadastro', '/painel'])

function normalizePath(rawLandingPage) {
  const value = String(rawLandingPage ?? '').trim()
  if (!value) return ''
  // `landing_page` guarda pathname + query. Só o caminho importa aqui, e a
  // query pode carregar dado da pessoa (nunca usar para agrupar).
  const withoutQuery = value.split('?')[0].split('#')[0]
  if (!withoutQuery.startsWith('/')) return ''
  // Normaliza barra final para "/blog/x/" e "/blog/x" caírem no mesmo balde.
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : '/'
}

function hasValue(raw) {
  if (raw === null || raw === undefined) return false
  const value = String(raw).trim()
  return value !== '' && value !== 'null' && value !== 'none'
}

/**
 * Classifica a origem de um cadastro a partir da metadata de `signup_created`.
 * @returns {{ origin: string, landingPath: string }}
 */
export function classifySignupOrigin(metadata = {}) {
  const landingPath = normalizePath(metadata.landing_page)

  // Código de parceiro é o sinal mais forte: só existe se a pessoa clicou no
  // link de alguém. Vem antes da primeira página porque um parceiro pode
  // mandar a audiência dele direto para um artigo.
  if (hasValue(metadata.aff_code)) return { origin: LEAD_ORIGINS.PARTNER, landingPath }
  if (hasValue(metadata.ref)) return { origin: LEAD_ORIGINS.REFERRAL, landingPath }

  if (!landingPath) return { origin: LEAD_ORIGINS.UNKNOWN, landingPath }
  if (NON_CONTENT_PATHS.has(landingPath)) return { origin: LEAD_ORIGINS.HOME, landingPath }

  return { origin: LEAD_ORIGINS.CONTENT, landingPath }
}

/** Lê a metadata (string JSON no banco) sem lançar. */
export function parseEventMetadata(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Agrega cadastros por origem, cruzando com ativação e pagamento.
 * @param {Array<{userId: string, metadata: object}>} signups
 * @param {Set<string>} activatedUserIds — quem chegou a conectar/enviar
 * @param {Set<string>} payingUserIds
 */
export function summarizeLeadOrigins(signups, activatedUserIds = new Set(), payingUserIds = new Set()) {
  const buckets = new Map()

  for (const signup of signups) {
    const { origin, landingPath } = classifySignupOrigin(signup.metadata)
    if (!buckets.has(origin)) {
      buckets.set(origin, { origin, signups: 0, activated: 0, paying: 0, landingPages: new Map() })
    }
    const bucket = buckets.get(origin)
    bucket.signups += 1
    if (signup.userId && activatedUserIds.has(signup.userId)) bucket.activated += 1
    if (signup.userId && payingUserIds.has(signup.userId)) bucket.paying += 1
    if (landingPath) {
      bucket.landingPages.set(landingPath, (bucket.landingPages.get(landingPath) ?? 0) + 1)
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      landingPages: [...bucket.landingPages.entries()]
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => b.signups - a.signups || a.origin.localeCompare(b.origin))
}
