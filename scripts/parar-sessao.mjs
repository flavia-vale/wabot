// Para a sessão WhatsApp de uma ou mais clientes, pelo e-mail.
//
// Para que serve: sessão presa em loop de reconexão sem nunca conectar (o caso
// do RCA 2026-08-28) fica queimando tentativa e expondo o chip. Enquanto a
// cliente não faz um pareamento novo, o certo é parar.
//
// O que faz: marca a sessão como parada DE PROPÓSITO (`stopped_by_user`) e
// manda o MESMO comando de parada que o painel manda. Sessão marcada assim não
// é ressuscitada pelo supervisor e não gera aviso de "robô caído" — é escolha,
// não falha.
//
// Uso (no diretório do ambiente):
//   node scripts/parar-sessao.mjs cliente@exemplo.com [outra@exemplo.com ...]
//
// Para religar: a própria cliente clica em Conectar no painel (ou o botão
// "Tentar reconectar" do admin, quando a credencial ainda vale).
import 'dotenv/config'
import db from '../src/db.js'
import { stopBot, isRunning } from '../src/manager.js'
import { recordWaConnectionEventSafe } from '../src/waConnectionTelemetry.js'
import { MANUAL_STOP_EVENT } from '../src/email/accountActivity.js'
import { stopSessionOnPurpose } from '../src/domain/session/stopSession.js'

const emails = process.argv.slice(2).filter(Boolean)
if (!emails.length) {
  console.log('uso: node scripts/parar-sessao.mjs <email> [email ...]')
  process.exit(1)
}

for (const email of emails) {
  const user = await db.user.findFirst({ where: { email }, select: { id: true } })
  if (!user) {
    console.log(`${email} → conta não encontrada`)
    continue
  }
  // Mesmo passo a passo da ficha do admin: src/domain/session/stopSession.js.
  const { rodando, parado } = await stopSessionOnPurpose({
    db, userId: user.id, stopBot, isRunning, record: recordWaConnectionEventSafe,
    eventType: MANUAL_STOP_EVENT, source: 'script_parar_sessao',
  })
  console.log(`${email} → estava rodando: ${rodando} | marcada como parada | stopBot: ${parado}`)
}

// Dá tempo do comando chegar ao supervisor antes de encerrar o processo.
await new Promise(resolve => setTimeout(resolve, 1500))
process.exit(0)
