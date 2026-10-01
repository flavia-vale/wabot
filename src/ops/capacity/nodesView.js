/**
 * Visão de capacidade POR SERVIDOR (nó) do supervisor — para o painel admin
 * (MN-17). PURA: recebe o que foi medido e devolve o que a tela precisa, em
 * linguagem leiga. Só faz sentido com SUPERVISOR_NODE_ROUTING ligado.
 *
 * Regra de ouro (a mesma do RCA de capacidade): **sem medição não se afirma
 * nada**. Servidor não medido nunca vira "0 robôs"/"vazio", e o total geral só
 * existe se TODOS os servidores vivos foram medidos.
 */

export const NODE_STATUS = Object.freeze({
  OK: 'ok',
  TIGHT: 'apertado',
  FULL: 'lotado',
  DOWN: 'fora_do_ar',
  UNMEASURED: 'sem_medicao',
})

const LABELS = {
  [NODE_STATUS.OK]: 'Funcionando, com vagas',
  [NODE_STATUS.TIGHT]: 'Poucas vagas sobrando',
  [NODE_STATUS.FULL]: 'Lotado: contas novas não conseguem conectar aqui',
  [NODE_STATUS.DOWN]: 'Fora do ar: as contas deste servidor estão sem robô',
  [NODE_STATUS.UNMEASURED]: 'Sem medição agora: não dá para saber quantas vagas sobram',
}

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

function classify({ alive, running, capacity }, tightFreeSlots) {
  if (!alive) return NODE_STATUS.DOWN
  if (running === null || capacity === null || capacity < 1) return NODE_STATUS.UNMEASURED
  const free = capacity - running
  if (free <= 0) return NODE_STATUS.FULL
  if (free <= tightFreeSlots) return NODE_STATUS.TIGHT
  return NODE_STATUS.OK
}

/**
 * @param {Object} m
 * @param {Array<{nodeId:string, alive:boolean, running:number|null, capacity:number|null}>} m.nodes
 * @param {Record<string, number|null>} [m.bootedAtMs]     nodeId -> epoch ms
 * @param {Record<string, number|null>} [m.dbSessions]     nodeId -> contas apontando para o nó
 * @param {number} [m.tightFreeSlots]                      "apertado" quando sobram ≤ N (padrão 2)
 */
export function buildNodesCapacityView({ nodes = [], bootedAtMs = {}, dbSessions = {}, tightFreeSlots = 2 } = {}) {
  const items = nodes.map(n => {
    const alive = Boolean(n.alive)
    const running = num(n.running)
    const capacity = num(n.capacity)
    const status = classify({ alive, running, capacity }, tightFreeSlots)
    const measured = alive && running !== null && capacity !== null && capacity >= 1
    const booted = num(bootedAtMs[n.nodeId])
    return {
      nodeId: n.nodeId,
      status,
      statusLabel: LABELS[status],
      alive,
      running,
      capacity,
      free: measured ? Math.max(0, capacity - running) : null,
      bootedAt: booted && booted > 0 ? new Date(booted).toISOString() : null,
      dbSessions: num(dbSessions[n.nodeId]),
    }
  })

  const live = items.filter(i => i.alive)
  const allLiveMeasured = live.length > 0 && live.every(i => i.running !== null && i.capacity !== null && i.capacity >= 1)
  const totals = allLiveMeasured
    ? {
        running: live.reduce((s, i) => s + i.running, 0),
        capacity: live.reduce((s, i) => s + i.capacity, 0),
        free: live.reduce((s, i) => s + i.free, 0),
        downNodes: items.filter(i => !i.alive).length,
      }
    : null

  return { routing: true, nodes: items, totals }
}

/** Resposta quando o roteamento por servidor está desligado: nada a mostrar. */
export function nodesViewDisabled() {
  return { routing: false, nodes: [], totals: null }
}
