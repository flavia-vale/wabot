import { NextResponse } from 'next/server'
import { resolveVariant, UI_VARIANT_COOKIE, normalizeVariant } from './lib/ui-variant/device'

export function middleware(request) {
  const queryValue = request.nextUrl.searchParams.get('view')
  const cookieValue = request.cookies.get(UI_VARIANT_COOKIE)?.value
  const userAgent = request.headers.get('user-agent') || ''

  const variant = resolveVariant({ queryValue, cookieValue, userAgent })
  const response = NextResponse.next()

  const normalizedQuery = normalizeVariant(queryValue)
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
