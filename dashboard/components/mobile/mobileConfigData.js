export const whatsappStatus = {
  phone: '+55 11 9 8765-4321',
  activeDays: 47,
  postsToday: 127,
  postLimit: 250,
  sleepMode: true,
}

export const groupBuckets = {
  origem: [
    { name: 'Promoções Brasil 🔥', members: '1.842 membros', activity: '124 hoje', enabled: true },
    { name: 'Cupons & Cashback BR', members: '2.340 membros', activity: '87 hoje', enabled: true },
    { name: 'Achadinhos Mães', members: '412 membros', activity: 'pausado', enabled: false },
  ],
  destino: [
    { name: 'Achados da Sol 💜', members: '247 membros', activity: '89 posts hoje', enabled: true },
    { name: 'Canal Sol Achados', members: '2.4k inscritos', activity: '72 posts hoje', enabled: true },
  ],
}

export const credentialItems = [
  { store: 'Shopee', id: 'sol_almeida_aff', enabled: true },
  { store: 'Mercado Livre', id: 'MLB-12903847', enabled: true },
  { store: 'Amazon', id: 'solalmeida-20', enabled: true },
  { store: 'AliExpress', id: '', enabled: false },
]

export const preferenceItems = [
  { label: 'Nova venda confirmada', sub: 'WhatsApp privado', enabled: true },
  { label: 'Resumo diário às 22h', sub: 'Top do dia e comissões', enabled: true },
  { label: 'Bot desconectado', sub: 'Alerta urgente', enabled: true },
  { label: 'Limite de posts próximo', sub: 'Aviso aos 90%', enabled: false },
]

export const tutorialSteps = [
  { id: '01', title: 'Conectar seu WhatsApp', meta: '2 min · vídeo', done: true },
  { id: '02', title: 'Adicionar grupos para monitorar', meta: '1 min · vídeo', done: true },
  { id: '03', title: 'Cadastrar IDs de afiliada', meta: '3 min · texto', done: true },
  { id: '04', title: 'Criar sua primeira regra', meta: '4 min · vídeo', done: false, current: true },
]
