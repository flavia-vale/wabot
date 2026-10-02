#!/usr/bin/env node
// Aviso interno avulso por e-mail (template `admin_servidor_vigia`).
//
//   echo "detalhes" | node scripts/avisar-admin.mjs "frase curta do que aconteceu"
//
// Usado pelo deploy (P2-3 do plano anti-queda) para avisar quando ELE reinicia
// os robôs. Nunca falha o chamador: sai 0 mesmo sem SMTP.
import 'dotenv/config'
import { sendAdminAlert } from '../src/email/adminAlerts.js'

const resumo = String(process.argv[2] || 'Aviso do servidor').slice(0, 160)
let detalhe = ''
if (!process.stdin.isTTY) {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  detalhe = Buffer.concat(chunks).toString('utf8').trim()
}
let db = null
try { db = (await import('../src/db.js')).default } catch { db = null }
const r = await sendAdminAlert({
  db,
  slug: 'admin_servidor_vigia',
  key: `avulso:${resumo}`,
  cooldownHours: 0,
  vars: { resumo, detalhe: detalhe || '(sem detalhes)', quando: new Date().toISOString() },
}).catch(err => ({ sent: false, reason: err?.message }))
console.log(`[avisar-admin] ${r?.sent ? `enviado para ${r.to}` : `não enviado (${r?.reason ?? 'erro'})`}`)
try { await db?.$disconnect?.() } catch {}
process.exit(0)
