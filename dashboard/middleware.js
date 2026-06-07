import { NextResponse } from 'next/server'
import { resolveVariant, UI_VARIANT_COOKIE, normalizeVariant } from './lib/ui-variant/device'
import { resolveAppRedirect } from './lib/ui-variant/routeMap'

export function middleware(request) {
  const { nextUrl } = request
  const queryValue = nextUrl.searchParams.get('view')
  const cookieValue = request.cookies.get(UI_VARIANT_COOKIE)?.value
  const userAgent = request.headers.get('user-agent') || ''

  const variant = resolveVariant({ queryValue, cookieValue, userAgent })
  const normalizedQuery = normalizeVariant(queryValue)

  const redirectTarget = resolveAppRedirect({ pathname: nextUrl.pathname, variant })

  let response
  if (redirectTarget) {
    const url = nextUrl.clone()
    url.pathname = redirectTarget
    // Override manual (?view=) já cumpriu seu papel ao definir o variant;
    // tiramos da URL final para não ficar grudado na navegação seguinte.
    url.searchParams.delete('view')
    response = NextResponse.redirect(url)
  } else {
    response = NextResponse.next()
  }

  if (normalizedQuery || !cookieValue) {
    response.cookies.set(UI_VARIANT_COOKIE, variant, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
