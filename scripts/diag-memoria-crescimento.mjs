#!/usr/bin/env node
//
// Crescimento de memória dos robôs com a IDADE — SOMENTE LEITURA.
//
// Responde a pergunta que ficou aberta na rodada 3 (2026-09-19): a frota foi de
// 92,8 MiB/robô (2,5 h) para 122,6 MiB/robô (11,6 h). É cache saudável,
// retenção do alocador ou vazamento lento? As três pedem ações opostas, e o que
// as separa é EM QUAL BALDE a memória cresce — nunca o total.
//
// Não reinicia nada, não escreve em banco, não lê segredo. Lê
// `/proc/<pid>/{smaps,status,stat,environ}` dos robôs já em execução e grava o
// histórico em um arquivo JSONL (uma linha por robô por medida).
//
// Com `--ipc` pede ao worker, pelo MESMO canal que o painel usa a cada
// carregamento de tela (comando `getBotMetrics` do supervisor), o que o V8
// enxerga: heapUsed, heapTotal, external, arrayBuffers, tamanho da fila e o
// p99 do event loop. É isso que separa "vazamento em JS" de "retenção nativa".
//
// Uso (no VPS, no diretório do ambiente):
//   node scripts/diag-memoria-crescimento.mjs            # foto agora + grava no histórico
//   node scripts/diag-memoria-crescimento.mjs --ipc      # idem, com o lado do V8 (modo remote)
//   node scripts/diag-memoria-crescimento.mjs --serie    # lê o histórico e diz o veredito
//   ALVO=staging node scripts/diag-memoria-crescimento.mjs
//
// Opções: --padrao=<trecho do cmdline> (default: bot-worker do ambiente),
//         --saida=<arquivo jsonl> (default /tmp/medidas/<ambiente>-robos.jsonl),
//         --top=<n> (linhas da tabela; default 60)
//
// Cadência sugerida: 1x por hora por 24 h (cron do usuário deploy, ou à mão).
// O veredito recusa concluir com menos de 3 medidas ou menos de 2 h de janela.

import { readFileSync, readdirSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { summarizeSmaps } from '../src/ops/memory/smapsBreakdown.js'
import { splitRobotMemory, classifyGrowth, describeGrowthVerdict, GROWTH_VERDICTS } from '../src/ops/memory/growthDiagnosis.js'

const ALVO = process.env.ALVO === 'staging' ? 'staging' : 'prod'
const PADRAO_DEFAULT = ALVO === 'staging' ? '/home/deploy/wabot-staging/src/bot-worker' : '/home/deploy/wabot/src/bot-worker'

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const flag = (name) => process.argv.includes(`--${name}`)

const padrao = arg('padrao', PADRAO_DEFAULT)
const saida = arg('saida', `/tmp/medidas/${ALVO}-robos.jsonl`)
const top = Number(arg('top', '60'))
const comIpc = flag('ipc')
const modoSerie = flag('serie')

const f1 = (v) => (v === null || v === undefined ? '-' : (Math.round(v * 10) / 10).toFixed(1))
const pad = (v, n, dir = 'right') => (dir === 'right' ? String(v).padStart(n) : String(v).padEnd(n))

function readProc(pid, file) {
  try { return readFileSync(`/proc/${pid}/${file}`, 'utf8') } catch { return null }
}

function listPids() {
  const out = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    const cmd = readProc(entry, 'cmdline')
    if (!cmd) continue
    const flat = cmd.replace(/\0/g, ' ')
    if (!flat.includes(padrao) || flat.includes('diag-memoria')) continue
    out.push(Number(entry))
  }
  return out
}

function statusInfo(pid) {
  const text = readProc(pid, 'status')
  if (!text) return null
  const grab = (key) => { const m = new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(text); return m ? Number(m[1]) : null }
  return { threads: grab('Threads'), rssAnon: (grab('RssAnon') ?? 0) * 1024, rssFile: (grab('RssFile') ?? 0) * 1024, vmRss: (grab('VmRSS') ?? 0) * 1024 }
}

// Idade em segundos: campo 22 do /proc/<pid>/stat (ticks desde o boot).
function idadeSegundos(pid) {
  const stat = readProc(pid, 'stat')
  if (!stat) return null
  const tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const startTicks = Number(tail[19])
  let uptime
  try { uptime = Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0]) } catch { return null }
  if (!Number.isFinite(startTicks) || !Number.isFinite(uptime)) return null
  return Math.max(0, Math.round(uptime - startTicks / 100))
}

// O worker não leva o userId na linha de comando — está no ambiente (BOT_USER_ID).
function userIdOf(pid) {
  const env = readProc(pid, 'environ')
  if (!env) return null
  const hit = env.split('\0').find((kv) => kv.startsWith('BOT_USER_ID='))
  return hit ? hit.slice('BOT_USER_ID='.length) : null
}

async function coletarRuntime(userIds) {
  const vazio = new Map()
  if (!userIds.length) return vazio
  process.env.LOG_LEVEL ||= 'warn'
  let manager
  try {
    await import('dotenv/config')
    manager = await import('../src/manager.js')
  } catch (err) {
    console.log(`  (IPC) não consegui carregar o manager: ${err?.message}. Seguindo só com /proc.`)
    return vazio
  }
  if (manager.SUPERVISOR_MODE !== 'remote') {
    console.log('  (IPC) BOT_SUPERVISOR_MODE não é "remote": neste modo só o processo que forkou os robôs (a API) fala com eles. Seguindo só com /proc.')
    return vazio
  }
  const fila = [...userIds]
  const out = new Map()
  const puxar = async () => {
    while (fila.length) {
      const id = fila.shift()
      try {
        const m = await manager.getBotMetrics(id)
        if (m?.runtime) out.set(id, { runtime: m.runtime, queueSize: m.queueSize ?? null, queuedTotal: m.queuedTotal ?? null })
      } catch (err) {
        console.log(`  (IPC) ${id}: ${err?.message}`)
      }
    }
  }
  await Promise.all([puxar(), puxar(), puxar()])
  return out
}

function gravar(linhas) {
  try {
    mkdirSync(dirname(saida), { recursive: true })
    appendFileSync(saida, linhas.map((l) => JSON.stringify(l)).join('\n') + '\n')
    return true
  } catch (err) {
    console.log(`  (histórico) não gravei em ${saida}: ${err?.message}`)
    return false
  }
}

async function medirAgora() {
  const pids = listPids()
  if (!pids.length) {
    console.log(`Nenhum processo casando com "${padrao}". Use --padrao= ou ALVO=staging.`)
    return
  }
  const agora = Date.now()
  const fotos = []
  for (const pid of pids) {
    const smapsText = readProc(pid, 'smaps')
    if (!smapsText) continue
    const smaps = summarizeSmaps(smapsText)
    const status = statusInfo(pid)
    const idade = idadeSegundos(pid)
    fotos.push({ pid, userId: userIdOf(pid), idadeSeg: idade, smaps, status })
  }
  if (!fotos.length) {
    console.log('Não consegui ler /proc/<pid>/smaps. Rode como o usuário dono dos processos (deploy).')
    return
  }
  const runtimes = comIpc ? await coletarRuntime(fotos.map((f) => f.userId).filter(Boolean)) : new Map()

  const linhas = fotos.map((f) => {
    const rt = f.userId ? runtimes.get(f.userId) : null
    const foto = splitRobotMemory({ smaps: f.smaps, status: f.status, runtime: rt?.runtime ?? null })
    return {
      atMs: agora,
      ambiente: ALVO,
      pid: f.pid,
      userId: f.userId,
      idadeMin: f.idadeSeg === null ? null : Math.round(f.idadeSeg / 60),
      // um robô reiniciado começa outra série: a chave carrega o instante do boot
      serie: `${f.userId ?? f.pid}@${f.idadeSeg === null ? f.pid : Math.round((agora - f.idadeSeg * 1000) / 60000)}`,
      ...foto,
      fila: rt?.queueSize ?? null,
      enviadosAcum: rt?.queuedTotal ?? null,
      eventLoopP99Ms: rt?.runtime?.eventLoopDelayMs?.p99 ?? null,
    }
  })

  linhas.sort((a, b) => (b.pssMiB ?? 0) - (a.pssMiB ?? 0))
  const n = linhas.length
  const media = (k) => linhas.filter((l) => Number.isFinite(l[k])).reduce((a, l) => a + l[k], 0) / Math.max(1, linhas.filter((l) => Number.isFinite(l[k])).length)
  const temV8 = linhas.some((l) => l.v8HeapUsedMiB !== null)
  const idades = linhas.map((l) => l.idadeMin).filter((v) => v !== null)

  console.log(`\n=== CRESCIMENTO DE MEMÓRIA — ${n} robôs (${ALVO}) — ${new Date(agora).toISOString()} ===`)
  console.log('MiB. glibc = [heap] + arenas (é onde a retenção do alocador aparece). fora-V8 = RSS anônimo que a API do Node não enxerga.\n')
  const cab = ['pid', 'idade', 'thr', 'PSS', 'glibc', 'anon', 'aren', 'RssAnon', 'V8used', 'V8tot', 'ext', 'arrBuf', 'foraV8', 'fila', 'p99ms']
  const larg = [7, 7, 4, 7, 7, 7, 5, 8, 7, 7, 6, 7, 7, 5, 6]
  console.log(cab.map((c, i) => pad(c, larg[i])).join(' '))
  for (const l of linhas.slice(0, top)) {
    console.log([
      l.pid, l.idadeMin === null ? '-' : `${l.idadeMin}m`, l.threads ?? '-', f1(l.pssMiB), f1(l.glibcMiB), f1(l.anonMiB), l.arenas ?? '-', f1(l.rssAnonMiB),
      f1(l.v8HeapUsedMiB), f1(l.v8HeapTotalMiB), f1(l.externalMiB), f1(l.arrayBuffersMiB), f1(l.foraDoV8MiB), l.fila ?? '-', l.eventLoopP99Ms ?? '-',
    ].map((v, i) => pad(v, larg[i])).join(' '))
  }
  console.log('')
  console.log(`  robôs ............... ${n}`)
  console.log(`  idade ............... mais velho ${Math.max(...idades, 0)} min | mais novo ${Math.min(...idades, 0)} min`)
  console.log(`  PSS ................. média ${f1(media('pssMiB'))} MiB/robô | soma ${f1(linhas.reduce((a, l) => a + (l.pssMiB ?? 0), 0))} MiB`)
  console.log(`  glibc ([heap]+arena)  média ${f1(media('glibcMiB'))} MiB/robô`)
  console.log(`  anônimo ............. média ${f1(media('anonMiB'))} MiB/robô`)
  if (temV8) {
    console.log(`  V8 heapUsed ......... média ${f1(media('v8HeapUsedMiB'))} MiB/robô | heapTotal ${f1(media('v8HeapTotalMiB'))} | arrayBuffers ${f1(media('arrayBuffersMiB'))}`)
    console.log(`  fora do V8 .......... média ${f1(media('foraDoV8MiB'))} MiB/robô   <-- o que process.memoryUsage() não mostra`)
  } else {
    console.log('  (sem --ipc: o lado do V8 fica vazio; com ele dá para separar vazamento em JS de retenção nativa)')
  }
  if (Math.max(...idades, 0) < 60) console.log('  ATENÇÃO: frota com menos de 1 h — ainda não saturou. Não comparar com frota assentada.')
  if (gravar(linhas)) console.log(`\n  gravado em ${saida} (${n} linhas). Repita 1x por hora e depois rode --serie.`)
}

function lerHistorico() {
  if (!existsSync(saida)) return []
  return readFileSync(saida, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

function serie() {
  const tudo = lerHistorico()
  if (!tudo.length) { console.log(`Histórico vazio em ${saida}. Rode o script sem --serie algumas vezes (1x por hora) antes.`); return }

  // Por robô (mesma vida de processo)
  const porSerie = new Map()
  for (const l of tudo) { const k = l.serie ?? `${l.pid}`; if (!porSerie.has(k)) porSerie.set(k, []); porSerie.get(k).push(l) }
  const vereditos = []
  for (const [k, amostras] of porSerie) {
    const r = classifyGrowth(amostras)
    vereditos.push({ serie: k, userId: amostras[0].userId, n: r.n, horas: r.spanHours, verdict: r.verdict, slopes: r.slopes, ultimoPss: amostras[amostras.length - 1].pssMiB })
  }

  // Frota: média por rodada de medição (mesmo atMs)
  const porRodada = new Map()
  for (const l of tudo) { if (!porRodada.has(l.atMs)) porRodada.set(l.atMs, []); porRodada.get(l.atMs).push(l) }
  const rodadas = [...porRodada.entries()].sort((a, b) => a[0] - b[0]).map(([atMs, ls]) => {
    const m = (k) => { const v = ls.filter((l) => Number.isFinite(l[k])); return v.length ? v.reduce((a, l) => a + l[k], 0) / v.length : null }
    return { atMs, robos: ls.length, idadeMin: Math.max(...ls.map((l) => l.idadeMin ?? 0)), pssMiB: m('pssMiB'), glibcMiB: m('glibcMiB'), anonMiB: m('anonMiB'), v8HeapUsedMiB: m('v8HeapUsedMiB'), arrayBuffersMiB: m('arrayBuffersMiB'), foraDoV8MiB: m('foraDoV8MiB') }
  })
  const frota = classifyGrowth(rodadas)

  console.log(`\n=== SÉRIE — ${rodadas.length} rodadas, ${porSerie.size} séries de robô, arquivo ${saida} ===\n`)
  console.log(pad('quando', 20, 'left') + pad('robôs', 6) + pad('idade', 8) + pad('PSS', 8) + pad('glibc', 8) + pad('anon', 8) + pad('V8used', 8) + pad('arrBuf', 8) + pad('foraV8', 8))
  for (const r of rodadas) {
    console.log(pad(new Date(r.atMs).toISOString().slice(0, 16), 20, 'left') + pad(r.robos, 6) + pad(`${r.idadeMin}m`, 8) + pad(f1(r.pssMiB), 8) + pad(f1(r.glibcMiB), 8) + pad(f1(r.anonMiB), 8) + pad(f1(r.v8HeapUsedMiB), 8) + pad(f1(r.arrayBuffersMiB), 8) + pad(f1(r.foraDoV8MiB), 8))
  }
  const reiniciou = rodadas.some((r, i) => i > 0 && r.idadeMin < rodadas[i - 1].idadeMin)
  if (reiniciou) console.log('\n  ATENÇÃO: a idade caiu entre rodadas — a frota reiniciou no meio. Compare só rodadas da mesma vida de processo.')

  console.log(`\n  FROTA (média por robô): ${frota.verdict.toUpperCase()} — ${frota.reason}`)
  console.log(`  inclinação (MiB/h): PSS ${frota.slopes.pss ?? '-'} | glibc ${frota.slopes.glibc ?? '-'} | V8 heapUsed ${frota.slopes.v8HeapUsed ?? '-'} | arrayBuffers ${frota.slopes.arrayBuffers ?? '-'}`)
  console.log(`\n  ${describeGrowthVerdict(frota.verdict)}`)

  const conclusivos = vereditos.filter((v) => v.verdict !== GROWTH_VERDICTS.SEM_DADO)
  if (conclusivos.length) {
    const contagem = {}
    for (const v of conclusivos) contagem[v.verdict] = (contagem[v.verdict] || 0) + 1
    console.log(`\n  POR ROBÔ (${conclusivos.length} com dado suficiente): ${Object.entries(contagem).map(([k, n]) => `${k}=${n}`).join(', ')}`)
    console.log('  os 10 que mais crescem (PSS MiB/h):')
    for (const v of conclusivos.sort((a, b) => (b.slopes.pss ?? 0) - (a.slopes.pss ?? 0)).slice(0, 10)) {
      console.log(`    ${pad(v.userId ?? v.serie, 28, 'left')} ${pad(v.slopes.pss ?? '-', 7)}/h  glibc ${pad(v.slopes.glibc ?? '-', 6)}  V8 ${pad(v.slopes.v8HeapUsed ?? '-', 6)}  arrBuf ${pad(v.slopes.arrayBuffers ?? '-', 6)}  ${v.horas}h  ${v.verdict}`)
    }
  }
  const vazando = conclusivos.filter((v) => v.verdict === GROWTH_VERDICTS.VAZAMENTO_JS)
  if (vazando.length) console.log(`\n  ⚠️ ${vazando.length} robô(s) com cara de vazamento em JS. Esses valem heap snapshot em staging com a MESMA conta, nunca troca de alocador.`)
}

if (modoSerie) serie()
else await medirAgora()

// O import do manager (--ipc) carrega src/logger.js de tabela, que abre o
// destino do pino em modo assíncrono (sonic-boom, sync:false). Sair na
// sequência sem dar tempo do stream ficar pronto faz o hook de saída do
// próprio pino (`autoEnd` -> `flushSync`) lançar "sonic boom is not ready
// yet" -- o dado já tinha sido gravado no .jsonl antes disso, então não é
// perda de medição, só um crash cosmético no fim do comando. A pausa curta
// dá tempo do stream abrir antes do exit forçado.
await new Promise(resolve => setTimeout(resolve, 200))
process.exit(0)
