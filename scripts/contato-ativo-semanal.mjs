#!/usr/bin/env node
/**
 * CONTATO ATIVO SEMANAL — a lista de quem procurar nesta semana, com nome,
 * e-mail e telefone.
 *
 * READ-ONLY: não grava nada, não manda e-mail, não liga nem desliga robô.
 * Roda DENTRO do diretório do ambiente (prod tem o banco de prod):
 *
 *   cd ~/wabot && node scripts/contato-ativo-semanal.mjs
 *   cd ~/wabot && node scripts/contato-ativo-semanal.mjs --csv > /tmp/contatos.csv
 *   cd ~/wabot && node scripts/contato-ativo-semanal.mjs --grupo=venceu-ate-3d
 *   cd ~/wabot && node scripts/contato-ativo-semanal.mjs --so-pedidos
 *   cd ~/wabot && node scripts/contato-ativo-semanal.mjs --nao-falei-em=14
 *
 * Cada cliente aparece UMA vez, no grupo de maior prioridade (a regra está em
 * `src/domain/admin/outreachSegments.js`, pura e testada). Três mensagens
 * diferentes para a mesma pessoa na mesma semana é o jeito mais rápido de ela
 * parar de ler o que a gente manda.
 *
 * ⚠️ A saída tem telefone e e-mail de cliente. É dado pessoal: use para o
 * contato e não repasse o arquivo. O painel mascara telefone por papel
 * (`sanitizeUser`); aqui não mascara de propósito — é a dona do produto
 * rodando no próprio servidor para conseguir ligar.
 */
import 'dotenv/config'
import db from '../src/db.js'
import {
  OUTREACH_SEGMENTS,
  classifyOutreachSegment,
  describeOutreachSegment,
} from '../src/domain/admin/outreachSegments.js'
import { wasStoppedByUser } from '../src/email/accountActivity.js'
import { SUBSCRIPTION_ACTIVE_STATUS } from '../src/domain/payments/subscriptionPolicy.js'

const args = process.argv.slice(2)
const flag = (nome, padrao = null) => {
  const hit = args.find(a => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const asCsv = args.includes('--csv')
const soPedidos = args.includes('--so-pedidos')
const grupoFiltro = flag('grupo')
const naoFaleiEm = Number(flag('nao-falei-em', '0')) || 0
const limite = Number(flag('limite', '0')) || 0
const agora = new Date()
const DIA = 24 * 60 * 60 * 1000

if (args.includes('--ajuda') || args.includes('--help')) {
  console.log('Grupos disponíveis para --grupo=:\n')
  for (const s of OUTREACH_SEGMENTS) console.log(`  ${s.id.padEnd(20)} ${s.titulo}`)
  process.exit(0)
}

const fmtData = d => (d ? new Date(d).toISOString().slice(0, 10) : '')
const diasDe = d => (d ? Math.floor((agora.getTime() - new Date(d).getTime()) / DIA) : null)

async function seguro(promessa, padrao) {
  try {
    return await promessa
  } catch (err) {
    // Consulta que falha nunca vira conclusão: avisa e segue com o padrão.
    console.error(`⚠️  Uma consulta falhou (${err?.message ?? err}) — a lista pode estar incompleta.`)
    return padrao
  }
}

async function main() {
  console.log(`# Ambiente: ${process.env.APP_ENV || 'não declarado'} · ${new Date().toLocaleString('pt-BR')}`)

  const usuarios = await db.user.findMany({
    where: { status: { notIn: ['banned', 'suspended'] } },
    select: {
      id: true, name: true, email: true, contactPhone: true,
      plan: true, status: true, accessExpiresAt: true, createdAt: true,
      lastSupportContactAt: true, lastLoginAt: true,
      waSession: { select: { phone: true, status: true, updatedAt: true } },
    },
  })
  if (!usuarios.length) {
    console.log('Nenhuma conta neste banco.')
    return
  }
  const ids = usuarios.map(u => u.id)

  // --- fatos em LOTE (nunca uma consulta por cliente) ---------------------
  const [envios, credenciais, assinaturas, cobrancas, pagamentos, eventos] = await Promise.all([
    seguro(db.messageLog.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, status: 'success' },
      _count: { _all: true },
      _max: { sentAt: true },
    }), []),
    seguro(db.credential.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _count: { _all: true },
    }), []),
    seguro(db.subscription.findMany({
      where: { userId: { in: ids }, status: SUBSCRIPTION_ACTIVE_STATUS },
      select: { userId: true },
    }), []),
    seguro(db.subscriptionCharge.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, status: 'rejected' },
      _max: { attemptedAt: true },
    }), []),
    seguro(db.payment.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, status: 'approved' },
      _count: { _all: true },
      _max: { createdAt: true },
    }), []),
    seguro(db.waConnectionEvent.groupBy({
      by: ['userId', 'type'],
      where: { userId: { in: ids }, type: { in: ['manual_stop_requested', 'connected', 'reconnect_success'] } },
      _max: { occurredAt: true },
    }), []),
  ])

  const porId = (linhas, campo = 'userId') => new Map(linhas.map(l => [l[campo], l]))
  const mapEnvios = porId(envios)
  const mapCred = porId(credenciais)
  const mapCobranca = porId(cobrancas)
  const mapPagto = porId(pagamentos)
  const comAssinatura = new Set(assinaturas.map(a => a.userId))

  const paradaPor = new Map()
  const conectouEm = new Map()
  for (const ev of eventos) {
    const quando = ev._max?.occurredAt ?? null
    if (!quando) continue
    if (ev.type === 'manual_stop_requested') paradaPor.set(ev.userId, quando)
    else {
      const atual = conectouEm.get(ev.userId)
      if (!atual || new Date(quando) > new Date(atual)) conectouEm.set(ev.userId, quando)
    }
  }

  // --- classificação ------------------------------------------------------
  const linhas = []
  for (const u of usuarios) {
    const envio = mapEnvios.get(u.id)
    const waStatus = u.waSession?.status ?? null
    const stoppedByUserAt = paradaPor.get(u.id) ?? null
    const lastConnectedAt = conectouEm.get(u.id) ?? null
    const fatos = {
      status: u.status,
      createdAt: u.createdAt,
      accessExpiresAt: u.accessExpiresAt,
      everSent: Boolean(envio?._count?._all),
      lastSentAt: envio?._max?.sentAt ?? null,
      hasCredential: Boolean(mapCred.get(u.id)?._count?._all),
      waEverConnected: Boolean(lastConnectedAt || u.waSession?.phone),
      waConnected: waStatus === 'connected',
      waSince: u.waSession?.updatedAt ?? null,
      waStoppedByUser: wasStoppedByUser({ stoppedByUserAt, lastConnectedAt }),
      subscriptionActive: comAssinatura.has(u.id),
      lastRejectedChargeAt: mapCobranca.get(u.id)?._max?.attemptedAt ?? null,
      lastApprovedPaymentAt: mapPagto.get(u.id)?._max?.createdAt ?? null,
    }
    const grupo = classifyOutreachSegment(fatos, agora)
    if (!grupo) continue
    if (grupoFiltro && grupo !== grupoFiltro) continue
    if (soPedidos && !describeOutreachSegment(grupo)?.pedido) continue
    const diasDesdeContato = diasDe(u.lastSupportContactAt)
    if (naoFaleiEm && diasDesdeContato !== null && diasDesdeContato < naoFaleiEm) continue

    linhas.push({
      grupo,
      nome: u.name,
      email: String(u.email).endsWith('@sistema.com') ? '' : u.email,
      // WaSession.phone é o número que ela conectou; serve quando o telefone do
      // cadastro está vazio.
      telefone: u.contactPhone || u.waSession?.phone || '',
      plano: u.plan,
      ja_pagou: mapPagto.get(u.id)?._count?._all ? 'sim' : 'não',
      venceu_em: fmtData(u.accessExpiresAt),
      dias_vencido: u.accessExpiresAt ? Math.max(0, diasDe(u.accessExpiresAt)) : '',
      conta_criada: fmtData(u.createdAt),
      dias_de_conta: diasDe(u.createdAt) ?? '',
      nunca_enviou: fatos.everSent ? 'não' : 'sim',
      ultimo_envio: fmtData(fatos.lastSentAt),
      envios_total: envio?._count?._all ?? 0,
      loja: fatos.hasCredential ? 'sim' : 'não',
      whatsapp: fatos.waConnected ? 'conectado' : fatos.waEverConnected ? 'caiu' : 'nunca conectou',
      ultimo_acesso: fmtData(u.lastLoginAt),
      ultimo_contato: fmtData(u.lastSupportContactAt),
    })
  }

  const ordem = OUTREACH_SEGMENTS.map(s => s.id)
  linhas.sort((a, b) => {
    const d = ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo)
    return d !== 0 ? d : String(a.nome).localeCompare(String(b.nome), 'pt-BR')
  })

  const COLUNAS = ['grupo', 'nome', 'email', 'telefone', 'plano', 'ja_pagou', 'venceu_em', 'dias_vencido',
    'conta_criada', 'dias_de_conta', 'nunca_enviou', 'ultimo_envio', 'envios_total', 'loja', 'whatsapp',
    'ultimo_acesso', 'ultimo_contato']

  if (asCsv) {
    console.log(COLUNAS.join(','))
    for (const l of linhas) {
      console.log(COLUNAS.map(c => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(','))
    }
    return
  }

  if (!linhas.length) {
    console.log('\nNinguém para procurar nesta semana com os filtros usados.')
    console.log('(--ajuda lista os grupos; sem --grupo a lista sai completa.)\n')
    return
  }

  let grupoAtual = null
  let mostradas = 0
  for (const l of linhas) {
    if (l.grupo !== grupoAtual) {
      grupoAtual = l.grupo
      mostradas = 0
      const s = describeOutreachSegment(l.grupo)
      const total = linhas.filter(x => x.grupo === l.grupo).length
      console.log(`\n${'='.repeat(72)}`)
      console.log(`${s.titulo}  —  ${total} cliente(s)`)
      console.log(`Por quê: ${s.porque}`)
      console.log(`O que dizer: ${s.acao}`)
      console.log('='.repeat(72))
    }
    mostradas += 1
    if (limite && mostradas > limite) {
      if (mostradas === limite + 1) console.log(`  … (mais na lista; use --csv ou --limite=0 para ver todas)`)
      continue
    }
    console.log(`\n  ${l.nome}`)
    console.log(`    telefone: ${l.telefone || '(não cadastrado)'}    e-mail: ${l.email || '(sem e-mail real)'}`)
    console.log(`    plano: ${l.plano} | já pagou: ${l.ja_pagou} | acesso até: ${l.venceu_em || '—'}${l.dias_vencido ? ` (vencido há ${l.dias_vencido}d)` : ''}`)
    console.log(`    conta: ${l.conta_criada} (${l.dias_de_conta}d) | envios: ${l.envios_total}${l.ultimo_envio ? ` (último ${l.ultimo_envio})` : ' — NUNCA publicou'}`)
    console.log(`    loja cadastrada: ${l.loja} | whatsapp: ${l.whatsapp} | último contato: ${l.ultimo_contato || 'nunca'}`)
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log(`Total: ${linhas.length} cliente(s) para procurar.`)
  console.log('Planilha: node scripts/contato-ativo-semanal.mjs --csv > /tmp/contatos.csv')
  console.log('Só os 5 grupos que você pediu: --so-pedidos')
  console.log('Pular quem você já falou nos últimos 14 dias: --nao-falei-em=14\n')
}

main()
  .catch(err => { console.error('Falhou:', err?.message ?? err); process.exitCode = 1 })
  .finally(() => db.$disconnect().catch(() => {}))
