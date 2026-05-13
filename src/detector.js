const PATTERNS = {
  mercadolivre: /https?:\/\/(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la|mluvem\.com)[^\s]*/gi,
  amazon:       /https?:\/\/(?:www\.)?(?:amazon\.com\.br|amzn\.to|a\.co|amzn\.divulgador\.link)[^\s]*/gi,
  shopee:       /https?:\/\/(?:shope\.ee|shopee\.com\.br|s\.shopee\.com\.br)[^\s]*/gi,
  magazineluiza:/https?:\/\/(?:www\.)?(?:magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)[^\s]*/gi,
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
