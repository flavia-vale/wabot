export const STABLE_ERROR_CODES = ['INVALID_PERIOD', 'SHOPEE_NOT_CONFIGURED', 'SHOPEE_CREDENTIAL_REJECTED', 'SHOPEE_UNAVAILABLE', 'SHOPEE_REPORT_INCOMPLETE']
export function createSalesState(period) { return { period, draft: period, pages: { orderPage: 1, productPage: 1 }, snapshot: null, loading: true, error: null, retry: 0, activeRequest: 0 } }
export function salesReducer(state, action) {
  switch (action.type) {
    case 'request-start': return { ...state, loading: true, error: null, activeRequest: action.request }
    case 'request-success': return action.request === state.activeRequest ? { ...state, snapshot: action.snapshot, loading: false, error: null } : state
    case 'request-error': return action.request === state.activeRequest && !action.aborted ? { ...state, loading: false, error: action.error } : state
    case 'request-finish': return action.request === state.activeRequest ? { ...state, loading: false } : state
    case 'draft': return { ...state, draft: { ...state.draft, [action.field]: action.value } }
    case 'period': return { ...state, period: action.period, draft: action.period, pages: { orderPage: 1, productPage: 1 }, error: null }
    case 'page': return { ...state, pages: { ...state.pages, [action.name]: action.value } }
    case 'validation-error': return { ...state, error: { code: 'INVALID_PERIOD', message: action.message, retryable: false } }
    case 'retry': return { ...state, retry: state.retry + 1 }
    default: return state
  }
}
export function validateCustomPeriod(draft, today) {
  const valid = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [y,m,d] = value.split('-').map(Number); const parsed = new Date(Date.UTC(y,m-1,d)); return parsed.getUTCFullYear()===y&&parsed.getUTCMonth()===m-1&&parsed.getUTCDate()===d }
  const days = (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 + 1
  return valid(draft.from) && valid(draft.to) && draft.to <= today && days >= 1 && days <= 30
}
export function errorGuidance(code) {
  if (code === 'INVALID_PERIOD') return 'Revise as datas: use dias existentes, não escolha datas futuras e limite o período a 30 dias.'
  if (code === 'SHOPEE_NOT_CONFIGURED') return 'Cadastre sua Shopee em Minhas credenciais para acompanhar as vendas.'
  if (code === 'SHOPEE_CREDENTIAL_REJECTED') return 'A Shopee recusou sua credencial. Confira o App ID e a chave em Minhas credenciais.'
  if (code === 'SHOPEE_REPORT_INCOMPLETE') return 'A Shopee não entregou o relatório completo. Seus números anteriores foram preservados.'
  return 'Não foi possível atualizar os dados da Shopee agora.'
}
