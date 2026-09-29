// Tudo o que a cliente LÊ na seção Awin de "Minhas credenciais" mora aqui,
// para o teste de linguagem leiga (test/awin-linguagem.test.js) cobrir cada
// frase. Vocabulário: "código de acesso" (nunca "token"/"API"), "número da
// conta" (nunca "Publisher ID"), "venceu"/"recusou" (nunca "401").

export const AWIN_PAGE_URL = 'https://ui.awin.com/awin-api'

export const AWIN_COPY = Object.freeze({
  title: 'Awin',
  subtitleEmpty: 'Promoções de lojas como Kabum, direto nas suas ofertas automáticas',
  lede: 'Conecte sua conta da Awin para o robô trazer as promoções das lojas em que você é afiliada. Você pode cadastrar mais de uma conta.',
  steps: [
    'Abra a Awin no botão abaixo e digite a sua senha da Awin.',
    'Clique no botão que mostra o seu código de acesso e copie o código inteiro.',
    'O número da sua conta aparece no canto de cima da Awin, ao lado do nome da conta.',
  ],
  openAwin: 'Abrir a Awin',
  storesHint: 'Só aparecem promoções das lojas em que você já foi aprovada. Não achou uma loja? Ela só aparece depois que você se inscreve no programa dela na Awin e é aprovada.',
  labelField: 'Apelido (opcional)',
  labelHint: 'Ex.: Minha Awin. Se deixar em branco, usamos o nome da conta.',
  publisherField: 'ID/Número da conta AWIN',
  publisherHint: 'Só os números. Ex.: 2701264',
  codeField: 'OAuth2 Token',
  codeHintNew: 'Cole o código inteiro que a Awin mostrou.',
  codeHintEdit: (masked) => `Deixe em branco para manter o código atual (${masked}).`,
  show: 'Mostrar',
  hide: 'Ocultar',
  add: '+ Conectar uma conta Awin',
  save: 'Salvar',
  saving: 'Salvando…',
  cancel: 'Cancelar',
  edit: 'Editar',
  remove: 'Apagar',
  removing: 'Apagando…',
  confirmRemove: (label) => `Apagar a conta Awin "${label}"?\n\nAs promoções dela saem daqui e as ofertas automáticas que usavam essa conta ficam pausadas.`,
  test: 'Testar conexão',
  testing: 'Testando…',
  sync: 'Atualizar agora',
  syncing: 'Atualizando…',
  history: 'Ver histórico',
  hideHistory: 'Ocultar histórico',
  historyEmpty: 'Ainda não atualizamos essa conta.',
  accountNumber: (id) => `Conta nº ${id}`,
  codeLabel: (masked) => `Código: ${masked}`,
  activePromotions: (n) => (n === 1 ? '1 promoção ativa' : `${n} promoções ativas`),
  lastSync: (when) => `Última atualização ${when}`,
  neverSynced: 'Ainda não atualizada',
  autoSync: 'Atualiza sozinha a cada hora.',
  savedOk: 'Conta conectada. As promoções chegam em alguns minutos.',
  savedWarn: 'Conta salva, mas não conseguimos falar com a Awin agora. Tentamos de novo sozinhos.',
  syncDone: (r) => `Pronto: ${r.inserted} novas, ${r.updated} conferidas${r.expired ? `, ${r.expired} vencidas` : ''}.`,
  loadError: 'Não conseguimos carregar suas contas da Awin.',
})

// Por que o "Enviar agora" de uma automação de promoções Awin não enviou.
// Nunca usar o texto da Shopee aqui (RCA 2026-09-29: a tela dizia "A Shopee
// trouxe produtos… reduza o desconto mínimo" numa automação Awin que só tinha
// esgotado as promoções — e Awin nem tem desconto mínimo).
export const AWIN_SKIP_LABELS = Object.freeze({
  all_offers_filtered: 'Todas as promoções que ainda valem já foram enviadas por esta automação. Promoções novas chegam da Awin a cada hora e saem sozinhas.',
  no_awin_promotions: 'Ainda não chegou nenhuma promoção ativa dessa conta Awin. Em Minhas credenciais, use "Atualizar agora".',
  no_awin_account: 'Escolha uma conta Awin para esta automação (as contas ficam em Minhas credenciais).',
})

export const AWIN_STATUS = Object.freeze({
  pending: { label: 'Aguardando a primeira atualização', tone: 'info', tag: 'info' },
  ok: { label: 'Conectada', tone: 'success', tag: 'success' },
  invalid_credential: { label: 'O código de acesso venceu', tone: 'error', tag: 'error' },
  error: { label: 'Com problema', tone: 'warn', tag: 'flight' },
})

export const AWIN_RUN_STATUS = Object.freeze({
  running: 'Atualizando…',
  success: 'Atualizada',
  partial: 'Atualizada em parte',
  failed: 'Não deu certo',
  invalid_credential: 'Código recusado pela Awin',
  rate_limited: 'A Awin pediu uma pausa',
})

export function awinStatusOf(account) {
  return AWIN_STATUS[account?.status] ?? AWIN_STATUS.error
}

export function relativeWhen(value, now = Date.now()) {
  if (!value) return ''
  const diff = Math.round((now - new Date(value).getTime()) / 60_000)
  if (!Number.isFinite(diff)) return ''
  if (diff < 1) return 'agora mesmo'
  if (diff < 60) return `há ${diff} min`
  const h = Math.round(diff / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}
