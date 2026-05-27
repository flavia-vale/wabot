export const OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT = false

export function toggleTemplateVisibility(current) {
  return !Boolean(current)
}

export function getConversionStatusPresentation(status) {
  if (!status?.attempted) return null
  if (status?.success) {
    return {
      tone: 'success',
      title: '✅ Link convertido com sucesso.',
      hint: 'A oferta foi gerada com seu link de afiliado.',
    }
  }

  const hintsByReasonCode = {
    MISSING_CREDENTIALS: 'Revise as credenciais da loja em Configurações > Credenciais.',
    UNSUPPORTED_PLATFORM: 'Essa loja ainda não possui conversão automática; revise o link antes de enviar.',
    CONVERSION_TIMEOUT: 'A conversão demorou além do esperado. Você pode seguir com o link original agora.',
  }
  const hint = hintsByReasonCode[status?.reasonCode] || status?.reasonMessage || 'Confira o link antes de enviar.'
  return {
    tone: 'danger',
    title: '❌ Link não convertido. A oferta foi gerada com o link original enviado.',
    hint,
  }
}
