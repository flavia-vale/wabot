#!/usr/bin/env node
/**
 * Diagnóstico: QUANTAS VAGAS DE ROBÔ estão ocupadas por conta com o acesso
 * VENCIDO — e quanta memória isso custa.
 *
 * Read-only: não grava nada, não liga nem desliga robô nenhum, não manda
 * e-mail. Só lê o banco e o /proc do próprio servidor.
 *
 * POR QUE EXISTE (2026-09-09, revisão do teste de 7 dias grátis):
 * o ciclo de vida da sessão NUNCA olha `User.accessExpiresAt`. O supervisor
 * ressuscita sessão persistida por `shouldResurrectSession` (status/lifecycle)
 * e o teto `MAX_SESSIONS_PER_PROCESS` conta robô LIGADO, não robô de cliente
 * pagante. Consequência: trial vencido e plano vencido seguem ocupando vaga e
 * RAM (~272 MB por robô, medição de 2026-09-01) num teto de 20 — vaga que uma
 * cliente pagante não consegue usar. Este script mede o tamanho disso em vez
 * de deduzir do volume de cadastros.
 *
 * TRÊS BLOCOS, porque nenhuma fonte sozinha responde:
 *  [1] Robôs REALMENTE ligados agora — processos `bot-worker` no /proc, com o
 *      userId lido de `BOT_USER_ID` e a memória real de `VmRSS`. É a única
 *      fonte que mede vaga e RAM de verdade.
 *  [2] O mesmo cruzamento pelo BANCO (`WaSession` que o supervisor
 *      ressuscitaria), usando as funções REAIS de `sessionResurrectionPolicy`
 *      em vez de reescrever a regra. Responde "e no próximo restart?", que é
 *      quando a vaga é disputada de novo.
 *  [3] O teto: quanto de `MAX_SESSIONS_PER_PROCESS` está em pé por classe de
 *      acesso.
 *
 * Uso (dentro do diretório do ambiente, no VPS):
 *   cd ~/wabot && node scripts/diag-vagas-por-acesso.mjs
 *   cd ~/wabot && node scripts/diag-vagas-por-acesso.mjs --csv > vagas.csv
 */

import 'dotenv/config'
import { readFileSync, readdirSync } from 'fs'
import db from '../src/db.js'
import { shouldResurrectSession, buildResurrectionWhere, resolveIncludeReconnecting } from '../src/core/sessionResurrectionPolicy.js'
import { isAccessActive, normalizePlan, PLAN_IDS } from '../src/billing/plans.js'

const asCsv = process.argv.includes('--csv')
const agora = new Date()

/** Teto de robôs por processo — mesma env que o supervisor lê no boot. */
const MAX_SESSOES = Number(process.env.MAX_SESSIONS_PER_PROCESS || 20)

/**
 * Só conta o worker DESTE ambiente. Rodar em ~/wabot não pode contar os robôs
 * de staging (e vice-versa): são processos irmãos no mesmo VPS, e misturá-los
 * inventaria ocupação que o teto deste processo não tem.
 */
const RAIZ_AMBIENTE = process.cwd()

function lerArquivo(caminho) {
  try { return readFileSync(caminho, 'utf8') } catch { return null }
}

/** Lê `BOT_USER_ID` do ambiente do processo. `null` se o /proc negar leitura. */
function userIdDoProcesso(pid) {
  const bruto = lerArquivo(`/proc/${pid}/environ`)
  if (!bruto) return null
  for (const par of bruto.split('\0')) {
    if (par.startsWith('BOT_USER_ID=')) return par.slice('BOT_USER_ID='.length) || null
  }
  return null
}

function rssMbDoProcesso(pid) {
  const status = lerArquivo(`/proc/${pid}/status`)
  if (!status) return null
  const hit = status.match(/^VmRSS:\s+(\d+)\s+kB$/m)
  return hit ? Math.round(Number(hit[1]) / 1024) : null
}

/**
 * O processo é um bot-worker DESTE ambiente?
 *
 * Exigente de propósito: casar só a string `bot-worker` no cmdline conta
 * também o `grep` de quem está diagnosticando e o `sh -c` que disparou o
 * comando — falso positivo em contagem de vaga é o mesmo que inventar
 * ocupação. A prova é o caminho absoluto do worker forkado
 * (`<ambiente>/src/bot-worker.js`) como argumento do node, que é o que separa
 * prod de staging sem depender de nome de processo do PM2.
 */
function ehWorkerDesteAmbiente(cmdline) {
  const args = cmdline.split('\0').filter(Boolean)
  if (!args.length) return false
  if (!/(^|\/)node(js)?$/.test(args[0].split('/').pop() ?? '')) return false
  return args.slice(1).some(a => a.startsWith(RAIZ_AMBIENTE) && a.endsWith('src/bot-worker.js'))
}

/** [1] Robôs ligados AGORA, deste ambiente. */
function robosLigados() {
  let pids = []
  try {
    pids = readdirSync('/proc').filter(nome => /^\d+$/.test(nome))
  } catch {
    return { disponivel: false, itens: [] }
  }
  const itens = []
  for (const pid of pids) {
    const cmd = lerArquivo(`/proc/${pid}/cmdline`)
    if (!cmd || !ehWorkerDesteAmbiente(cmd)) continue
    itens.push({ pid, userId: userIdDoProcesso(pid), rssMb: rssMbDoProcesso(pid) })
  }
  return { disponivel: true, itens }
}

/** Classificação de acesso, na linguagem da decisão: quem paga a vaga? */
function classificarAcesso(user) {
  if (!user) return { classe: 'sem_conta', rotulo: 'conta não encontrada' }
  const plano = normalizePlan(user.plan)
  const ativo = isAccessActive(user.accessExpiresAt, agora)
  if (!user.accessExpiresAt) return { classe: 'sem_data', rotulo: 'sem data de acesso' }
  if (ativo) {
    return plano === PLAN_IDS.TRIAL
      ? { classe: 'trial_ativo', rotulo: 'teste grátis em dia' }
      : { classe: 'pagante_em_dia', rotulo: `plano ${plano} em dia` }
  }
  return plano === PLAN_IDS.TRIAL
    ? { classe: 'trial_vencido', rotulo: 'teste grátis VENCIDO' }
    : { classe: 'plano_vencido', rotulo: `plano ${plano} VENCIDO` }
}

const ORDEM_CLASSES = [
  'pagante_em_dia',
  'trial_ativo',
  'trial_vencido',
  'plano_vencido',
  'sem_data',
  'sem_conta',
]

function diasVencido(accessExpiresAt) {
  if (!accessExpiresAt) return null
  const fim = accessExpiresAt instanceof Date ? accessExpiresAt : new Date(accessExpiresAt)
  if (Number.isNaN(fim.getTime())) return null
  return Math.floor((agora.getTime() - fim.getTime()) / (24 * 60 * 60 * 1000))
}

function agrupar(linhas) {
  const mapa = new Map()
  for (const linha of linhas) {
    const atual = mapa.get(linha.classe) ?? { qtd: 0, rssMb: 0, comRss: 0 }
    atual.qtd += 1
    if (Number.isFinite(linha.rssMb)) { atual.rssMb += linha.rssMb; atual.comRss += 1 }
    mapa.set(linha.classe, atual)
  }
  return mapa
}

function imprimirGrupo(titulo, linhas, { comMemoria }) {
  const mapa = agrupar(linhas)
  console.log(`\n${titulo}`)
  if (!linhas.length) { console.log('  (nenhum)'); return mapa }
  for (const classe of ORDEM_CLASSES) {
    const dados = mapa.get(classe)
    if (!dados) continue
    const memoria = comMemoria && dados.comRss
      ? `  ~${(dados.rssMb / 1024).toFixed(2)} GB`
      : ''
    console.log(`  ${String(dados.qtd).padStart(3)}  ${classe.padEnd(16)}${memoria}`)
  }
  return mapa
}

async function main() {
  const ligados = robosLigados()

  // Um lookup só para todos os userId envolvidos — nunca uma consulta por robô.
  const sessoesBrutas = await db.waSession.findMany({
    where: buildResurrectionWhere({ includeReconnecting: resolveIncludeReconnecting() }),
    select: { userId: true, status: true, lifecycle: true },
  }).catch(err => {
    console.error(`Falha ao ler WaSession: ${err?.message}`)
    return []
  })
  const ressuscitaveis = sessoesBrutas.filter(s => shouldResurrectSession({
    ...s,
    includeReconnecting: resolveIncludeReconnecting(),
  }))

  const idsProcesso = ligados.itens.map(i => i.userId).filter(Boolean)
  const ids = [...new Set([...idsProcesso, ...ressuscitaveis.map(s => s.userId)])]
  const usuarios = ids.length
    ? await db.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true, plan: true, accessExpiresAt: true },
      }).catch(() => [])
    : []
  const porId = new Map(usuarios.map(u => [u.id, u]))

  const linhasProcesso = ligados.itens.map(item => {
    const user = item.userId ? porId.get(item.userId) : null
    const { classe, rotulo } = classificarAcesso(item.userId ? user : undefined)
    return {
      fonte: 'processo',
      pid: item.pid,
      userId: item.userId ?? '',
      nome: user?.name ?? '',
      email: user?.email ?? '',
      plano: user ? normalizePlan(user.plan) : '',
      venceuHaDias: diasVencido(user?.accessExpiresAt),
      rssMb: item.rssMb,
      classe,
      rotulo,
    }
  })

  const linhasBanco = ressuscitaveis.map(s => {
    const user = porId.get(s.userId)
    const { classe, rotulo } = classificarAcesso(user)
    return {
      fonte: 'banco',
      pid: '',
      userId: s.userId,
      nome: user?.name ?? '',
      email: user?.email ?? '',
      plano: user ? normalizePlan(user.plan) : '',
      venceuHaDias: diasVencido(user?.accessExpiresAt),
      rssMb: null,
      classe,
      rotulo,
      status: s.status,
      lifecycle: s.lifecycle,
    }
  })

  if (asCsv) {
    console.log('fonte,pid,userId,nome,email,plano,classe,venceu_ha_dias,rss_mb')
    for (const l of [...linhasProcesso, ...linhasBanco]) {
      const campo = v => `"${String(v ?? '').replace(/"/g, '""')}"`
      console.log([l.fonte, l.pid, l.userId, campo(l.nome), campo(l.email), l.plano, l.classe, l.venceuHaDias ?? '', l.rssMb ?? ''].join(','))
    }
    await db.$disconnect().catch(() => {})
    return
  }

  console.log(`Ambiente: ${RAIZ_AMBIENTE}`)
  console.log(`Teto de robôs por processo (MAX_SESSIONS_PER_PROCESS): ${MAX_SESSOES}`)

  if (!ligados.disponivel) {
    console.log('\n[1] /proc indisponível — sem leitura dos robôs ligados neste servidor.')
  } else if (!linhasProcesso.length) {
    console.log('\n[1] Nenhum robô deste ambiente ligado agora.')
  } else {
    const semUserId = linhasProcesso.filter(l => !l.userId).length
    imprimirGrupo(`[1] ROBÔS LIGADOS AGORA (${linhasProcesso.length} de ${MAX_SESSOES} vagas)`, linhasProcesso, { comMemoria: true })
    if (semUserId) console.log(`  ⚠️  ${semUserId} processo(s) sem BOT_USER_ID legível (permissão do /proc) — contam como vaga, mas não como conta.`)
  }

  const vencidos = linhasProcesso.filter(l => l.classe === 'trial_vencido' || l.classe === 'plano_vencido')
  const ramVencida = vencidos.reduce((soma, l) => soma + (Number.isFinite(l.rssMb) ? l.rssMb : 0), 0)
  if (vencidos.length) {
    console.log(`\n  ➜ ${vencidos.length} de ${MAX_SESSOES} vagas ocupadas por acesso VENCIDO (~${(ramVencida / 1024).toFixed(2)} GB).`)
    console.log('    Cada uma é vaga que uma cliente pagante não consegue usar.')
    for (const l of vencidos.sort((a, b) => (b.venceuHaDias ?? 0) - (a.venceuHaDias ?? 0))) {
      const dias = l.venceuHaDias === null ? '?' : `${l.venceuHaDias}d`
      console.log(`      ${l.email || l.userId}  ${l.plano}  venceu há ${dias}  ${l.rssMb ?? '?'} MB`)
    }
  } else if (linhasProcesso.length) {
    console.log('\n  ➜ Nenhuma vaga ocupada por acesso vencido neste momento.')
  }

  imprimirGrupo(`[2] SESSÕES QUE O SUPERVISOR RESSUSCITARIA NO PRÓXIMO BOOT (${linhasBanco.length})`, linhasBanco, { comMemoria: false })
  const vencidasNoBanco = linhasBanco.filter(l => l.classe === 'trial_vencido' || l.classe === 'plano_vencido').length
  if (vencidasNoBanco) {
    console.log(`  ➜ ${vencidasNoBanco} delas com acesso VENCIDO — o resume não filtra por acesso.`)
  }

  console.log('\nLembretes:')
  console.log('  • Este script NÃO desliga nada. Desligar sessão de acesso vencido é decisão sua.')
  console.log('  • Rode nos dois ambientes se quiser a foto completa (~/wabot e ~/wabot-staging).')
  console.log('  • --csv devolve a lista para conferir conta por conta.')

  await db.$disconnect().catch(() => {})
}

main().catch(async err => {
  console.error(err?.stack || err?.message || err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
