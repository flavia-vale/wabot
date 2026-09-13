export const TERMS_DOCUMENT_ID = 'terms_of_use'
export const DEFAULT_TERMS_VERSION = '2026-09-09-teste-unico-por-pessoa'
export const DEFAULT_TERMS_UPDATED_LABEL = '09 de setembro de 2026'

export const DEFAULT_TERMS_DOCUMENT = {
  id: TERMS_DOCUMENT_ID,
  title: 'Termos de Uso e Ciência de Riscos',
  summary: 'Leia com atenção antes de criar conta, conectar seu WhatsApp ou automatizar envios. Este documento explica responsabilidades, riscos de banimento e cuidados de uso responsável.',
  version: DEFAULT_TERMS_VERSION,
  updatedAt: null,
  content: {
    lastUpdatedLabel: DEFAULT_TERMS_UPDATED_LABEL,
    intro: 'Resumo importante: o Espelha Grupos pode ajudar a organizar e reduzir riscos operacionais, mas automação de mensagens em WhatsApp Web/grupos envolve risco real de bloqueio ou banimento. Ao usar, você confirma que entende esse risco e assume responsabilidade pela sua operação.',
    sections: [
      {
        title: '1. Aceite e escopo destes Termos',
        body: [
          'Ao criar uma conta, acessar o painel, conectar um número de WhatsApp, configurar grupos/canais, converter links, agendar mensagens ou utilizar qualquer recurso do Espelha Grupos, você declara que leu, compreendeu e aceitou estes Termos de Uso, a Política de Privacidade e a ciência expressa de riscos operacionais descrita neste documento.',
          'Se você estiver utilizando a ferramenta em nome de empresa, agência, equipe, loja, comunidade ou terceiro, você declara ter autorização para aceitar estes termos e responder pela operação configurada na conta.',
          'Estes termos podem ser atualizados para refletir mudanças do produto, exigências legais, regras de plataformas ou melhorias operacionais. A continuidade de uso após a atualização significa concordância com a versão vigente.',
        ],
      },
      {
        title: '2. O que é o Espelha Grupos',
        body: [
          'O Espelha Grupos é uma ferramenta operacional para afiliados, criadores de comunidades, lojistas e operadores de grupos que precisam organizar links, espelhar mensagens autorizadas, criar ofertas, gerenciar grupos de origem e destino, aplicar cadência de envio, acompanhar logs e reduzir trabalho manual.',
          'A ferramenta não garante faturamento, aprovação em programas de afiliados, alcance, entregabilidade, manutenção de grupos, permanência de números no WhatsApp, ausência de denúncias, ausência de bloqueios ou continuidade de qualquer plataforma de terceiros.',
        ],
      },
      {
        title: '3. Ciência expressa: automação no WhatsApp e ausência de API oficial',
        warning: true,
        body: [
          'Você reconhece que, como toda automação que envia mensagens para grupos/canais via WhatsApp Web ou mecanismos equivalentes de sessão, o Espelha Grupos não utiliza a API oficial do WhatsApp/Meta para esse tipo de envio em grupos. O uso depende de uma sessão conectada pelo usuário e pode ser interpretado pelas plataformas como automação não oficial.',
          'O WhatsApp, a Meta e outras plataformas podem alterar regras, limites, comportamento técnico, detecção de automação, políticas de uso, mecanismos de denúncia, qualidade de conta e critérios internos sem aviso prévio. Essas mudanças podem afetar total ou parcialmente a operação do Espelha Grupos e dos usuários.',
          'O Espelha Grupos não é afiliado, patrocinado, endossado ou operado pelo WhatsApp, Meta, Mercado Livre, Amazon, Shopee, Telegram ou qualquer plataforma de afiliados citada no produto, salvo quando houver declaração expressa em contrato específico.',
        ],
      },
      {
        title: '4. Riscos de bloqueio, limitação, banimento e perda operacional',
        warning: true,
        body: [
          'Você está ciente de que o uso de automação para envio de mensagens pode gerar bloqueios temporários, restrições de envio, pedidos de verificação, perda de sessão, desconexões, limitação de alcance, shadowban, banimento permanente do número de WhatsApp, banimento ou restrição de grupos/canais, remoção de administradores, perda de confiança dos participantes e impacto comercial.',
          'Esses riscos podem ocorrer por diversos fatores, incluindo volume excessivo de envios, repetição de texto, repetição de imagens, links suspeitos, encurtadores, denúncias de participantes, entrada recente do número em muitos grupos, número novo ou pouco aquecido, ausência de consentimento dos destinatários, conteúdo sensível, promessas enganosas, mudança de comportamento da conta, uso fora das regras do WhatsApp ou das plataformas de afiliados, entre outros.',
          'O usuário assume integralmente os riscos de usar a ferramenta em seus números, chips, contas, grupos, canais, comunidades, domínios, links, credenciais e programas de afiliados. O Espelha Grupos não se responsabiliza por banimentos, bloqueios, perda de grupos, perda de receita, perda de comissões, suspensão em marketplace, suspensão em programa de afiliados ou dano reputacional decorrente da operação do usuário.',
        ],
      },
      {
        title: '5. Cuidados recomendados para reduzir risco operacional',
        body: [
          'A ferramenta oferece ou pode oferecer recursos e boas práticas para reduzir risco operacional, como pausas entre envios, intervalos com jitter, pausa noturna, limitação de volume por janela, alternância de destinos, variações de texto, pools de cópias, alteração de pixels/metadados ou tratamento de imagem quando disponível, controle de grupos de origem e destino, logs, bloqueio por palavras-chave, deduplicação de links e configuração de cadência.',
          'Esses recursos são medidas de redução de risco, não garantias de segurança. Nenhuma configuração transforma automação não oficial em uso oficial, elimina risco de denúncia ou impede bloqueio por critérios internos do WhatsApp/Meta.',
          'É responsabilidade do usuário definir cadência prudente, revisar mensagens, evitar conteúdo repetitivo ou abusivo, usar números e grupos com histórico saudável, respeitar pausas, respeitar horários, monitorar reclamações, obter consentimento dos destinatários e interromper envios quando houver sinais de risco.',
        ],
      },
      {
        title: '6. Responsabilidades do usuário',
        body: [
          'Você é responsável por todo conteúdo enviado, links divulgados, imagens utilizadas, textos, promessas comerciais, preços, cupons, disponibilidade de produtos, dados de afiliado, credenciais, grupos escolhidos, destinatários, horários, frequência, permissões e conformidade com leis e regras de terceiros.',
          'Você deve usar a ferramenta somente com grupos/canais nos quais tenha autorização para postar ou gerenciar mensagens. Você não deve enviar spam, golpes, phishing, malware, conteúdo ilegal, conteúdo enganoso, conteúdo discriminatório, conteúdo sexual não permitido, conteúdo que viole direitos autorais ou marcas, mensagens sem base legal/consentimento, ou qualquer comunicação que desrespeite normas aplicáveis.',
          'Você deve manter senha, cookies, tokens, chaves, tags de afiliado e acessos protegidos. Qualquer pessoa com acesso à sua conta pode alterar configurações e disparar envios. Avise o suporte se suspeitar de acesso indevido.',
        ],
      },
      {
        title: '7. Plataformas de afiliados, marketplaces e links',
        body: [
          'O usuário é responsável por cumprir os termos de programas de afiliados, marketplaces, redes de anúncio, encurtadores, rastreadores, lojas e plataformas utilizadas. Isso inclui regras sobre divulgação de preço, disponibilidade, uso de marca, cookies, sessão, scraping, divulgação de comissão, conteúdo proibido e canais permitidos.',
          'Conversão de link, scraping de título/preço/imagem e montagem de oferta podem falhar, ficar desatualizados ou retornar dados incompletos por mudanças de layout, indisponibilidade de terceiros, bloqueios, páginas dinâmicas, cookies expirados ou limitações técnicas. O usuário deve revisar ofertas críticas antes de enviar.',
        ],
      },
      {
        title: '8. Disponibilidade, manutenção e limitações técnicas',
        body: [
          'O Espelha Grupos pode passar por manutenções, atualizações, indisponibilidades pontuais, filas, timeouts, falhas de provedores, falhas de WhatsApp Web, desconexões de sessão, instabilidade de VPS, banco, rede, APIs de terceiros ou mudanças técnicas externas.',
          'A ferramenta busca registrar logs e estados operacionais, mas não garante entrega, leitura, permanência da mensagem, preservação de mídia, sincronização perfeita, recuperação de todas as mensagens em trânsito ou ausência de duplicidades em cenários extremos.',
        ],
      },
      {
        title: '9. Pagamentos, planos e trial',
        body: [
          'Quando houver trial, o acesso gratuito é oferecido para teste operacional e pode ter duração, limites e recursos definidos no painel ou campanha vigente. Planos pagos liberam acesso conforme confirmação de pagamento e regras comerciais apresentadas no checkout.',
          'O teste gratuito é liberado uma vez por pessoa. Criar contas adicionais para renovar o período de teste, ainda que com outro e-mail, outro telefone ou outro nome, caracteriza tentativa de burlar limites e permite o encerramento dos acessos criados dessa forma, conforme a seção de suspensão de conta e uso proibido. Os dados e configurações da conta original permanecem preservados, e a contratação de um plano restabelece o funcionamento.',
          'Valores, recursos, limites, bônus e condições comerciais podem mudar. Eventuais reembolsos, cancelamentos ou ajustes serão tratados conforme legislação aplicável, regras do meio de pagamento e comunicação comercial do produto.',
        ],
      },
      {
        title: '10. Dados, privacidade e segurança',
        body: [
          'Tratamos dados de conta, contato, configurações, logs operacionais e credenciais necessárias para funcionamento conforme a Política de Privacidade. Algumas credenciais podem ser armazenadas de forma cifrada quando tecnicamente suportado pela camada de aplicação.',
          'Apesar de adotarmos medidas de segurança proporcionais ao produto, nenhum sistema é imune a falhas. O usuário deve limitar acessos, usar senha forte, manter dispositivos seguros e evitar compartilhar credenciais fora de canais confiáveis.',
        ],
      },
      {
        title: '11. Suporte e comunicação',
        body: [
          'O suporte é prestado pelos canais oficiais informados no site ou painel. O Espelha Grupos pode usar o telefone/WhatsApp e email informados no cadastro para suporte, avisos operacionais, onboarding, recuperação de configuração, alertas de risco ou comunicações relacionadas à conta.',
          'O suporte pode orientar boas práticas, mas não assume a operação do usuário nem garante resultado. Decisões de envio, conteúdo, volume, grupo e estratégia continuam sob responsabilidade do usuário.',
        ],
      },
      {
        title: '12. Suspensão de conta e uso proibido',
        body: [
          'Podemos suspender, limitar ou encerrar contas que violem estes termos, coloquem a infraestrutura em risco, tentem burlar limites, pratiquem abuso, prejudiquem terceiros, violem leis, realizem spam, publiquem conteúdo proibido ou usem a ferramenta de forma que gere risco relevante ao produto, à operação de outros usuários ou a terceiros.',
          'Também podemos interromper recursos específicos quando houver indício de falha técnica, uso malicioso, risco jurídico, ordem de autoridade competente ou necessidade de proteção da infraestrutura.',
        ],
      },
      {
        title: '13. Limitação de responsabilidade',
        warning: true,
        body: [
          'Na máxima extensão permitida pela lei, o Espelha Grupos não será responsável por lucros cessantes, perda de receita, perda de comissões, bloqueio ou banimento de contas/números/grupos/canais, perda de dados causada por terceiros, indisponibilidade de plataformas externas, mudanças de regras de terceiros, denúncias de participantes, falhas de marketplaces, uso indevido pelo usuário ou decisões comerciais tomadas com base na ferramenta.',
          'A ferramenta é fornecida como apoio operacional. O usuário deve avaliar riscos, testar em baixa escala, validar em ambiente controlado e manter backups/planos de contingência para sua operação.',
        ],
      },
      {
        title: '14. Boas práticas mínimas esperadas',
        body: [
          'Antes de escalar, teste com poucos grupos, revise logs, ajuste pausas, evite envios repetitivos, use textos variados, evite promessas absolutas, confira links, respeite horários, monitore respostas negativas e mantenha um número dedicado para operação.',
          'Não conecte números pessoais críticos sem aceitar o risco. Não use grupos sem permissão. Não tente compensar baixa conversão com volume agressivo. Se houver desconexões, denúncias, bloqueios, limitações ou queda brusca de entrega, reduza ou interrompa a operação e revise a configuração.',
        ],
      },
    ],
    finalDeclaration: 'Ao marcar o aceite no cadastro, você declara: (1) li estes Termos; (2) sei que o envio automatizado em grupos não usa API oficial do WhatsApp/Meta; (3) entendo que número e grupos podem sofrer bloqueios, limitações ou banimento; (4) aceito que pausas, pausa noturna, alterações de imagem, variações de texto e cadência reduzem risco, mas não eliminam risco; e (5) assumo responsabilidade pelo uso, conteúdo, consentimento, volume e consequências da operação.',
  },
}

function limitText(value, max = 10000) {
  return String(value ?? '').trim().slice(0, max)
}

export function normalizeTermsContent(rawContent = {}) {
  const source = rawContent && typeof rawContent === 'object' ? rawContent : {}
  const fallback = DEFAULT_TERMS_DOCUMENT.content
  const rawSections = Array.isArray(source.sections) ? source.sections : fallback.sections
  const sections = rawSections
    .slice(0, 40)
    .map((section, index) => {
      const title = limitText(section?.title || `Seção ${index + 1}`, 180)
      const rawBody = Array.isArray(section?.body) ? section.body : String(section?.body ?? '').split(/\n\s*\n/g)
      const body = rawBody.map((paragraph) => limitText(paragraph, 4000)).filter(Boolean).slice(0, 20)
      return { title, body: body.length ? body : ['Conteúdo a definir.'], warning: Boolean(section?.warning) }
    })
    .filter((section) => section.title && section.body.length)

  return {
    lastUpdatedLabel: limitText(source.lastUpdatedLabel || fallback.lastUpdatedLabel, 80),
    intro: limitText(source.intro || fallback.intro, 3000),
    sections: sections.length ? sections : fallback.sections,
    finalDeclaration: limitText(source.finalDeclaration || fallback.finalDeclaration, 5000),
  }
}

export function serializeTermsDocument(row = null) {
  if (!row) return DEFAULT_TERMS_DOCUMENT
  let content = DEFAULT_TERMS_DOCUMENT.content
  try {
    content = JSON.parse(String(row.contentJson ?? '{}'))
  } catch {}
  return {
    id: row.id || TERMS_DOCUMENT_ID,
    title: limitText(row.title || DEFAULT_TERMS_DOCUMENT.title, 180),
    summary: limitText(row.summary || DEFAULT_TERMS_DOCUMENT.summary, 1000),
    version: limitText(row.version || DEFAULT_TERMS_VERSION, 120),
    updatedAt: row.updatedAt ?? null,
    content: normalizeTermsContent(content),
  }
}

function isKnownLegalDocumentSchemaError(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') ||
    message.includes('Unknown field') ||
    message.includes('no such column') ||
    message.includes('no such table') ||
    message.includes('does not exist in the current database') ||
    String(err?.code ?? '') === 'P2021' ||
    String(err?.code ?? '') === 'P2022'
}

export async function getEffectiveTermsDocument(db) {
  try {
    if (!db?.legalDocument || typeof db.legalDocument.findUnique !== 'function') return DEFAULT_TERMS_DOCUMENT
    const row = await db.legalDocument.findUnique({ where: { id: TERMS_DOCUMENT_ID } })
    return serializeTermsDocument(row)
  } catch (err) {
    if (isKnownLegalDocumentSchemaError(err)) return DEFAULT_TERMS_DOCUMENT
    throw err
  }
}

export async function getEffectiveTermsVersion(db) {
  const terms = await getEffectiveTermsDocument(db)
  return terms.version || DEFAULT_TERMS_VERSION
}

export function nextTermsVersion(now = new Date()) {
  return `terms-${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
}
