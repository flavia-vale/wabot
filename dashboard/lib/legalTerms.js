const apiPortByDashboardPort = {
  '3000': '3001',
  '3006': '3004',
}

export const FALLBACK_TERMS = {
  title: 'Termos de Uso e Ciência de Riscos',
  summary: 'Leia com atenção antes de criar conta, conectar seu WhatsApp ou automatizar envios. Este documento explica responsabilidades, riscos de banimento e cuidados de uso responsável.',
  version: '2026-09-09-teste-unico-por-pessoa',
  content: {
    lastUpdatedLabel: '09 de setembro de 2026',
    intro: 'Resumo importante: o Espelha Grupos pode ajudar a organizar e reduzir riscos operacionais, mas automação de mensagens em WhatsApp Web/grupos envolve risco real de bloqueio ou banimento. Ao usar, você confirma que entende esse risco e assume responsabilidade pela sua operação.',
    sections: [
      {
        title: 'Ciência expressa: automação no WhatsApp e ausência de API oficial',
        warning: true,
        body: [
          'Você reconhece que, como toda automação que envia mensagens para grupos/canais via WhatsApp Web ou mecanismos equivalentes de sessão, o Espelha Grupos não utiliza a API oficial do WhatsApp/Meta para esse tipo de envio em grupos.',
          'O uso pode gerar bloqueios, limitações ou banimento do número conectado e dos grupos/canais. Pausas, pausa noturna, variações de texto e ajustes de imagem reduzem risco operacional, mas não eliminam risco nem substituem a responsabilidade do usuário.',
        ],
      },
    ],
    finalDeclaration: 'Ao marcar o aceite no cadastro, você declara que leu estes Termos, entende os riscos de automação não oficial no WhatsApp e assume responsabilidade pelo uso, conteúdo, consentimento, volume e consequências da operação.',
  },
}

export function resolveInternalApiBase(env = process.env) {
  const configured = String(env.INTERNAL_API_URL || '').trim()
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '')

  const dashboardPort = String(env.PORT || '').trim()
  const apiPort = String(apiPortByDashboardPort[dashboardPort] || env.API_PORT || '3001').trim()
  return `http://127.0.0.1:${apiPort}`
}

export async function getPublicTerms({
  env = process.env,
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const url = `${resolveInternalApiBase(env)}/api/public/legal/terms`

  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      logger.error(`[terms] API respondeu ${response.status} ao carregar ${url}; usando fallback.`)
      return FALLBACK_TERMS
    }

    const data = await response.json()
    if (!data?.terms || typeof data.terms !== 'object') {
      logger.error(`[terms] API retornou payload inválido ao carregar ${url}; usando fallback.`)
      return FALLBACK_TERMS
    }

    return data.terms
  } catch (err) {
    logger.error(`[terms] Falha ao carregar ${url}; usando fallback:`, err)
    return FALLBACK_TERMS
  }
}
