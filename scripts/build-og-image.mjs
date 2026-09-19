#!/usr/bin/env node
/**
 * Gera a imagem OG padrão do site (dashboard/public/og-default.png, 1200x630).
 *
 * Por que existe (RCA 2026-09-18): `buildOgImageUrl` apontava para
 * `/api/public/og?...`, uma rota que NUNCA existiu (nem no Next, nem no
 * Fastify) — toda página comercial, inclusive as 5 de loja do Tier 1, saía com
 * `og:image` devolvendo 404, e a home não declarava imagem nenhuma. Sem imagem,
 * o card de prévia no WhatsApp, no ChatGPT, na Perplexity e nas redes sai
 * pelado, e a pessoa não reconhece a marca ao clicar na citação.
 *
 * A imagem é ESTÁTICA de propósito (arquivo commitado): renderizar por rota
 * exigiria `next/og` em runtime e mais um caminho para quebrar em deploy. Rodar
 * este script só quando a arte mudar; o PNG gerado entra no repositório.
 *
 * Uso: node scripts/build-og-image.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '..', 'dashboard', 'public', 'og-default.png')

const W = 1200
const H = 630

// Cores do site (dashboard/app/globals.css / landing.css): fundo #EEF6F2,
// verde de destaque, tinta escura.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#EEF6F2"/>
      <stop offset="1" stop-color="#D9EEE3"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1040" cy="120" r="220" fill="#0F9D6A" fill-opacity="0.10"/>
  <circle cx="1120" cy="560" r="160" fill="#0F9D6A" fill-opacity="0.12"/>
  <rect x="72" y="72" width="14" height="486" rx="7" fill="#0F9D6A"/>
  <text x="120" y="170" font-family="DejaVu Sans, Inter, Arial, sans-serif" font-size="30" font-weight="700" fill="#0F9D6A" letter-spacing="6">ESPELHAGRUPOS.COM.BR</text>
  <text x="120" y="290" font-family="DejaVu Sans, Inter, Arial, sans-serif" font-size="96" font-weight="700" fill="#0B1F17">Espelha Grupos</text>
  <text x="120" y="370" font-family="DejaVu Sans, Inter, Arial, sans-serif" font-size="40" fill="#1F3A2E">Bot para afiliadas espelhar ofertas no WhatsApp</text>
  <text x="120" y="440" font-family="DejaVu Sans, Inter, Arial, sans-serif" font-size="30" fill="#3E5C4E">Converte o link para o seu código de afiliada e publica sozinho.</text>
  <rect x="120" y="490" width="960" height="70" rx="35" fill="#FFFFFF" fill-opacity="0.85" stroke="#B9DCC9"/>
  <text x="600" y="536" text-anchor="middle" font-family="DejaVu Sans, Inter, Arial, sans-serif" font-size="28" font-weight="700" fill="#0B1F17">Shopee · Mercado Livre · Amazon · Magalu · SHEIN · AliExpress</text>
</svg>`

const png = await sharp(Buffer.from(svg), { density: 144 })
  .resize(W, H)
  .png({ compressionLevel: 9, palette: true })
  .toBuffer()

fs.writeFileSync(out, png)
console.log(`gravado ${path.relative(process.cwd(), out)} (${png.length} bytes)`)
