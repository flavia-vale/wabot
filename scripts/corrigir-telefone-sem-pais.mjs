#!/usr/bin/env node
/**
 * Conserta os celulares gravados sem o código do país.
 *
 * DRY-RUN POR PADRÃO: sem `--aplicar` nada é gravado, só mostra o que faria.
 *
 * POR QUE EXISTE (medido em 2026-09-09): o cadastro gravava o número só sem a
 * pontuação, com `+` na frente e sem o 55. Numa amostra de 33 cadastros
 * recentes, 25 números ficaram impossíveis de discar no WhatsApp — e o celular
 * é obrigatório no cadastro justamente para conseguir procurar a cliente quando
 * ela trava. A regra do conserto é a MESMA do cadastro
 * (`src/domain/signup/contactPhone.js`), importada e não reescrita: script e
 * produto discordando sobre o formato é pior que não ter script.
 *
 * DUAS PRECAUÇÕES:
 *
 * 1. `User.contactPhone` é ÚNICO. Corrigir um número pode colidir com outra
 *    conta que já tem a forma certa — quase sempre a mesma pessoa com duas
 *    contas. Colisão nunca é resolvida no chute: a linha é PULADA e listada
 *    para decisão humana.
 * 2. Número estrangeiro ou fora do padrão brasileiro **não é tocado**. Inventar
 *    um país para o contato de uma cliente é pior que deixá-lo como ela digitou.
 *
 * Uso (no diretório do ambiente):
 *   cd ~/wabot && node scripts/corrigir-telefone-sem-pais.mjs
 *   cd ~/wabot && node scripts/corrigir-telefone-sem-pais.mjs --aplicar
 */

import 'dotenv/config'
import db from '../src/db.js'
import { fixStoredContactPhone } from '../src/domain/signup/contactPhone.js'

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const usuarios = await db.user.findMany({
    where: { contactPhone: { not: null } },
    select: { id: true, name: true, email: true, contactPhone: true },
    orderBy: { createdAt: 'asc' },
  })

  const paraCorrigir = []
  for (const user of usuarios) {
    const decisao = fixStoredContactPhone(user.contactPhone)
    if (decisao.changed) paraCorrigir.push({ user, novo: decisao.value })
  }

  console.log(`Contas com telefone: ${usuarios.length}`)
  console.log(`Precisam do código do país: ${paraCorrigir.length}`)
  if (!paraCorrigir.length) {
    console.log('Nada a fazer.')
    await db.$disconnect()
    return
  }

  // O índice único é por conta inteira, então a colisão precisa ser conferida
  // contra o valor JÁ corrigido das outras linhas, não só contra o banco atual.
  const ocupados = new Map(usuarios.map(u => [u.contactPhone, u.id]))
  for (const { user, novo } of paraCorrigir) ocupados.set(novo, ocupados.get(novo) ?? user.id)

  let corrigidos = 0
  const colisoes = []

  for (const { user, novo } of paraCorrigir) {
    const dono = usuarios.find(u => u.contactPhone === novo && u.id !== user.id)
    if (dono) {
      colisoes.push({ user, novo, dono })
      console.log(`  ⚠️  ${user.email}: ${user.contactPhone} → ${novo} JÁ é de ${dono.email} — pulado`)
      continue
    }
    console.log(`  ${aplicar ? '✓' : '·'} ${user.email}: ${user.contactPhone} → ${novo}`)
    if (!aplicar) continue
    try {
      await db.user.update({ where: { id: user.id }, data: { contactPhone: novo } })
      corrigidos += 1
    } catch (err) {
      console.error(`  ✗ ${user.email}: falhou — ${err?.message}`)
    }
  }

  console.log('')
  if (aplicar) {
    console.log(`Corrigidos: ${corrigidos}`)
  } else {
    console.log(`Seriam corrigidos: ${paraCorrigir.length - colisoes.length}. Rode de novo com --aplicar para gravar.`)
  }
  if (colisoes.length) {
    console.log(`Pulados por já existir outra conta com o número certo: ${colisoes.length} — quase sempre a mesma pessoa com duas contas, decida caso a caso.`)
  }

  await db.$disconnect()
}

main().catch(async err => {
  console.error(err?.stack || err?.message || err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
