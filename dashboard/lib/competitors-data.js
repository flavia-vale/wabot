const REQUIRED_STRING_FIELDS = ['slug', 'name', 'positioning', 'bestFor', 'notIdealFor', 'migrationNotes', 'updatedAt', 'verifiedAt']

const COMPETITORS = [
  {
    slug: 'divulgador-inteligente',
    name: 'Divulgador Inteligente',
    positioning: 'Ferramenta de automação para divulgação em grupos de WhatsApp com foco em rotina recorrente.',
    bestFor: 'Operações que querem automatizar divulgação com fluxo pronto sem montar stack técnica própria.',
    notIdealFor: 'Times que precisam de governança avançada de logs e comparação contínua de qualidade por campanha.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Preço e limites podem variar conforme período e oferta comercial.' },
    ],
    strengths: ['Automação de rotina de divulgação', 'Fluxo orientado para grupos', 'Baixa fricção inicial'],
    weaknesses: ['Pouca transparência pública de limites em materiais de comparação', 'Dependência de validação manual de claims de mercado', 'Comparação de suporte e SLA precisa ser confirmada caso a caso'],
    migrationNotes: 'Mapear regras de envio, limites e estrutura de grupos antes da migração para evitar perda de consistência operacional.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'divulga-ninja',
    name: 'Divulga Ninja',
    positioning: 'Solução para divulgação automatizada em grupos com apelo de velocidade operacional.',
    bestFor: 'Equipes que priorizam agilidade de execução em volume de grupos.',
    notIdealFor: 'Operações que precisam de trilha detalhada de auditoria por campanha e critérios rígidos de governança.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Detalhes de preço e limites devem ser confirmados no canal oficial.' },
    ],
    strengths: ['Foco em execução rápida', 'Uso orientado a grupos', 'Adoção simplificada'],
    weaknesses: ['Claims de diferenciação exigem validação periódica', 'Cobertura de funcionalidades avançadas pode variar por plano', 'Dependência de confirmação de política de suporte'],
    migrationNotes: 'Executar piloto com subconjunto de grupos e validar qualidade de envio antes de escalar.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'gigi-prime-bot',
    name: 'Gigi Prime Bot',
    positioning: 'Bot de apoio para rotina de divulgação e distribuição de ofertas em grupos.',
    bestFor: 'Perfis que buscam bot focado em operação prática de grupos.',
    notIdealFor: 'Times que exigem comparativos públicos extensos sobre governança e observabilidade.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Condições comerciais e limites devem ser confirmados diretamente.' },
    ],
    strengths: ['Fluxo direto para divulgação', 'Baixa complexidade de entrada', 'Foco em rotina operacional'],
    weaknesses: ['Informações públicas de benchmark podem ser limitadas', 'Diferenças entre planos exigem validação manual', 'SLA e suporte variam conforme canal'],
    migrationNotes: 'Comparar estabilidade da rotina em janela de testes e manter fallback manual durante transição.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'busqy',
    name: 'Busqy',
    positioning: 'Ferramenta para apoiar divulgação e organização de ofertas em WhatsApp.',
    bestFor: 'Operações que querem ganhar produtividade na curadoria e distribuição.',
    notIdealFor: 'Cenários que dependem de comparação pública detalhada de recursos de compliance avançado.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Faixas e benefícios comerciais devem ser validados no fornecedor.' },
    ],
    strengths: ['Produtividade operacional', 'Apoio à distribuição em grupos', 'Fluxo com baixa fricção inicial'],
    weaknesses: ['Necessidade de auditoria manual de claims em comparação', 'Detalhes de limites podem variar', 'Cobertura de recursos avançados depende de plano'],
    migrationNotes: 'Validar aderência por nicho e tipo de grupo antes de migração integral.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
  {
    slug: 'divulga-links',
    name: 'DivulgaLinks',
    positioning: 'Solução voltada para disseminação de links e automação de postagens em grupos.',
    bestFor: 'Times que precisam acelerar disseminação de links com rotina estruturada.',
    notIdealFor: 'Operações que exigem observabilidade granular e governança editorial profunda desde o início.',
    pricingTiers: [
      { name: 'Plano único/variável', price: 'Consultar fornecedor', notes: 'Preço e escopo devem ser confirmados em proposta oficial.' },
    ],
    strengths: ['Foco em links e distribuição', 'Adoção relativamente rápida', 'Aplicável a operações de afiliados'],
    weaknesses: ['Comparação de recursos premium requer validação constante', 'Política de suporte pode variar', 'Necessidade de revisão humana para qualidade final'],
    migrationNotes: 'Fazer migração progressiva por grupos prioritários com checklist de qualidade de link.',
    updatedAt: '2026-05-17',
    verifiedAt: '2026-05-17',
    source: 'Solicitação da usuária para comparação direta nesta sessão + revisão editorial interna.',
  },
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
    verifiedAt: '2026-05-17',
    source: 'Pesquisa editorial interna com critérios públicos de operação responsável.',
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
    verifiedAt: '2026-05-17',
    source: 'Pesquisa editorial interna com foco em manutenção técnica e governança.',
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
    verifiedAt: '2026-05-17',
    source: 'Pesquisa editorial interna orientada a fluxos de atendimento e conversas.',
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
  assertString(competitor?.source, 'source', competitorName)

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
