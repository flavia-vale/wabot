#!/usr/bin/env node
// Manda o relatório do vigia por e-mail para a administradora (template
// `admin_servidor_vigia`, caminho de aviso interno com cooldown e registro em
// EmailSendLog). Chamado pelo vigia_cron.sh SÓ na troca de estado:
//
//   echo "$RELATORIO" | VIGIA_ESTADO=vermelho node scripts/vigia-notificar.mjs
//   echo "$RELATORIO" | VIGIA_ESTADO=resolvido node scripts/vigia-notificar.mjs
//
// Sem SMTP configurado não envia (e diz isso); nunca derruba o cron.

import 'dotenv/config'
import { sendAdminAlert } from '../src/email/adminAlerts.js'

const chunks = []
for await (const c of process.stdin) chunks.push(c)
const report = Buffer.concat(chunks).toString('utf8').trim()
const estado = process.env.VIGIA_ESTADO === 'resolvido' ? 'resolvido' : 'vermelho'
const reds = report.split('\n').filter(l => l.startsWith('🔴') && !l.includes('ATENÇÃO'))
const primeira = (reds[0] ?? '').replace(/^🔴\s*/, '').slice(0, 120)
const resumo = estado === 'resolvido' ? '🟢 O servidor voltou ao normal' : `🔴 Problema no servidor: ${primeira || 'ver relatório'}`

let db = null
try { db = (await import('../src/db.js')).default } catch { db = null }
const result = await sendAdminAlert({
  db,
  slug: 'admin_servidor_vigia',
  // Cada combinação de problemas é um assunto; repetir o mesmo espera 1 h.
  key: `${estado}:${reds.map(l => l.split(':')[0]).sort().join('|') || 'geral'}`,
  cooldownHours: 1,
  vars: { resumo, detalhe: report || '(relatório vazio)', quando: new Date().toISOString() },
})
console.log(`[vigia-notificar] ${estado}: ${result?.sent ? `enviado para ${result.to}` : `não enviado (${result?.reason ?? 'erro'})`}`)
try { await db?.$disconnect?.() } catch {}
process.exit(0)
