const REQUIRED_STRING_FIELDS = ['slug', 'name', 'positioning', 'bestFor', 'notIdealFor', 'migrationNotes', 'updatedAt']

const COMPETITORS = [
  {
    slug: 'manual-spreadsheet-workflow',
    name: 'Planilha + envio manual',
    positioning: 'Operação manual com planilha e checklist humano para organizar grupos, links e horários.',
    bestFor: 'Operações pequenas com baixo volume semanal e revisão próxima de quem publica.',
    notIdealFor: 'Times que precisam escalar cadência, auditoria e repetição diária com menos erro manual.',
    pricingTiers: [
      { name: 'Ferramentas básicas', price: 'Baixo custo', notes: 'Planilha + rotina manual; custo principal vira tempo operacional.' },
    ],
    strengths: [
      'Controle humano total sobre contexto e copy',
      'Baixo custo inicial',
      'Sem dependência de integrações técnicas',
    ],
    weaknesses: [
      'Baixa escalabilidade operacional',
      'Maior risco de esquecimento de horário e repetição',
      'Auditoria depende de disciplina manual',
    ],
    migrationNotes: 'Migrar mantendo a planilha como planejamento editorial e delegando execução recorrente ao fluxo operacional da ferramenta.',
    updatedAt: '2026-05-17',
  },
  {
    slug: 'generic-automation-tools',
    name: 'Ferramentas genéricas de automação',
    positioning: 'Conectores, scripts e fluxos customizados para equipes técnicas com múltiplas integrações.',
    bestFor: 'Operações com engenharia interna e necessidade de integrar diversos sistemas.',
    notIdealFor: 'Times sem capacidade técnica contínua para manter integrações e governança operacional.',
    pricingTiers: [
      { name: 'Stack técnica', price: 'Variável', notes: 'Custo depende de ferramentas, horas de implementação e manutenção contínua.' },
    ],
    strengths: [
      'Alta flexibilidade de arquitetura',
      'Integração com múltiplos sistemas de dados',
      'Customização avançada por equipe técnica',
    ],
    weaknesses: [
      'Maior custo de manutenção ao longo do tempo',
      'Risco de quebra quando APIs/layouts mudam',
      'Dependência de documentação e governança interna',
    ],
    migrationNotes: 'Mapear fluxos críticos e migrar por etapas, mantendo integrações externas em paralelo até estabilizar o novo processo.',
    updatedAt: '2026-05-17',
  },
  {
    slug: 'official-service-api-tools',
    name: 'Ferramentas de atendimento/API oficial',
    positioning: 'Soluções focadas em atendimento, templates e conversas com clientes usando APIs oficiais.',
    bestFor: 'Empresas com foco em suporte, CRM conversacional e jornadas de atendimento.',
    notIdealFor: 'Operações cujo principal problema é curadoria e redistribuição de ofertas em múltiplos grupos.',
    pricingTiers: [
      { name: 'Plano por conversas/uso', price: 'Variável', notes: 'Normalmente inclui custos de mensagens e plataforma.' },
    ],
    strengths: [
      'Governança forte para atendimento',
      'Bom encaixe com fluxos de suporte comercial',
      'Suporte a templates e integrações de atendimento',
    ],
    weaknesses: [
      'Nem sempre cobre curadoria de ofertas por grupos',
      'Pode exigir complementos para rotina de afiliados',
      'Custo pode crescer com volume de conversas',
    ],
    migrationNotes: 'Usar ferramentas oficiais para atendimento e manter fluxo especializado para operação de ofertas quando necessário.',
    updatedAt: '2026-05-17',
  },
]

const competitorsBySlug = new Map(COMPETITORS.map((competitor) => [competitor.slug, competitor]))

function assertString(value, field, competitorName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Competitor data inválido (${competitorName}): campo obrigatório "${field}" ausente ou vazio.`)
  }
}

function validateCompetitorShape(competitor) {
  const competitorName = competitor?.name || competitor?.slug || 'unknown'

  for (const field of REQUIRED_STRING_FIELDS) {
    assertString(competitor?.[field], field, competitorName)
  }

  if (!Array.isArray(competitor.pricingTiers) || competitor.pricingTiers.length === 0) {
    throw new Error(`Competitor data inválido (${competitorName}): pricingTiers deve ter pelo menos um item.`)
  }

  for (const tier of competitor.pricingTiers) {
    assertString(tier?.name, 'pricingTiers[].name', competitorName)
    assertString(tier?.price, 'pricingTiers[].price', competitorName)
    assertString(tier?.notes, 'pricingTiers[].notes', competitorName)
  }

  for (const field of ['strengths', 'weaknesses']) {
    if (!Array.isArray(competitor[field]) || competitor[field].length === 0) {
      throw new Error(`Competitor data inválido (${competitorName}): ${field} deve ter pelo menos um item.`)
    }
    competitor[field].forEach((item, index) => assertString(item, `${field}[${index}]`, competitorName))
  }
}

export function listCompetitors() {
  return COMPETITORS
}

export function getCompetitorBySlug(slug) {
  const competitor = competitorsBySlug.get(slug)
  if (!competitor) throw new Error(`Competitor não encontrado para slug: ${slug}`)
  return competitor
}

for (const competitor of COMPETITORS) {
  validateCompetitorShape(competitor)
}
