export const homeStats = {
  mirroredToday: 147,
  detectedToday: 183,
  mirroredRate: 80,
  alerts: 3,
}

export const recentMirrors = [
  { title: 'Sandália Bege Verão 2026', store: 'Shopee', from: 'Promoções Brasil 🔥', to: 'Achados da Sol 💜', when: 'agora', ok: true },
  { title: 'Air Fryer Mondial 4L', store: 'Mercado Livre', from: 'Cupons & Cashback BR', to: 'Sol · Tech & Casa', when: '12 min', ok: true },
  { title: 'Carregador USB-C 65W', store: 'AliExpress', from: 'Promoções Brasil 🔥', to: 'não enviado', when: '1h 18', ok: false },
]

export const sendItems = {
  fila: [
    { title: 'Fone Bluetooth JBL', store: 'Shopee', target: 'Achados da Sol', status: 'agendado', when: 'em 12 min' },
    { title: 'Vestido Floral Midi', store: 'Shopee', target: 'Canal Sol Achados', status: 'agendado', when: 'em 28 min' },
  ],
  enviados: [
    { title: 'Sandália Bege Verão', store: 'Shopee', target: 'Achados da Sol', status: 'ok', when: 'há 3 min' },
    { title: 'Kit Maquiagem Ruby Rose', store: 'Amazon', target: 'Canal Sol Achados', status: 'ok', when: 'há 1h' },
  ],
  falhas: [
    { title: 'Notebook Acer Aspire 5', store: 'Mercado Livre', target: 'Sol · Tech & Casa', status: 'falha', when: 'há 2h', error: 'ID de afiliada expirado' },
  ],
}

export const logItems = [
  { id: 1, time: '14:48', title: 'Sandália Bege Verão 2026', store: 'Shopee', flow: 'Promoções Brasil 🔥 → Achados da Sol 💜', status: 'ok' },
  { id: 2, time: '13:18', title: 'Carregador USB-C 65W', store: 'AliExpress', flow: 'Promoções Brasil 🔥 → não enviado', status: 'falha', error: 'AliExpress não conectada' },
  { id: 3, time: '12:14', title: 'Mouse Logitech M170', store: 'Magalu', flow: 'Promoções de TI → Sol · Tech & Casa', status: 'ok' },
]
