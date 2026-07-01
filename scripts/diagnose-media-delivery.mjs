#!/usr/bin/env node
import dns from 'node:dns/promises'
import { performance } from 'node:perf_hooks'
import { detectLinks } from '../src/detector.js'
import { fetchProductImage } from '../src/converters/imageScrapers.js'

const DEFAULT_TIMEOUT_MS = Number(process.env.MEDIA_DIAG_TIMEOUT_MS || 15000)
const DEFAULT_RANGE_BYTES = Number(process.env.MEDIA_DIAG_RANGE_BYTES || 65535)
const META_UAS = [
  'WhatsApp/2.24.0 A',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; WhatsApp/2.0; +https://www.whatsapp.com/)',
]
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36'
const IMAGE_MAGIC = [
  { mime: 'image/jpeg', test: b => b?.[0] === 0xff && b?.[1] === 0xd8 && b?.[2] === 0xff },
  { mime: 'image/png', test: b => b?.[0] === 0x89 && b?.[1] === 0x50 && b?.[2] === 0x4e && b?.[3] === 0x47 },
  { mime: 'image/gif', test: b => b?.[0] === 0x47 && b?.[1] === 0x49 && b?.[2] === 0x46 && b?.[3] === 0x38 },
  { mime: 'image/webp', test: b => b?.[0] === 0x52 && b?.[1] === 0x49 && b?.[2] === 0x46 && b?.[3] === 0x46 && b?.[8] === 0x57 && b?.[9] === 0x45 && b?.[10] === 0x42 && b?.[11] === 0x50 },
]

function usage() {
  console.error(`Uso: node scripts/diagnose-media-delivery.mjs <image-ou-produto-url> [referer-url]\n\nAceita URL direta de imagem OU link de produto/short link de marketplace. Quando receber produto, tenta resolver a imageUrl pelo mesmo scraper do app antes dos probes. Investiga DNS, TTFB, headers, Range, MIME e possível bloqueio de User-Agent Meta/WhatsApp.`)
}

function ms(n) { return `${Math.round(n)}ms` }
function getHeader(headers, name) { return headers.get(name) || '' }
function detectMagic(buffer) { return IMAGE_MAGIC.find(x => x.test(buffer))?.mime || 'unknown' }
function verdict(ok, message) { return { ok, message } }

function isLikelyDirectImageUrl(url) {
  try {
    const u = new URL(url)
    return /\.(?:jpe?g|png|gif|webp|avif)(?:$|[?#])/i.test(u.pathname)
      || /(?:^|\.)(?:img\.susercontent\.com|media-amazon\.com|mlstatic\.com|ssl-images-amazon\.com)$/.test(u.hostname)
  } catch {
    return false
  }
}

async function resolveDiagnosticTarget(rawUrl, explicitReferer) {
  const links = detectLinks(rawUrl)
  const platform = links[0]?.platform || null
  if (!platform || isLikelyDirectImageUrl(rawUrl)) {
    return {
      sourceUrl: rawUrl,
      imageUrl: rawUrl,
      refererUrl: explicitReferer || null,
      platform,
      resolution: platform ? 'direct-image-url' : 'non-marketplace-url',
      resolutionError: null,
    }
  }

  try {
    const imageUrl = await fetchProductImage(platform, rawUrl, {})
    return {
      sourceUrl: rawUrl,
      imageUrl: imageUrl || rawUrl,
      refererUrl: explicitReferer || rawUrl,
      platform,
      resolution: imageUrl ? 'marketplace-product-image' : 'marketplace-image-not-resolved; probing original URL',
      resolutionError: null,
    }
  } catch (err) {
    return {
      sourceUrl: rawUrl,
      imageUrl: rawUrl,
      refererUrl: explicitReferer || rawUrl,
      platform,
      resolution: 'marketplace-image-resolution-failed; probing original URL',
      resolutionError: err?.message || String(err),
    }
  }
}

async function timedFetch(url, options = {}) {
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${DEFAULT_TIMEOUT_MS}ms`)), DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(url, { redirect: 'follow', ...options, signal: controller.signal })
    const headersAt = performance.now()
    let bodyBytes = 0
    let firstChunkAt = null
    let sample = Buffer.alloc(0)
    if (options.method !== 'HEAD' && res.body) {
      const reader = res.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!firstChunkAt) firstChunkAt = performance.now()
        bodyBytes += value.byteLength
        if (sample.length < 32) sample = Buffer.concat([sample, Buffer.from(value)]).subarray(0, 32)
      }
    }
    return { ok: true, res, timings: { headersMs: headersAt - startedAt, firstChunkMs: firstChunkAt ? firstChunkAt - startedAt : null, totalMs: performance.now() - startedAt }, bodyBytes, sample }
  } catch (err) {
    return { ok: false, error: err?.message || String(err), timings: { totalMs: performance.now() - startedAt } }
  } finally {
    clearTimeout(timeout)
  }
}

async function probeDns(hostname) {
  const startedAt = performance.now()
  const [a, aaaa] = await Promise.allSettled([dns.resolve4(hostname), dns.resolve6(hostname)])
  return {
    ms: performance.now() - startedAt,
    a: a.status === 'fulfilled' ? a.value : [],
    aaaa: aaaa.status === 'fulfilled' ? aaaa.value : [],
    errors: [a, aaaa].filter(x => x.status === 'rejected').map(x => x.reason?.code || x.reason?.message),
  }
}

function analyze({ head, range, full, uaResults }) {
  const findings = []
  const headers = head.ok ? head.res.headers : full.ok ? full.res.headers : null
  if (!headers) return [verdict(false, 'Não foi possível obter headers HTTP da imagem.')]

  const status = head.ok ? head.res.status : full.res.status
  if (status === 403 || status === 429) findings.push(verdict(false, `Origem respondeu ${status}; forte suspeita de WAF/CDN/rate-limit.`))
  else if (status >= 400) findings.push(verdict(false, `Origem respondeu HTTP ${status}.`))
  else findings.push(verdict(true, `Origem respondeu HTTP ${status}.`))

  const contentType = getHeader(headers, 'content-type').toLowerCase()
  if (!contentType.startsWith('image/')) findings.push(verdict(false, `Content-Type suspeito: ${contentType || '(ausente)'}.`))
  else findings.push(verdict(true, `Content-Type de imagem: ${contentType}.`))

  const acceptRanges = getHeader(headers, 'accept-ranges').toLowerCase()
  if (acceptRanges !== 'bytes' && range.ok && range.res.status !== 206) findings.push(verdict(false, `Accept-Ranges não confirmado (header=${acceptRanges || 'ausente'}, rangeStatus=${range.ok ? range.res.status : 'erro'}).`))
  else findings.push(verdict(true, `Suporte a Range confirmado (${range.ok ? range.res.status : 'sem teste'}, Accept-Ranges=${acceptRanges || 'ausente'}).`))

  const cacheControl = getHeader(headers, 'cache-control').toLowerCase()
  if (/no-store|no-cache|max-age=0/.test(cacheControl)) findings.push(verdict(false, `Cache-Control pode forçar revalidação frequente: ${cacheControl}.`))
  else findings.push(verdict(true, `Cache-Control aceitável: ${cacheControl || '(ausente)'}.`))

  const ttfb = full.timings?.firstChunkMs ?? full.timings?.headersMs
  if (ttfb && ttfb > 3000) findings.push(verdict(false, `TTFB alto para mídia (${ms(ttfb)}).`))
  else if (ttfb) findings.push(verdict(true, `TTFB aceitável (${ms(ttfb)}).`))

  if (full.ok && full.sample?.length) {
    const magic = detectMagic(full.sample)
    if (magic === 'unknown') findings.push(verdict(false, 'Magic bytes não parecem imagem conhecida; possível HTML/erro salvo como mídia.'))
    else findings.push(verdict(true, `Magic bytes compatíveis com ${magic}.`))
  }

  const blockedUa = uaResults.filter(r => !r.result.ok || [403, 429].includes(r.result.res?.status))
  if (blockedUa.length) findings.push(verdict(false, `User-Agent Meta/WhatsApp teve bloqueio/erro em ${blockedUa.length}/${uaResults.length} tentativas.`))
  else findings.push(verdict(true, 'User-Agents Meta/WhatsApp não foram bloqueados nos probes básicos.'))
  return findings
}

async function main() {
  const [rawUrl, referer] = process.argv.slice(2)
  if (!rawUrl) { usage(); process.exit(2) }
  if (!/^https?:\/\//i.test(rawUrl)) {
    usage()
    throw new Error(`URL inválida: "${rawUrl}". Troque os placeholders por um link real, por exemplo: https://s.shopee.com.br/8fQOrj52cW`)
  }
  if (referer && !/^https?:\/\//i.test(referer)) {
    usage()
    throw new Error(`Referer inválido: "${referer}". Omita o segundo argumento ou use uma URL real começando com http(s).`)
  }
  const target = await resolveDiagnosticTarget(rawUrl, referer)
  const url = new URL(target.imageUrl)
  if (!/^https?:$/.test(url.protocol)) throw new Error('URL precisa ser http(s)')

  const dnsResult = await probeDns(url.hostname)
  const baseHeaders = { 'User-Agent': BROWSER_UA, 'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' }
  if (target.refererUrl) baseHeaders.Referer = new URL(target.refererUrl).origin + '/'
  const head = await timedFetch(url, { method: 'HEAD', headers: baseHeaders })
  const range = await timedFetch(url, { method: 'GET', headers: { ...baseHeaders, Range: `bytes=0-${DEFAULT_RANGE_BYTES}` } })
  const full = await timedFetch(url, { method: 'GET', headers: baseHeaders })
  const uaResults = []
  for (const ua of META_UAS) uaResults.push({ ua, result: await timedFetch(url, { method: 'HEAD', headers: { ...baseHeaders, 'User-Agent': ua } }) })

  const report = {
    sourceUrl: target.sourceUrl,
    imageUrl: url.toString(),
    refererUrl: target.refererUrl,
    platform: target.platform,
    imageResolution: target.resolution,
    imageResolutionError: target.resolutionError,
    checkedAt: new Date().toISOString(),
    dns: { ...dnsResult, ms: Math.round(dnsResult.ms) },
    head: head.ok ? { status: head.res.status, finalUrl: head.res.url, headersMs: Math.round(head.timings.headersMs), headers: Object.fromEntries(head.res.headers.entries()) } : { error: head.error },
    range: range.ok ? { status: range.res.status, finalUrl: range.res.url, firstChunkMs: range.timings.firstChunkMs && Math.round(range.timings.firstChunkMs), totalMs: Math.round(range.timings.totalMs), bytes: range.bodyBytes, headers: Object.fromEntries(range.res.headers.entries()) } : { error: range.error },
    full: full.ok ? { status: full.res.status, finalUrl: full.res.url, firstChunkMs: full.timings.firstChunkMs && Math.round(full.timings.firstChunkMs), totalMs: Math.round(full.timings.totalMs), bytes: full.bodyBytes, magicMime: detectMagic(full.sample) } : { error: full.error },
    metaUserAgents: uaResults.map(({ ua, result }) => result.ok ? { ua, status: result.res.status, headersMs: Math.round(result.timings.headersMs) } : { ua, error: result.error }),
    findings: analyze({ head, range, full, uaResults }),
  }

  console.log(JSON.stringify(report, null, 2))
  if (report.findings.some(f => !f.ok)) process.exitCode = 1
}

main().catch(err => {
  console.error(err?.stack || err?.message || String(err))
  process.exit(1)
})
