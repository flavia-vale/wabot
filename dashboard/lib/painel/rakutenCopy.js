// Tudo o que a cliente LÊ na seção Rakuten de "Minhas credenciais" mora aqui,
// para o teste de linguagem leiga (test/rakuten-linguagem.test.js) cobrir
// cada frase. Espelho de awinCopy.js. Os três campos usam os nomes que a
// própria Rakuten mostra (SID, Client ID, Client Secret), para a cliente achar
// o que colar; o resto do texto fica sem jargão.

import { relativeWhen } from './awinCopy.js'

export { relativeWhen }

export const RAKUTEN_PAGE_URL = 'https://developers.rakutenadvertising.com/'

export const RAKUTEN_COPY = Object.freeze({
  title: 'Rakuten',
  subtitleEmpty: 'Promoções e cupons de lojas como Netshoes, direto nas suas ofertas automáticas',
  lede: 'Conecte sua conta da Rakuten para o robô trazer as promoções e os cupons das lojas em que você é afiliada. Você pode cadastrar mais de uma conta.',
  steps: [
    'Entre na Rakuten. O SID aparece no canto de cima, logo abaixo do seu nome.',
    'Abra o portal de desenvolvedores da Rakuten no botão abaixo e clique em LOGIN, no canto de cima.',
    'Na lista, copie o Client ID e o Client Secret do seu aplicativo.',
  ],
  openRakuten: 'Abrir o portal da Rakuten',
  storesHint: 'Só aparecem promoções das lojas em que você já foi aprovada. Não achou uma loja? Ela só aparece depois que você se inscreve no programa dela na Rakuten e é aprovada.',
  labelField: 'Apelido (opcional)',
  labelHint: 'Ex.: Minha Rakuten. Se deixar em branco, usamos o SID.',
  sidField: 'SID',
  sidHint: 'Só os números. Ex.: 4640819',
  clientIdField: 'Client ID',
  clientSecretField: 'Client Secret',
  secretHintNew: 'Cole o valor inteiro que a Rakuten mostrou.',
  secretHintEdit: (masked) => `Deixe em branco para manter o atual (${masked}).`,
  show: 'Mostrar',
  hide: 'Ocultar',
  add: '+ Conectar uma conta Rakuten',
  save: 'Salvar',
  saving: 'Salvando…',
  cancel: 'Cancelar',
  edit: 'Editar',
  remove: 'Apagar',
  removing: 'Apagando…',
  confirmRemove: (label) => `Apagar a conta Rakuten "${label}"?\n\nAs promoções dela saem daqui e as ofertas automáticas que usavam essa conta ficam pausadas.`,
  test: 'Testar conexão',
  testing: 'Testando…',
  sync: 'Atualizar agora',
  syncing: 'Atualizando…',
  history: 'Ver histórico',
  hideHistory: 'Ocultar histórico',
  historyEmpty: 'Ainda não atualizamos essa conta.',
  accountNumber: (sid) => `SID ${sid}`,
  secretLabel: (masked) => `Client Secret: ${masked}`,
  activePromotions: (n) => (n === 1 ? '1 promoção ativa' : `${n} promoções ativas`),
  lastSync: (when) => `Última atualização ${when}`,
  neverSynced: 'Ainda não atualizada',
  autoSync: 'Atualiza sozinha a cada hora.',
  savedOk: 'Conta conectada. As promoções chegam em alguns minutos.',
  savedWarn: 'Conta salva, mas não conseguimos falar com a Rakuten agora. Tentamos de novo sozinhos.',
  syncDone: (r) => `Pronto: ${r.inserted} novas, ${r.updated} conferidas${r.expired ? `, ${r.expired} vencidas` : ''}.`,
  loadError: 'Não conseguimos carregar suas contas da Rakuten.',
})

// Por que o "Enviar agora" de uma automação de promoções Rakuten não enviou.
// Nunca o texto da Shopee (mesma lição da Awin, RCA 2026-09-29).
export const RAKUTEN_SKIP_LABELS = Object.freeze({
  all_offers_filtered: 'Todas as promoções que ainda valem já foram enviadas por esta automação. Promoções novas chegam da Rakuten a cada hora e saem sozinhas.',
  no_rakuten_promotions: 'Ainda não chegou nenhuma promoção ativa dessa conta Rakuten. Em Minhas credenciais, use "Atualizar agora".',
  no_rakuten_account: 'Escolha uma conta Rakuten para esta automação (as contas ficam em Minhas credenciais).',
})

export const RAKUTEN_STATUS = Object.freeze({
  pending: { label: 'Aguardando a primeira atualização', tone: 'info', tag: 'info' },
  ok: { label: 'Conectada', tone: 'success', tag: 'success' },
  invalid_credential: { label: 'A Rakuten recusou os dados', tone: 'error', tag: 'error' },
  error: { label: 'Com problema', tone: 'warn', tag: 'flight' },
})

export const RAKUTEN_RUN_STATUS = Object.freeze({
  running: 'Atualizando…',
  success: 'Atualizada',
  partial: 'Atualizada em parte',
  failed: 'Não deu certo',
  invalid_credential: 'Dados recusados pela Rakuten',
  rate_limited: 'A Rakuten pediu uma pausa',
})

export function rakutenStatusOf(account) {
  return RAKUTEN_STATUS[account?.status] ?? RAKUTEN_STATUS.error
}
