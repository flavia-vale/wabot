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

export function buildOfferPriceBlocks({ oldPrice, newPrice, formatPrice }) {
  const oldValue = String(oldPrice || '').trim()
  const newValue = String(newPrice || '').trim()
  const fmt = typeof formatPrice === 'function' ? formatPrice : (v) => String(v || '').trim()

  if (oldValue && newValue) {
    return {
      oldPriceBlock: `\n\nDe ${fmt(oldValue)}`,
      newPriceBlock: `\n💥 Por ${fmt(newValue)}`,
    }
  }

  const single = newValue || oldValue
  if (single) {
    return {
      oldPriceBlock: '',
      newPriceBlock: `\n💥 Por ${fmt(single)}`,
    }
  }

  return { oldPriceBlock: '', newPriceBlock: '' }
}
