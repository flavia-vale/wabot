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
const HANDLE_SRC = '@[\\p{L}\\p{N}][\\p{L}\\p{N}._-]{1,49}'

// Domínio social escrito SEM protocolo — `removeNonOfferUrls` não enxerga
// esses (o regex dele exige `https?://`), então a linha chegava inteira aqui.
const DOMAIN_SRC = '(?<![\\w.])(?:www\\.)?(?:instagram\\.com|tiktok\\.com|facebook\\.com|fb\\.com|youtube\\.com|youtu\\.be|threads\\.net|threads\\.com|kwai\\.com|linktr\\.ee|linktree\\.com|beacons\\.ai|bio\\.link|linkbio\\.co)\\/[^\\s]*'

const SOCIAL_HANDLE_RE = new RegExp(HANDLE_SRC, 'gu')
const SOCIAL_DOMAIN_RE = new RegExp(DOMAIN_SRC, 'gui')

// Rótulo curto de marca que algumas origens colocam antes do perfil. Mantido
// deliberadamente exato: ampliar para qualquer texto + @handle faria chamadas
// legítimas como "Siga @fulano para mais ofertas" virarem assinatura.
const SOCIAL_BRAND_LABEL_RE = /^promos\s+das$/i

// Cauda social no FIM de uma linha: um ou mais tokens sociais separados apenas
// por espaço, pontuação, emoji e marcadores de formatação. Existe para o caso
// em que a origem gruda a assinatura na MESMA linha do link — aí remover a
// linha inteira levaria o link junto, então aparamos só a cauda.
// A classe `[\s\p{P}\p{S}]` não inclui letra nem dígito, então a cauda nunca
// avança para dentro da URL nem para dentro do texto da oferta.
const TRAILING_SOCIAL_TAIL_RE = new RegExp(
  `(?:[\\s\\p{P}\\p{S}]*(?:${HANDLE_SRC}|${DOMAIN_SRC}))+[\\s\\p{P}\\p{S}]*$`,
  'iu',
)

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
const OFFER_CONTENT_WORD_RE = /(?:frete|gr[áa]tis|cupom|cupons|desconto|oferta|promo|promoç[ãa]o|pre[çc]o|pix|entrega|estoque|link|compre|comprar|aproveite|corre|[úu]ltim|unidade|leve|pague|off|voucher|c[óo]digo|clube|assinatura|prime|full|vendido|avalia|tempo|limitad|v[áa]lid|durar|hoje|agora|resgat|garant)/i

// Linha de CRÉDITO/autoria: `/Vitrinedadecor - Por Marla Tavares`.
// Terceira forma encontrada em produção (grupo "PROMO FESTAS", 2026-08). Não
// tem `@`, não tem domínio social e tem 4 palavras — passava do teto de 3 da
// regra de "palavra solta". O que a identifica é o formato de assinatura:
// marca prefixada por `/` ou `@`, e/ou crédito "Por <Nome Próprio>".
const CREDIT_PREFIX_RE = /^[/\\@]\p{L}/u
// `\p{Lu}` (maiúscula) é a trava que separa crédito de autoria de frase
// comum: "Por Marla" é assinatura, "por tempo limitado" não é. Por isso a
// regex NÃO pode levar a flag `i` — ela faria o `\p{Lu}` casar minúscula
// também e derrubaria justamente essa trava. As variantes de caixa da
// palavra-chave são escritas à mão.
const CREDIT_BYLINE_RE = /(?:^|[\s\-–—|•·])(?:[Pp]or|POR|[Bb]y|BY|[Vv]ia|VIA)\s+\p{Lu}/u
const MAX_CREDIT_CHARS = 60
const MAX_CREDIT_WORDS = 6

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
// só emoji e pontuação (ex.: `⚠ *😱😱😱.* *@ocasaljovemoficial_*`),
// ou sobra exatamente o rótulo de marca observado `Promos das`.
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

  return !hasVisibleContent(residue) || SOCIAL_BRAND_LABEL_RE.test(signatureCore(residue))
}

// Apara a cauda social do FIM de uma linha, preservando tudo antes dela.
//
// Existe porque a origem às vezes gruda a assinatura na mesma linha do link
// (`➡️ Compre aqui: https://... ⚠ 😱. *@perfil*`). Nesse caso a invariante 2
// ("nunca remover linha com URL") impedia a limpeza — e impedir era certo:
// remover a linha levaria o link da cliente junto. Aqui cortamos só o rabo.
//
// Devolve a linha original quando não há cauda social, quando a cauda é a
// linha inteira (caso de `isSocialOnlyLine`, que remove a linha toda) ou
// quando o que sobraria perdeu o link de oferta que a linha tinha.
export function stripSocialTail(line) {
  const raw = String(line ?? '')
  const match = raw.match(TRAILING_SOCIAL_TAIL_RE)
  if (!match || match.index === undefined || match.index === 0) return raw

  const prefix = raw.slice(0, match.index).replace(/[\s]+$/, '')
  if (!hasVisibleContent(prefix)) return raw
  // Se a linha carregava link de oferta, o prefixo TEM que continuar
  // carregando — caso contrário estaríamos comendo o link da cliente.
  if (hasOfferUrl(raw) && !hasOfferUrl(prefix)) return raw

  return prefix
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

// Linha de crédito/autoria do grupo de origem (`/Vitrinedadecor - Por Marla
// Tavares`). Separada de `isBareSignatureLine` de propósito: aceita mais
// palavras (crédito costuma ter nome e sobrenome), mas em troca EXIGE um
// marcador de assinatura — prefixo de marca (`/`, `@`) ou crédito de autoria
// com nome próprio. Sem marcador, a linha não é tocada.
export function isCreditSignatureLine(line) {
  const raw = String(line ?? '')
  if (hasHttpUrl(raw)) return false

  const core = signatureCore(raw)
  if (!core || core.length > MAX_CREDIT_CHARS) return false
  if (/\d/.test(core)) return false
  if (OFFER_CONTENT_WORD_RE.test(core)) return false

  const words = core.split(/\s+/).filter(word => /\p{L}/u.test(word))
  if (words.length === 0 || words.length > MAX_CREDIT_WORDS) return false

  return CREDIT_PREFIX_RE.test(core) || CREDIT_BYLINE_RE.test(core)
}

// Assinatura "rótulo + perfil": `Curadoria@casabemmimada`, `Curadoria
// @casabemmimada`, `Créditos: @perfil`. Quarta forma encontrada em produção
// (2026-09). Escapava das regras acima quando NÃO vinha colada logo abaixo do
// link (topo da mensagem, ou depois de "Frete grátis"), porque a regra de
// "palavra solta" exige a linha do link imediatamente antes.
//
// O que a torna segura para remover em QUALQUER posição é o formato, não a
// posição: um rótulo curto GRUDADO no `@` (sem espaço) ou um rótulo de crédito
// conhecido seguido de perfil. "Siga @fulano para mais ofertas" continua
// intacto: tem espaço antes do `@`, "siga" não é rótulo de crédito e sobra
// texto depois do perfil.
const CREDIT_LABEL_SRC = '(?:curadoria|cr[ée]ditos?|fonte|sele[çc][ãa]o|achados|by|via|por)'
const GLUED_LABEL_HANDLE_RE = new RegExp(`^[\\p{L}][\\p{L}.'-]{0,29}${HANDLE_SRC}$`, 'u')
const CREDIT_LABEL_HANDLE_RE = new RegExp(`^${CREDIT_LABEL_SRC}\\s*[:：\\-–—]?\\s*${HANDLE_SRC}$`, 'iu')
// `nome@dominio.com` é e-mail, não perfil — nunca remover.
const EMAIL_LIKE_RE = /@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.[a-z]{2,}$/iu
const MAX_LABELED_HANDLE_LINES = 3

export function isLabeledHandleSignatureLine(line) {
  const raw = String(line ?? '')
  if (!raw.trim() || hasHttpUrl(raw)) return false
  const core = signatureCore(raw)
  if (!core || core.length > MAX_CREDIT_CHARS) return false
  if (EMAIL_LIKE_RE.test(core)) return false
  const label = core.split('@')[0]
  if (/\d/.test(label) || OFFER_CONTENT_WORD_RE.test(label)) return false
  return GLUED_LABEL_HANDLE_RE.test(core) || CREDIT_LABEL_HANDLE_RE.test(core)
}

function removeLabeledHandleLines(lines) {
  let removed = 0
  const kept = lines.filter(line => {
    if (removed >= MAX_LABELED_HANDLE_LINES || !isLabeledHandleSignatureLine(line)) return true
    removed++
    return false
  })
  return { lines: kept, changed: removed > 0 }
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

  const labeled = removeLabeledHandleLines(raw.split('\n'))
  const lines = labeled.lines
  let removed = 0
  let changed = labeled.changed
  let cursor = lines.length

  while (removed < MAX_SIGNATURE_LINES) {
    const index = lastNonEmptyIndex(lines, cursor)
    if (index < 0) break

    const line = lines[index]

    // Linha com URL: não pode ser removida (levaria o link junto), mas ainda
    // pode ter a assinatura grudada no fim. Apara só a cauda e encerra — o
    // link é o piso da varredura, nada acima dele é assinatura.
    if (hasHttpUrl(line)) {
      const trimmed = stripSocialTail(line)
      if (trimmed !== line) {
        lines[index] = trimmed
        changed = true
      }
      break
    }

    if (isSocialOnlyLine(line)) {
      lines.splice(index, 1)
      removed++
      changed = true
      cursor = index
      continue
    }

    // Linha puramente decorativa (só emoji/pontuação, ex.: "🔥🔥🔥"): não é
    // conteúdo e não é assinatura. Passa por cima dela SEM remover, para que
    // uma assinatura logo acima continue alcançável.
    if (!hasVisibleContent(line)) {
      cursor = index
      continue
    }

    const previousIndex = lastNonEmptyIndex(lines, index)
    const previousIsLinkLine = previousIndex >= 0 && hasOfferUrl(lines[previousIndex])
    if (previousIsLinkLine && (isBareSignatureLine(line) || isCreditSignatureLine(line))) {
      lines.splice(index, 1)
      removed++
      changed = true
      cursor = index
      continue
    }

    break
  }

  return changed ? lines.join('\n') : raw
}
