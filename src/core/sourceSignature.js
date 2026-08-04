import { isOfferUrl } from '../detector.js'

// Assinatura do grupo de ORIGEM colada no fim da oferta espelhada.
//
// RCA 2026-08 (cliente vitoriadasilvavasconcelos2@gmail.com): as ofertas
// espelhadas chegavam com uma linha final que ela não escreveu — `sharabarros`
// (assinatura do grupo "PROMOS DA SHARA") e `@ocasaljovemoficial_` (assinatura
// de outro grupo monitorado). Investigação em produção descartou TODAS as
// origens do nosso lado: `brandingGroupLink` vazio (sem rodapé de marca),
// `mobileTemplatesJson`/`mirrorTemplateKeyDefault`/`Group.templateKey` vazios
// (relay puro, sem template com `{{convitegrupo}}`), `preservationEnabled=0` +
// `copyVariationEnabled=0` e destino `@g.us` (`applyVariation` nem é chamada).
// O texto vinha da mensagem original e ATRAVESSAVA a limpeza inteira.
//
// Por que atravessava: os três filtros de `sanitizeInviteLinks` só pegam link
// de convite, URL com `http(s)://` fora dos marketplaces, e linha órfã que
// FALE "grupo/canal/whatsapp/telegram". Assinatura em texto puro não é nenhuma
// das três — `ANY_HTTP_URL_RE`/`isOfferUrl` exigem o protocolo, então texto sem
// link é literalmente invisível para o sanitizador.
//
// O caractere que precede a assinatura não pôde ser lido do banco (o
// `MessageLog` corta em 240 chars e a assinatura fica sempre depois disso), e
// no print ele admitia três leituras — citação (`> x`), pipe literal (`| x`,
// que a origem usa nos títulos: "180 x150cm | Cercadinho") e menção de contato
// (texto cru `@5511...` que o WhatsApp renderiza como o nome). As três estão
// cobertas aqui: os marcadores de prefixo são descascados antes da análise e a
// menção por telefone cai na mesma regra de `@handle`.

const HTTP_URL_RE = /https?:\/\/[^\s<>"'`]+/gi

// `@handle` genérico. Cobre tanto o perfil social (`@ocasaljovemoficial_`)
// quanto a menção de contato do WhatsApp, cujo texto cru é o telefone
// (`@5511987654321`) e só vira nome na renderização.
const SOCIAL_HANDLE_RE = /@[\p{L}\p{N}][\p{L}\p{N}._-]{1,49}/gu

// Domínio social escrito SEM protocolo — `removeNonOfferUrls` não enxerga
// esses (o regex dele exige `https?://`), então a linha chegava inteira aqui.
const SOCIAL_DOMAIN_RE = /(?<![\w.])(?:www\.)?(?:instagram\.com|tiktok\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be|threads\.net|threads\.com|kwai\.com|linktr\.ee|linktree\.com|beacons\.ai|bio\.link|linkbio\.co)\/[^\s]*/gi

// Marcadores de citação/lista/formatação que a origem usa como enfeite da
// assinatura. Descascados só para ANALISAR a linha — o texto original nunca é
// reescrito, a linha é mantida inteira ou removida inteira.
const WA_FORMATTING_RE = /[*_~`]/g
const LEADING_MARKERS_RE = /^[\s>|•·▪●◆»«¦\-–—]+/
const TRAILING_MARKERS_RE = /[\s>|•·:：\-–—.,!¦]+$/

// Vocabulário de conteúdo REAL de oferta. Se a linha final tiver qualquer um
// destes, ela não é assinatura — é informação que a cliente quer entregar.
// Protege os casos reais observados no log de produção dela, como
// "🎟️Use o cupom:*CASAPROMO*".
const OFFER_CONTENT_WORD_RE = /(?:frete|gr[áa]tis|cupom|cupons|desconto|oferta|promo|promoç[ãa]o|pre[çc]o|pix|entrega|estoque|link|compre|comprar|aproveite|corre|[úu]ltim|unidade|leve|pague|off|voucher|c[óo]digo|clube|assinatura|prime|full|vendido|avalia)/i

// Teto de linhas removidas por mensagem. Assinatura de grupo raramente passa
// de duas linhas, e um teto baixo limita o estrago caso alguma origem futura
// tenha um formato que a heurística leia errado.
const MAX_SIGNATURE_LINES = 2

// Teto de tamanho da assinatura "palavra solta". Acima disso é frase, e frase
// é conteúdo.
const MAX_BARE_SIGNATURE_CHARS = 40
const MAX_BARE_SIGNATURE_WORDS = 3

function hasHttpUrl(line) {
  HTTP_URL_RE.lastIndex = 0
  return HTTP_URL_RE.test(String(line ?? ''))
}

function hasOfferUrl(text) {
  const raw = String(text ?? '')
  HTTP_URL_RE.lastIndex = 0
  const matches = raw.match(HTTP_URL_RE)
  HTTP_URL_RE.lastIndex = 0
  return Boolean(matches?.some(url => isOfferUrl(url)))
}

function hasVisibleContent(text) {
  return /[\p{L}\p{N}]/u.test(String(text ?? ''))
}

// Núcleo textual da linha: sem marcadores de citação/pipe/lista e sem os
// marcadores de formatação do WhatsApp. Emoji são preservados de propósito —
// eles não contam como palavra na checagem abaixo, mas contam no tamanho.
function signatureCore(line) {
  return String(line ?? '')
    .replace(WA_FORMATTING_RE, '')
    .replace(LEADING_MARKERS_RE, '')
    .replace(TRAILING_MARKERS_RE, '')
    .trim()
}

// Linha que existe SÓ para carregar um perfil: `@handle`, menção de contato ou
// domínio social. Depois de tirar esses tokens não sobra nenhuma letra/dígito,
// só emoji e pontuação (ex.: `⚠ *😱😱😱.* *@ocasaljovemoficial_*`).
export function isSocialOnlyLine(line) {
  const raw = String(line ?? '')
  if (!raw.trim() || hasHttpUrl(raw)) return false

  SOCIAL_HANDLE_RE.lastIndex = 0
  SOCIAL_DOMAIN_RE.lastIndex = 0
  const hasSocialToken = SOCIAL_HANDLE_RE.test(raw) || SOCIAL_DOMAIN_RE.test(raw)
  SOCIAL_HANDLE_RE.lastIndex = 0
  SOCIAL_DOMAIN_RE.lastIndex = 0
  if (!hasSocialToken) return false

  const residue = raw
    .replace(SOCIAL_DOMAIN_RE, '')
    .replace(SOCIAL_HANDLE_RE, '')
    .replace(WA_FORMATTING_RE, '')
  SOCIAL_HANDLE_RE.lastIndex = 0
  SOCIAL_DOMAIN_RE.lastIndex = 0

  return !hasVisibleContent(residue)
}

// Assinatura "palavra solta", sem `@` e sem domínio — o caso `sharabarros`.
// Deliberadamente estreita: sem link, sem dígito (protege preço/%/R$), no
// máximo 3 palavras (protege frase legítima como "Corre porque o valor pode
// mudar em minutos!") e sem nenhuma palavra do vocabulário de oferta.
export function isBareSignatureLine(line) {
  const raw = String(line ?? '')
  if (hasHttpUrl(raw)) return false

  const core = signatureCore(raw)
  if (!core || core.length > MAX_BARE_SIGNATURE_CHARS) return false
  if (/\d/.test(core)) return false
  if (OFFER_CONTENT_WORD_RE.test(core)) return false

  const words = core.split(/\s+/).filter(word => /\p{L}/u.test(word))
  return words.length > 0 && words.length <= MAX_BARE_SIGNATURE_WORDS
}

function lastNonEmptyIndex(lines, before = lines.length) {
  for (let i = Math.min(before, lines.length) - 1; i >= 0; i--) {
    if (String(lines[i] ?? '').trim()) return i
  }
  return -1
}

// Remove a assinatura do grupo de origem colada no FIM da oferta.
//
// Invariantes de segurança (não relaxar sem revalidar contra o log real):
// 1. Só age em mensagem que tem link de OFERTA — fora de espelhamento de
//    oferta a função é no-op.
// 2. Nunca toca em linha que contenha URL.
// 3. A regra de "palavra solta" exige que a linha anterior seja a linha do
//    LINK. É isso que impede a heurística de comer o fim do título do produto
//    ("...Cinza Qualidade") numa mensagem cujo link não esteja no fim.
// 4. Remove a linha inteira ou nada — nunca reescreve o texto da cliente.
export function stripTrailingSourceSignature(text) {
  const raw = String(text ?? '')
  if (!raw.trim() || !hasOfferUrl(raw)) return raw

  const lines = raw.split('\n')
  let removed = 0

  while (removed < MAX_SIGNATURE_LINES) {
    const index = lastNonEmptyIndex(lines)
    if (index < 0) break

    const line = lines[index]
    if (hasHttpUrl(line)) break

    if (isSocialOnlyLine(line)) {
      lines.splice(index, 1)
      removed++
      continue
    }

    const previousIndex = lastNonEmptyIndex(lines, index)
    const previousIsLinkLine = previousIndex >= 0 && hasOfferUrl(lines[previousIndex])
    if (previousIsLinkLine && isBareSignatureLine(line)) {
      lines.splice(index, 1)
      removed++
      continue
    }

    break
  }

  return removed ? lines.join('\n') : raw
}
