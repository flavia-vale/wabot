#!/usr/bin/env node
// A cliente mandou um código de desconto — ele é de verdade e ainda vale?
// Read-only, roda no diretório do ambiente.
//
//   cd ~/wabot && node scripts/conferir-voucher.mjs <email> [CODIGO]
//   cd ~/wabot && node scripts/conferir-voucher.mjs --codigo VOLTA20-4WTNH7
//
// O voucher da jornada de acesso vencido NÃO tem tabela: o código é derivado da
// conta + do dia em que o acesso venceu (src/domain/payments/recoveryVoucher.js).
// Isso é o que faz o segundo e-mail repetir o código do primeiro sem migration
// nenhuma — e é por isso que conferir é regerar. Este script existe porque o
// resgate é manual: alguém precisa responder "aplico ou não esse desconto?".
//
// Sem e-mail, `--codigo` varre as contas com acesso vencido nos últimos dias e
// diz de quem é aquele código (útil quando a mensagem chega só pelo WhatsApp,
// sem dizer quem é).
import 'dotenv/config'
import db from '../src/db.js'
import {
  RECOVERY_VOUCHER_VALID_DAYS,
  buildRecoveryVoucher,
  checkRecoveryVoucher,
} from '../src/domain/payments/recoveryVoucher.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const args = process.argv.slice(2)
const codigoFlagIndex = args.findIndex((a) => a === '--codigo')
const codigoBusca = codigoFlagIndex >= 0 ? args[codigoFlagIndex + 1] : null
const posicionais = args.filter((a, i) => !a.startsWith('--') && i !== codigoFlagIndex + 1)
const alvo = posicionais[0] ?? null
const codigoInformado = codigoBusca ?? posicionais[1] ?? null

const MOTIVOS = {
  ok: 'VALE — pode aplicar o desconto',
  codigo_diferente: 'NÃO é o código desta conta',
  prazo_vencido: 'o código é desta conta, mas o prazo já passou',
  sem_dado: 'não deu para conferir (conta sem data de vencimento do acesso)',
}

function descreveConta(user, now) {
  const voucher = buildRecoveryVoucher({ userId: user.id, expiredAt: user.accessExpiresAt, now })
  const diasVencido = user.accessExpiresAt
    ? Math.floor((now - new Date(user.accessExpiresAt).getTime()) / MS_PER_DAY)
    : null
  return { voucher, diasVencido }
}

async function main() {
  const now = Date.now()
  console.log(`\nAmbiente: ${process.env.APP_ENV || 'não declarado'} · banco: ${process.env.DATABASE_URL || 'não declarado'}`)
  console.log(`O código vale ${RECOVERY_VOUCHER_VALID_DAYS} dias contados do vencimento do acesso.\n`)

  if (!alvo && !codigoInformado) {
    console.log('Uso: node scripts/conferir-voucher.mjs <email> [CODIGO]')
    console.log('     node scripts/conferir-voucher.mjs --codigo VOLTA20-XXXXXX\n')
    return
  }

  if (alvo) {
    const user = await db.user.findFirst({
      where: { OR: [{ email: alvo }, { contactPhone: alvo }, { name: { contains: alvo } }] },
      select: { id: true, name: true, email: true, plan: true, accessExpiresAt: true },
    })
    if (!user) {
      console.log(`Nenhuma conta encontrada para "${alvo}".`)
      return
    }
    const { voucher, diasVencido } = descreveConta(user, now)
    console.log(`Conta:            ${user.name || '(sem nome)'} <${user.email}>`)
    console.log(`Plano:            ${user.plan}`)
    console.log(`Acesso venceu em: ${user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString() : '(sem data)'}`)
    console.log(`Vencido há:       ${diasVencido === null ? '(não dá para saber)' : `${diasVencido} dia(s)`}`)
    if (!voucher) {
      console.log('\nSem voucher: a conta não tem data de vencimento de acesso.')
      return
    }
    console.log(`\nCódigo desta conta: ${voucher.code} (${voucher.percent}% de desconto)`)
    console.log(`Vale até:           ${voucher.validUntil.toISOString().slice(0, 10)} (${voucher.diasRestantes} dia(s))`)
    if (codigoInformado) {
      const resultado = checkRecoveryVoucher({ code: codigoInformado, userId: user.id, expiredAt: user.accessExpiresAt, now })
      console.log(`\nCódigo informado:   ${codigoInformado}`)
      console.log(`Resultado:          ${MOTIVOS[resultado.motivo] ?? resultado.motivo}`)
    }
    return
  }

  // Só o código: procura de quem é entre quem venceu na janela em que o código
  // poderia ter sido gerado (a jornada manda o voucher do 5º ao 8º dia).
  const desde = new Date(now - (RECOVERY_VOUCHER_VALID_DAYS + 20) * MS_PER_DAY)
  const candidatos = await db.user.findMany({
    where: { accessExpiresAt: { lt: new Date(now), gte: desde } },
    select: { id: true, name: true, email: true, plan: true, accessExpiresAt: true },
  })
  console.log(`Procurando "${codigoInformado}" entre ${candidatos.length} conta(s) com acesso vencido na janela.\n`)
  let achou = false
  for (const user of candidatos) {
    const resultado = checkRecoveryVoucher({ code: codigoInformado, userId: user.id, expiredAt: user.accessExpiresAt, now })
    if (resultado.motivo === 'codigo_diferente' || resultado.motivo === 'sem_dado') continue
    achou = true
    console.log(`${user.name || '(sem nome)'} <${user.email}> · plano ${user.plan}`)
    console.log(`  ${MOTIVOS[resultado.motivo] ?? resultado.motivo} · vale até ${resultado.voucher.validUntil.toISOString().slice(0, 10)}`)
  }
  if (!achou) console.log('Nenhuma conta da janela gera esse código.')
}

main()
  .catch((err) => {
    console.error('Falhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect().catch(() => {}))
