#!/usr/bin/env node
/**
 * Limpeza do resíduo do "modo sem cookie" (removido a pedido da cliente).
 *
 * Enquanto a opção existiu, quem a ligou ficou com `cookielessMode: true`
 * dentro de `Credential.data` — e, por desenho, os campos de sessão
 * (ssid/cookie/csrf/id no ML; cookie e os 3 nomeados na Amazon) foram APAGADOS
 * naquele momento. Com a opção removida:
 *
 *   - a validação voltou a exigir o código de acesso, então essas contas já
 *     aparecem como "Falta preencher" no painel (comportamento correto);
 *   - o código apagado **não tem como ser recuperado** — a cliente precisa
 *     colar um novo;
 *   - sobra a flag no JSON, inofensiva hoje mas suja: este script a remove.
 *
 * Roda em DRY-RUN por padrão (não grava nada). Só escreve com `--apply`.
 * Não imprime valor de credencial — só quem é afetado e o que falta.
 *
 * Uso:
 *   cd ~/wabot-staging && node scripts/cleanup-cookieless-flag.mjs
 *   cd ~/wabot-staging && node scripts/cleanup-cookieless-flag.mjs --apply
 *   cd ~/wabot         && node scripts/cleanup-cookieless-flag.mjs
 *   cd ~/wabot         && node scripts/cleanup-cookieless-flag.mjs --apply
 *
 * Em produção, rodar `scripts/backup_prod.sh` antes do `--apply`.
 */

import 'dotenv/config'
import db from '../src/db.js'
import { parseCredentialData, validateCredentialData } from '../src/credentialHealth.js'
import { encryptCredential } from '../src/credentialCrypto.js'

const APLICAR = process.argv.includes('--apply')

async function main() {
  console.log(`Banco: ${process.env.DATABASE_URL || '(vazio)'}`)
  console.log(APLICAR ? 'MODO: aplicando alterações' : 'MODO: simulação (nada será gravado — use --apply para valer)')

  const credenciais = await db.credential.findMany({ include: { user: { select: { email: true } } } })

  const afetadas = []
  for (const linha of credenciais) {
    const dados = parseCredentialData(linha.data)
    if (dados?.cookielessMode === undefined) continue
    afetadas.push({ linha, dados })
  }

  if (!afetadas.length) {
    console.log('\nNenhuma credencial com a flag do modo sem cookie. Nada a fazer.')
    await db.$disconnect()
    return
  }

  console.log(`\n${afetadas.length} credencial(is) com resíduo do modo sem cookie:\n`)
  let limpas = 0
  const precisamRecadastrar = []

  for (const { linha, dados } of afetadas) {
    const estavaLigado = dados.cookielessMode === true || dados.cookielessMode === 'true'
    const { cookielessMode: _flag, ...semFlag } = dados
    const validacao = validateCredentialData(linha.platform, semFlag)
    const falta = validacao.missing.join(', ') || 'nada'

    console.log(`- ${linha.user?.email ?? '(sem e-mail)'} | ${linha.platform} | opção estava ${estavaLigado ? 'LIGADA' : 'desligada'} | falta agora: ${falta}`)
    if (!validacao.configured) precisamRecadastrar.push(`${linha.user?.email ?? linha.userId} (${linha.platform})`)

    if (APLICAR) {
      await db.credential.update({
        where: { id: linha.id },
        data: { data: encryptCredential(JSON.stringify(semFlag)) },
      })
      limpas++
    }
  }

  console.log(`\nFlag removida de ${APLICAR ? limpas : 0} credencial(is)${APLICAR ? '' : ' (simulação)'}.`)

  if (precisamRecadastrar.length) {
    console.log('\nATENÇÃO — estas contas ficaram SEM o código de acesso guardado e precisam colar um novo no painel:')
    for (const quem of new Set(precisamRecadastrar)) console.log(`  * ${quem}`)
    console.log('\nAté recadastrarem, as ofertas continuam saindo (com o link mais comprido e a comissão delas).')
  }

  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('FALHA:', err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
