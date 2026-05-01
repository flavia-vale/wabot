// Magalu: inject tag as query param
export async function convert(url, creds) {
  const { tag } = creds
  try {
    const u = new URL(url)
    u.searchParams.set('partner_id', tag)
    u.searchParams.set('utm_source', 'afiliados')
    return u.toString()
  } catch {
    return null
  }
}
