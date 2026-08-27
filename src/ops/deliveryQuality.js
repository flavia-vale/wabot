// Visão macro de qualidade de entrega das ofertas (painel admin).
//
// Pergunta que ela responde, sem a cliente precisar reclamar:
//   1. quantas ofertas saíram na janela;
//   2. COMO saíram (foto, card com foto da loja, card com a foto da origem,
//      banner, ou só texto);
//   3. quantas saíram SEM imagem nenhuma **tendo** imagem na mensagem de
//      origem — o caso em que a foto existia e se perdeu no caminho.
//
// A parte de decisão é pura (`resumirEntregas`) para dar teste sem banco; o
// carregador recebe o `db` por injeção, no mesmo padrão de accountActivity.js.

import { DELIVERY_KIND, entregouComImagem, ofertaPerdeuImagem, rotuloDeliveryKind } from '../core/deliveryKind.js'

export const JANELA_PADRAO_HORAS = 24

/**
 * @param {Array<{deliveryKind?:string|null, originImageBytes?:number|null, platform?:string, userId?:string, sourceGroup?:string, destGroup?:string}>} linhas
 */
export function resumirEntregas(linhas = []) {
  const porTipo = new Map()
  const porLoja = new Map()
  let total = 0
  let comImagem = 0
  let semRegistro = 0
  let perderamImagem = 0

  for (const l of linhas) {
    total++
    const kind = l?.deliveryKind || null
    if (!kind) semRegistro++
    porTipo.set(kind || 'nao_registrado', (porTipo.get(kind || 'nao_registrado') || 0) + 1)

    const loja = String(l?.platform || '').split('+')[0] || 'desconhecida'
    if (!porLoja.has(loja)) porLoja.set(loja, { loja, total: 0, comImagem: 0, semImagem: 0, perderamImagem: 0 })
    const bucket = porLoja.get(loja)
    bucket.total++

    if (entregouComImagem(kind)) {
      comImagem++
      bucket.comImagem++
    } else if (kind === DELIVERY_KIND.TEXTO) {
      bucket.semImagem++
    }

    if (ofertaPerdeuImagem({ deliveryKind: kind, originImageBytes: l?.originImageBytes })) {
      perderamImagem++
      bucket.perderamImagem++
    }
  }

  // Percentual só sobre o que TEM registro: linhas antigas (sem deliveryKind)
  // não podem diluir o indicador e dar falsa sensação de melhora.
  const comRegistro = total - semRegistro
  return {
    total,
    comRegistro,
    semRegistro,
    comImagem,
    perderamImagem,
    percentualComImagem: comRegistro > 0 ? Math.round((comImagem / comRegistro) * 1000) / 10 : null,
    porTipo: [...porTipo.entries()]
      .map(([kind, quantidade]) => ({ kind, rotulo: rotuloDeliveryKind(kind === 'nao_registrado' ? null : kind), quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    porLoja: [...porLoja.values()].sort((a, b) => b.total - a.total),
  }
}

/**
 * Agrupa os casos suspeitos (saiu sem imagem tendo imagem na origem) por
 * cliente e grupo de origem — é assim que se descobre que uma origem específica
 * está estragando as ofertas de alguém, que foi exatamente o caso de 2026-08-26.
 */
export function agruparPerdasPorOrigem(linhas = [], { limite = 20 } = {}) {
  const mapa = new Map()
  for (const l of linhas) {
    if (!ofertaPerdeuImagem({ deliveryKind: l?.deliveryKind, originImageBytes: l?.originImageBytes })) continue
    const chave = `${l.userId}|${l.sourceGroup}`
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        userId: l.userId,
        sourceGroup: l.sourceGroup,
        quantidade: 0,
        menorBytes: null,
        maiorBytes: null,
        lojas: new Set(),
      })
    }
    const item = mapa.get(chave)
    item.quantidade++
    const bytes = l.originImageBytes
    if (Number.isFinite(bytes)) {
      item.menorBytes = item.menorBytes === null ? bytes : Math.min(item.menorBytes, bytes)
      item.maiorBytes = item.maiorBytes === null ? bytes : Math.max(item.maiorBytes, bytes)
    }
    const loja = String(l?.platform || '').split('+')[0]
    if (loja) item.lojas.add(loja)
  }
  return [...mapa.values()]
    .map(i => ({ ...i, lojas: [...i.lojas] }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, limite)
}

/**
 * Carregador. `db` injetado para manter o módulo testável sem banco.
 */
export async function carregarVisaoEntrega({ db, horas = JANELA_PADRAO_HORAS, limiteOrigens = 20 } = {}) {
  const desde = new Date(Date.now() - Math.max(1, horas) * 3_600_000)
  const linhas = await db.messageLog.findMany({
    where: { status: 'success', sentAt: { gte: desde }, destGroup: { not: 'conversion' } },
    select: {
      userId: true,
      platform: true,
      sourceGroup: true,
      destGroup: true,
      deliveryKind: true,
      originImageBytes: true,
    },
    take: 20_000,
    orderBy: { sentAt: 'desc' },
  })

  const resumo = resumirEntregas(linhas)
  const perdas = agruparPerdasPorOrigem(linhas, { limite: limiteOrigens })

  // Nomes só para o que a tela vai mostrar (poucas linhas), não para as 20 mil.
  const userIds = [...new Set(perdas.map(p => p.userId))]
  const jids = [...new Set(perdas.map(p => p.sourceGroup))]
  const [usuarios, grupos] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
    jids.length ? db.group.findMany({ where: { waJid: { in: jids } }, select: { waJid: true, name: true } }) : [],
  ])
  const nomeUsuario = new Map(usuarios.map(u => [u.id, u.email || u.name]))
  const nomeGrupo = new Map(grupos.map(g => [g.waJid, g.name]))

  return {
    janelaHoras: horas,
    geradoEm: new Date().toISOString(),
    resumo,
    origensComPerda: perdas.map(p => ({
      ...p,
      cliente: nomeUsuario.get(p.userId) || p.userId,
      origemNome: nomeGrupo.get(p.sourceGroup) || null,
    })),
  }
}
