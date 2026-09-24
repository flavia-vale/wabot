// Regras PURAS (sem banco/rede) usadas pelo diagnóstico
// `scripts/diag-antiban-valores.mjs` — separadas do script para que a lógica
// de classificação seja testável sem precisar de um banco de dados, e para
// que o script nunca reimplemente comparação campo a campo (isso já existe no
// módulo do piso anti-banimento, importado só pelo script, nunca duplicado
// aqui).
//
// specs/018-unificar-protecao-anti-ban, Fase 7 (T057-T060).

/** p50/p90/máximo de um array de números. Array vazio devolve tudo `null`. */
export function percentiles(valores) {
  const limpos = (valores || []).filter((v) => Number.isFinite(v))
  if (limpos.length === 0) return { p50: null, p90: null, max: null, n: 0 }
  const ordenado = [...limpos].sort((a, b) => a - b)
  const pega = (p) => ordenado[Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1)]
  return { p50: pega(50), p90: pega(90), max: ordenado[ordenado.length - 1], n: ordenado.length }
}

/**
 * Classifica um campo GRAVADO contra o piso fixo (Parte A). Não reimplementa
 * `applyDestinationFloor`/`ANTI_BAN_FLOOR` — recebe o valor do piso e o
 * comparador de "mais conservador" já resolvidos por fora, e só rotula.
 *
 * @param {number|null|undefined} storedValue valor gravado (null = herdando)
 * @param {number} floorValue valor fixo (ex.: ANTI_BAN_FLOOR.burstCap)
 * @param {'menor-vence'|'maior-vence'} regra qual lado é "mais conservador"
 * @returns {'herdando'|'igual'|'mais_conservador'|'menos_conservador'}
 */
export function classifyFixedFieldValue(storedValue, floorValue, regra) {
  if (storedValue === null || storedValue === undefined) return 'herdando'
  if (!Number.isFinite(storedValue)) return 'herdando'
  if (storedValue === floorValue) return 'igual'
  const maisConservador = regra === 'menor-vence' ? storedValue < floorValue : storedValue > floorValue
  return maisConservador ? 'mais_conservador' : 'menos_conservador'
}

/**
 * Parte B, item (4): compara o atraso projetado (e/ou o acúmulo esperado da
 * fila) com o teto de descarte por idade da conta, e classifica o risco.
 * Limiares: < 50% do teto = ok; 50-99% = atenção; >= 100% = descartaria.
 *
 * @param {number|null} atrasoMs tempo estimado até a última saída (ms)
 * @param {number|null} queueMaxAgeMin teto de descarte (minutos; 0/null = sem teto)
 */
export function classifyQueueAgeRisk(atrasoMs, queueMaxAgeMin) {
  const tetoMin = Number(queueMaxAgeMin)
  if (!Number.isFinite(tetoMin) || tetoMin <= 0) return { nivel: 'sem_teto', percentualDoTeto: null }
  if (!Number.isFinite(atrasoMs) || atrasoMs === null) return { nivel: 'sem_dado', percentualDoTeto: null }
  const tetoMs = tetoMin * 60_000
  const pct = atrasoMs / tetoMs
  const nivel = pct >= 1 ? 'descartaria' : pct >= 0.5 ? 'atencao' : 'ok'
  return { nivel, percentualDoTeto: Math.round(pct * 1000) / 10 }
}

/**
 * Atraso projetado da última saída ao publicar para N destinos em sequência,
 * com o intervalo entre destinos fixo (FR-022/025): (N-1) × intervalo.
 * N=0 ou N=1 não têm espera de espaçamento nenhuma (0ms).
 */
export function projectedLastDestinationDelayMs(destinationCount, intervalMs) {
  const n = Number(destinationCount)
  const iv = Number(intervalMs)
  if (!Number.isFinite(n) || n <= 1 || !Number.isFinite(iv) || iv <= 0) return 0
  return (n - 1) * iv
}

/** Vazão teórica de destinos/hora com o intervalo entre destinos vigente. */
export function theoreticalDestinationsPerHour(intervalSec) {
  const iv = Number(intervalSec)
  if (!Number.isFinite(iv) || iv <= 0) return null
  return Math.round(3600 / iv)
}
