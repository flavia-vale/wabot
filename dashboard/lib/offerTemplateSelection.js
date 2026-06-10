// Seleção de template da página "Criar oferta" (/painel/criar-oferta).
// A lista vem do mesmo store das ofertas automáticas (mobileTemplateStore);
// aqui só resolvemos qual template está ativo, com fallback gracioso quando a
// chave salva apontava para um template customizado que foi deletado.

export const CRIAR_OFERTA_TEMPLATE_STORAGE_KEY = 'wabot.criarOferta.templateKey.v1'
export const CRIAR_OFERTA_DEFAULT_TEMPLATE_KEY = 'automatico_classico'

export function resolveSelectedTemplate(templates, savedKey, defaultKey = CRIAR_OFERTA_DEFAULT_TEMPLATE_KEY) {
  const list = Array.isArray(templates) ? templates.filter((t) => t && t.key) : []
  if (!list.length) return null
  return (
    (savedKey ? list.find((t) => t.key === savedKey) : null)
    || list.find((t) => t.key === defaultKey)
    || list[0]
  )
}

export function readSavedTemplateKey() {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(CRIAR_OFERTA_TEMPLATE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function saveTemplateKey(key) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CRIAR_OFERTA_TEMPLATE_STORAGE_KEY, String(key || ''))
  } catch {}
}
