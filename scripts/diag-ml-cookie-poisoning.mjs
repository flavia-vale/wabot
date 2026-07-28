#!/usr/bin/env node
/**
 * Diagnóstico decisivo: o código de acesso guardado ainda é o que a usuária
 * colou, ou foi SOBRESCRITO por um cookie de sessão deslogada?
 *
 * Por que isso importa (mecanismo, verificado no código):
 *   1. `buildCookieHeader` (src/converters/mercadolivre.js) dá PRECEDÊNCIA ao
 *      campo `cookie` (o jar completo) sobre o campo `ssid`. Se o jar contiver
 *      um ssid diferente, é ele que vai em todo request — o `ssid` colado pela
 *      usuária deixa de ser usado.
 *   2. Toda resposta do ML passa por `buildCredentialPatchFromSetCookie`, que
 *      mescla os `Set-Cookie` no jar e PERSISTE (`__onCredentialPatch`).
 *      Deleções são ignoradas por guarda existente, mas um valor NOVO e não
 *      vazio entra normalmente.
 *   3. A resposta 401 do createLink é o redirect para a tela de LOGIN e vem
 *      com `set-cookie: 2` (visto no bot.log de produção).
 *
 * Se (3) trouxer um `ssid` anônimo não vazio, ele passa por (2) e por (1) vira
 * o cookie efetivo — a credencial fica permanentemente deslogada e TODA oferta
 * passa a sair com link longo, mesmo com o SSID "cadastrado" no painel.
 *
 * Este script NÃO escreve nada: só compara o que está guardado e mostra o que
 * uma sondagem devolveria. Nenhum valor de credencial é impresso.
 *
 * Uso:  cd ~/wabot && node scripts/diag-ml-cookie-poisoning.mjs --email=...
 */

import 'dotenv/config'
import db from '../src/db.js'
import { parseCredentialData } from '../src/credentialHealth.js'
import { checkMercadoLivreSession } from '../src/converters/mercadolivre.js'

function arg(name) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

function fingerprint(value) {
  const s = String(value ?? '')
  if (!s) return '(vazio)'
  return `${s.length} chars, "${s.slice(0, 6)}…${s.slice(-4)}"`
}

function jarGet(cookieHeader, name) {
  for (const part of String(cookieHeader || '').split(';')) {
    const t = part.trim()
    const eq = t.indexOf('=')
    if (eq > 0 && t.slice(0, eq) === name) return t.slice(eq + 1)
  }
  return null
}

async function main() {
  const email = arg('email')
  if (!email) {
    console.error('Uso: node scripts/diag-ml-cookie-poisoning.mjs --email=alguem@dominio.com')
    process.exit(1)
  }

  const user = await db.user.findUnique({ where: { email }, include: { credentials: true } })
  if (!user) { console.error(`Usuário não encontrado: ${email}`); process.exit(2) }

  const row = user.credentials.find(c => c.platform === 'mercadolivre')
  if (!row) { console.error('Sem credencial do Mercado Livre'); process.exit(3) }
  const creds = parseCredentialData(row.data)

  console.log(`USUÁRIO: ${user.email} (id=${user.id})`)
  console.log('\n--- O QUE ESTÁ GUARDADO ---')
  console.log(`campo ssid       : ${fingerprint(creds.ssid)}`)
  console.log(`campo cookie(jar): ${fingerprint(creds.cookie)}`)

  const jarSsid = jarGet(creds.cookie, 'ssid')
  console.log(`ssid DENTRO do jar: ${fingerprint(jarSsid)}`)

  const efetivo = creds.cookie ? 'o JAR (campo cookie)' : 'o campo ssid'
  console.log(`\ncookie que vai de fato no request: ${efetivo}`)

  if (creds.cookie && jarSsid !== null && creds.ssid) {
    if (jarSsid === creds.ssid) {
      console.log('=> jar e campo ssid são IGUAIS: o código que ela colou é o que está sendo usado.')
    } else {
      console.log('=> ATENÇÃO: o jar tem um ssid DIFERENTE do campo ssid.')
      console.log('   O código que a usuária colou NÃO é o que está sendo enviado ao ML.')
      console.log('   Isso é sobrescrita por rotação de cookie (possivelmente da tela de login do 401).')
    }
  } else if (creds.cookie && jarSsid === null) {
    console.log('=> o jar NÃO tem ssid dentro: o request vai sem código de sessão (sempre link longo).')
  }

  console.log('\n--- SONDAGEM (1 request, nada é gravado) ---')
  const probe = await checkMercadoLivreSession(creds)
  const { credentialPatch, ...publico } = probe
  console.log(JSON.stringify(publico))

  if (!credentialPatch) {
    console.log('resposta do ML não traria mudança de cookie (patch vazio).')
  } else {
    const mudariaSsid = credentialPatch.ssid && credentialPatch.ssid !== creds.ssid
    console.log(`resposta do ML TRARIA um patch de cookie. Mudaria o ssid guardado? ${mudariaSsid ? 'SIM' : 'não'}`)
    if (mudariaSsid) {
      console.log(`   ssid atual : ${fingerprint(creds.ssid)}`)
      console.log(`   ssid do ML : ${fingerprint(credentialPatch.ssid)}`)
      console.log(`   status da resposta: ${publico.reason} (se for "expired", é a tela de login sobrescrevendo a credencial)`)
    }
  }
  console.log('\n(NADA foi gravado por este script.)')
  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('FALHA:', err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
