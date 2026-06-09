import { NextResponse } from 'next/server'
import { resolveAppRedirect } from './lib/ui-variant/routeMap'

/* Consolidação em rota única responsiva (Fase 2).
 *
 * Antes existiam duas fronts de app especializadas por device: /m (mobile) e
 * /painel (web). O /painel passou a ser totalmente responsivo, então toda
 * variante de device é servida por ele — não há mais detecção por user-agent
 * nem override por ?view=.
 *
 * As árvores legadas /m/* e /dashboard/* deixam de renderizar e redirecionam
 * (não 404) para o equivalente em /painel, preservando bookmarks e returns de
 * pagamento. O mapeamento canônico vive em lib/ui-variant/routeMap.js.
 *
 * Rollback: restaurar a resolução por variante (resolveVariant + cookie
 * ui_variant) e voltar a renderizar /m/*. As páginas /m só são removidas na
 * Fase 3, então o rollback é só de roteamento.
 */
export function middleware(request) {
  const { nextUrl } = request

  // `variant: 'web'` fixo → /painel nunca redireciona; /m/* e /dashboard/*
  // sempre caem no equivalente web. Sem variante mobile, não há risco de loop.
  const redirectTarget = resolveAppRedirect({ pathname: nextUrl.pathname, variant: 'web' })
  if (!redirectTarget) return NextResponse.next()

  const url = nextUrl.clone()
  url.pathname = redirectTarget
  // ?view= é resquício da antiga troca de variante; tiramos da URL final.
  url.searchParams.delete('view')
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
