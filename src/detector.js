// Aceita qualquer subdomínio antes do domínio registrável (produto., lista.,
// m., www. etc.). `(?:[a-z0-9-]+\.)*` exige um ponto separador, então não
// casa hosts coladas como `notmercadolivre.com.br`.
const PATTERNS = {
  mercadolivre: /https?:\/\/(?:[a-z0-9-]+\.)*(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la|mluvem\.com)[^\s]*/gi,
  amazon:       /https?:\/\/(?:[a-z0-9-]+\.)*(?:amazon\.com\.br|amzn\.to|a\.co|amzn\.divulgador\.link|amzlink\.to)[^\s]*/gi,
  shopee:       /https?:\/\/(?:[a-z0-9-]+\.)*(?:shope\.ee|shopee\.com\.br)[^\s]*/gi,
  magazineluiza:/https?:\/\/(?:[a-z0-9-]+\.)*(?:magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)[^\s]*/gi,
}

export function detectLinks(text) {
  const found = []
  for (const [platform, regex] of Object.entries(PATTERNS)) {
    regex.lastIndex = 0
    const matches = text.match(regex)
    if (matches) {
      for (const url of matches) {
        found.push({ platform, url: url.replace(/[.,;!?)'">]+$/, '') })
      }
    }
  }
  return found
}
