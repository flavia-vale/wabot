export const PROOF_ASSETS = {
  methodology: {
    id: 'metodologia-operacional',
    title: 'Metodologia operacional antes de escalar',
    summary: 'Checklist de origem, revisão de oferta, regra de distribuição e análise de logs antes de escalar campanhas.',
    evidenceType: 'methodology',
    links: [
      { href: '/metodologia-uso-responsavel-whatsapp', label: 'Metodologia de uso responsável' },
      { href: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', label: 'Checklist de divulgação de ofertas' },
    ],
  },
  benchmark: {
    id: 'benchmark-operacao',
    title: 'Benchmark de operação com critérios públicos',
    summary: 'Métricas de rotina (tempo, cadência, erros evitados) para comparar processo manual vs processo assistido.',
    evidenceType: 'benchmark',
    links: [
      { href: '/benchmarks/operacao-grupos-ofertas-whatsapp', label: 'Benchmark de operação' },
      { href: '/estudos-de-caso', label: 'Estudos de caso e aprendizados' },
    ],
  },
}

export function getProofAssetsForCluster(cluster = '') {
  if (cluster === 'localizacoes') return [PROOF_ASSETS.methodology, PROOF_ASSETS.benchmark]
  if (cluster === 'nichos') return [PROOF_ASSETS.benchmark, PROOF_ASSETS.methodology]
  return [PROOF_ASSETS.methodology]
}
