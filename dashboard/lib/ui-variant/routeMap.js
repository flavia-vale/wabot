/* Mapa canônico de rotas entre as duas fronts de UI e o legado.
 *
 * - `m`        → front mobile (/m/*, MobileShell)
 * - `painel`   → front web/desktop (/painel/*, PainelShell) — alvo da consolidação
 * - `dashboard`→ legado (/dashboard/*), mantido como fallback web na Fase 1
 *               e aposentado na Fase 2 (vide docs/frontend/parity-matrix.md).
 *
 * O middleware usa este mapa para redirecionar o visitante para a árvore
 * correta ao device dele (cookie `ui_variant`). Cada coluna não-nula é única
 * dentro da própria árvore, então o casamento por prefixo é determinístico.
 *
 * Telas exclusivas de uma front (ex.: /m/op/espelhar, /m/account/variations)
 * têm as outras colunas como `null`: como o usuário nunca chega nelas pela
 * front errada, elas só precisam existir como destino quando há equivalente.
 */

export const ROUTE_MAP = [
  { feature: 'home',        m: '/m',                       painel: '/painel',                    dashboard: '/dashboard/inicio' },
  { feature: 'whatsapp',    m: '/m/config/whatsapp',       painel: '/painel/whatsapp',           dashboard: '/dashboard' },
  { feature: 'groups',      m: '/m/config/groups',         painel: '/painel/grupos',             dashboard: '/dashboard/grupos' },
  { feature: 'credentials', m: '/m/config/credentials',    painel: '/painel/ids-afiliada',       dashboard: '/dashboard/credenciais' },
  { feature: 'preferences', m: '/m/config/preferences',    painel: '/painel/configuracoes',      dashboard: '/dashboard/configuracoes' },
  { feature: 'preservacao', m: '/m/config/preservacao',    painel: null,                         dashboard: '/dashboard/preservacao' },
  { feature: 'logs',        m: '/m/op/logs',               painel: '/painel/envios',             dashboard: '/dashboard/logs' },
  { feature: 'broadcast',   m: '/m/op/broadcast',          painel: null,                         dashboard: '/dashboard/envio' },
  { feature: 'scheduled',   m: '/m/op/scheduled',          painel: null,                         dashboard: null },
  { feature: 'converter',   m: '/m/op/converter',          painel: null,                         dashboard: '/dashboard/converte-links' },
  { feature: 'offer',       m: '/m/op/offer',              painel: '/painel/criar-oferta',       dashboard: '/dashboard/gerar-oferta' },
  { feature: 'automations', m: '/m/op/automations',        painel: '/painel/ofertas-automaticas', dashboard: '/dashboard/ofertas-automaticas' },
  { feature: 'espelhar',    m: '/m/op/espelhar',           painel: null,                         dashboard: null },
  { feature: 'messages',    m: '/m/account/templates',     painel: '/painel/mensagens',          dashboard: '/dashboard/variacoes-de-texto' },
  { feature: 'variations',  m: '/m/account/variations',    painel: null,                         dashboard: null },
  { feature: 'plan',        m: '/m/account/subscription',  painel: '/painel/plano',              dashboard: '/dashboard/assinaturas' },
  { feature: 'tutorial',    m: '/m/tutorial',              painel: null,                         dashboard: '/dashboard/tutorial' },
  { feature: 'account',     m: '/m/account',               painel: null,                         dashboard: null },
  { feature: 'checklist',   m: '/m/checklistespelhamento', painel: null,                         dashboard: null },
]

/** Identifica a qual árvore de app um pathname pertence (ou null). */
export function classifyTree(pathname) {
  if (pathname === '/m' || pathname.startsWith('/m/')) return 'm'
  if (pathname === '/painel' || pathname.startsWith('/painel/')) return 'painel'
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard'
  return null
}

/** Acha a entrada do mapa cujo caminho na árvore é o maior prefixo do pathname. */
function findFeature(pathname, tree) {
  let best = null
  let bestLen = -1
  for (const entry of ROUTE_MAP) {
    const p = entry[tree]
    if (!p) continue
    const matches = pathname === p || pathname.startsWith(`${p}/`)
    if (matches && p.length > bestLen) {
      best = entry
      bestLen = p.length
    }
  }
  return best
}

/**
 * Decide o redirect de roteamento por device.
 *
 * Regras (Fase 1):
 * - variant `mobile` em /painel/* ou /dashboard/* → equivalente em /m (ou /m).
 * - variant `web` em /m/* → equivalente em /painel; se a tela ainda não foi
 *   portada (painel null), cai no /dashboard correspondente; senão /painel.
 * - variant `web` em /dashboard/* → SEM redirect (legado segue como fallback
 *   web até a Fase 2 aposentá-lo).
 *
 * Retorna o pathname de destino, ou `null` quando nenhum redirect é preciso.
 * Nunca redireciona para dentro da mesma variante de destino → sem loop.
 */
export function resolveAppRedirect({ pathname, variant }) {
  const tree = classifyTree(pathname)
  if (!tree) return null

  if (variant === 'mobile') {
    if (tree === 'm') return null
    const entry = findFeature(pathname, tree)
    const target = entry?.m || '/m'
    return target === pathname ? null : target
  }

  // variant === 'web'
  if (tree === 'painel' || tree === 'dashboard') return null
  const entry = findFeature(pathname, 'm')
  const target = entry?.painel || entry?.dashboard || '/painel'
  return target === pathname ? null : target
}
