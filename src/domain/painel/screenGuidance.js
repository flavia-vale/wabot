const GUIDANCE = {
  '/painel': ['Veja o resumo da sua operação e resolva primeiro qualquer aviso no topo.', 'Próximo passo: confira se o robô está conectado e se houve envios hoje.'],
  '/painel/whatsapp': ['Conecte o número que vai operar o robô e acompanhe o estado real da sessão.', 'Próximo passo: quando aparecer “conectado”, cadastre sua primeira loja.'],
  '/painel/ids-afiliada': ['Cadastre os identificadores das lojas para os links saírem com a sua comissão.', 'Próximo passo: salve uma loja e teste um link antes de adicionar as demais.'],
  '/painel/espelhamento': ['Escolha de onde a oferta vem e em quais grupos ou canais ela será publicada.', 'Próximo passo: abra uma origem e confirme pelo menos um destino.'],
  '/painel/criar-oferta': ['Cole um link de produto para montar e revisar uma oferta antes do envio.', 'Próximo passo: confira foto, preço, texto e destinos antes de publicar.'],
  '/painel/envios': ['Acompanhe o que já saiu e tudo que ainda está aguardando envio.', 'Próximo passo: abra “Próximos envios” para revisar ou cancelar um item pendente.'],
  '/painel/mensagens': ['Defina o formato que o robô usa para montar suas mensagens.', 'Próximo passo: escolha um modelo e confira a prévia antes de salvar.'],
  '/painel/vendas': ['Veja vendas e comissões informadas pela Shopee, sem promessa de ganho.', 'Próximo passo: ajuste o período e confira a cobertura de atribuição.'],
  '/painel/plano': ['Confira o plano atual, a validade do acesso e os recursos incluídos.', 'Próximo passo: escolha a forma de pagamento adequada à sua operação.'],
}

const DEFAULT_GUIDANCE = [
  'Use esta tela para configurar e acompanhar esta parte da sua operação.',
  'Próximo passo: revise os campos antes de salvar e confira o resultado em Envios.',
]

export function guidanceForPath(pathname = '') {
  const exact = GUIDANCE[pathname]
  if (exact) return { description: exact[0], nextStep: exact[1] }
  const prefix = Object.keys(GUIDANCE)
    .filter((path) => path !== '/painel' && pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]
  const value = prefix ? GUIDANCE[prefix] : DEFAULT_GUIDANCE
  return { description: value[0], nextStep: value[1] }
}

export function robotDiagnostic({ online = null, hasAnyCredential = null, destinationCount = null } = {}) {
  if (online === null) {
    return { step: 1, state: 'checking', title: 'Conferindo seu robô…', body: 'Estamos lendo o estado da conexão sem interromper seus envios.', eta: 'leva alguns segundos', href: '/painel/whatsapp', action: 'Ver conexão' }
  }
  if (!online) {
    return { step: 1, state: 'action', title: 'Seu robô ainda não está conectado', body: 'Conecte o WhatsApp para liberar os próximos passos.', eta: 'cerca de 2 minutos', href: '/painel/whatsapp', action: 'Conectar WhatsApp' }
  }
  if (hasAnyCredential === null) {
    return { step: 2, state: 'checking', title: 'WhatsApp conectado', body: 'Estamos conferindo se uma loja já está cadastrada.', eta: 'leva alguns segundos', href: '/painel/ids-afiliada', action: 'Ver lojas' }
  }
  if (!hasAnyCredential) {
    return { step: 2, state: 'action', title: 'WhatsApp conectado — falta cadastrar uma loja', body: 'Sem uma loja, o robô não consegue trocar o link pelo seu link de afiliada.', eta: 'cerca de 3 minutos', href: '/painel/ids-afiliada', action: 'Cadastrar loja' }
  }
  if (!Number.isInteger(destinationCount)) {
    return { step: 3, state: 'checking', title: 'Conexão e loja prontas', body: 'Estamos conferindo se existe um destino para as ofertas.', eta: 'leva alguns segundos', href: '/painel/espelhamento', action: 'Ver destinos' }
  }
  if (destinationCount === 0) {
    return { step: 3, state: 'action', title: 'Falta escolher onde publicar', body: 'Adicione pelo menos um grupo ou canal de destino para concluir a configuração.', eta: 'cerca de 2 minutos', href: '/painel/espelhamento', action: 'Adicionar destino' }
  }
  return { step: 3, state: 'ready', title: 'Seu robô está pronto para funcionar', body: 'WhatsApp conectado, loja cadastrada e destino escolhido.', eta: '3 de 3 concluídos', href: null, action: null }
}

// O card só existe para apontar uma pendência. Pronto (3/3) ou ainda
// carregando não aparece: carregando evitaria um "pisca" em quem já está
// pronta. Fechar vale para a pendência atual; se surgir outra (ex.: caiu o
// WhatsApp depois de fechar o aviso da loja), o card volta.
export function shouldShowRobotDiagnostic(diagnostic, dismissedStep = null) {
  if (!diagnostic || diagnostic.state !== 'action') return false
  return String(dismissedStep ?? '') !== String(diagnostic.step)
}
