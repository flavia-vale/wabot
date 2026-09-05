// Texto do "?" de cada card do painel admin.
//
// Um lugar só, para que a mesma pergunta não ganhe duas respostas diferentes
// em telas diferentes. Três campos por card, sempre na mesma ordem:
// o que é → o que acontece se ficar assim → como resolver.
//
// Linguagem leiga obrigatória: nada de "DLQ", "worker", "socket" ou "sessão
// Baileys" no texto que a pessoa lê.

export const CARD_HELP = {
  paradasSemNinguem: {
    title: 'Paradas sem ninguém tentando',
    oQueE: 'Contas cujo WhatsApp caiu e não há nenhum robô no ar tentando levantar. É diferente de "o robô está tentando": aqui ninguém está.',
    impacto: 'Enquanto estiver assim, nenhuma oferta dessa cliente sai. Ela costuma descobrir sozinha, horas depois, e abrir chamado.',
    comoResolver: 'Clique no card, abra a lista e use "Tentar reconectar". Na maioria dos casos um clique resolve sem incomodar a cliente.',
  },
  semReceber: {
    title: 'Sem receber',
    oQueE: 'O WhatsApp está conectado (painel verde) mas nenhuma mensagem dos grupos de origem está chegando ao robô.',
    impacto: 'É o pior caso para a cliente: parece que está tudo certo e nada é publicado. Ela conclui que o produto não funciona.',
    comoResolver: 'Abra a lista e confira se o robô se recuperou sozinho. Se persistir por mais de meia hora, refaça a conexão dela.',
  },
  caindoDemais: {
    title: 'Caindo demais',
    oQueE: 'Contas que desconectaram muitas vezes nas últimas 24 horas, mesmo voltando sozinhas.',
    impacto: 'Cada queda interrompe envios e o celular dela enche de aviso de sincronização. Repetição também aumenta o risco de o WhatsApp restringir o número.',
    comoResolver: 'Abra a lista e veja o motivo de cada queda. Se for sempre a mesma conta, o histórico dela mostra se é grupo problemático ou o número.',
  },
  clienteAgiu: {
    title: 'Cliente teve que agir',
    oQueE: 'Contas em que a própria cliente precisou clicar em conectar para o robô voltar.',
    impacto: 'É a promessa do produto quebrada: ela pagou para não precisar cuidar disso. Cada caso aqui é um motivo de cancelamento.',
    comoResolver: 'Abra a lista e veja quanto tempo ficou parado antes de ela agir. Vale ligar para essas clientes antes que elas reclamem.',
  },
  fonteQuebrada: {
    title: 'Fonte dessincronizada',
    oQueE: 'Um grupo de origem passou a mandar mensagens que o robô não consegue ler, e o conserto automático não deu jeito.',
    impacto: 'Esse grupo derruba a conexão dela de tempos em tempos e as ofertas dele não são espelhadas.',
    comoResolver: 'Abra a lista, veja o nome do grupo e converse com a cliente sobre sair dele. O sistema nunca sai de grupo sozinho.',
  },
  onlineAgora: {
    title: 'Online agora',
    oQueE: 'Quantas clientes estão com o WhatsApp conectado neste momento, e qual a estabilidade da frota.',
    impacto: 'Se esse número cair muito de uma vez, o problema costuma ser nosso (servidor ou WhatsApp), não das clientes.',
    comoResolver: 'Clique para ver quem está no ar. Queda geral pede olhar a aba de observabilidade antes de falar com cliente.',
  },
  erros24h: {
    title: 'Erros nas últimas 24h',
    oQueE: 'Ofertas que o robô tentou publicar e não conseguiu no último dia, somando todas as clientes.',
    impacto: 'Cada erro é uma oferta que não chegou ao grupo. Concentrado em poucas contas, costuma ser loja sem cadastro ou código de acesso vencido.',
    comoResolver: 'Clique para ver quais clientes concentram os erros e abra o histórico delas para o motivo exato.',
  },
  dbApi: {
    title: 'Banco e site',
    oQueE: 'Se o banco de dados responde e quantas falhas o site devolveu para quem navegou.',
    impacto: 'Banco fora do ar derruba tudo: painel, login e envios. Falhas de site aparecem para a cliente como página de erro.',
    comoResolver: 'Clique para ver as falhas recentes. Se aparecer "Revisar", é caso técnico — não adianta falar com cliente.',
  },
  ofertasComFoto: {
    title: 'Ofertas com foto (48h)',
    oQueE: 'De cada 100 ofertas publicadas nos últimos dois dias, quantas chegaram ao grupo com imagem em vez de só texto.',
    impacto: 'Oferta sem foto quase não é clicada. Quando esse número cai, a cliente percebe antes de nós e abre chamado dizendo que o robô parou de funcionar direito.',
    comoResolver: 'Veja logo abaixo de que jeito as ofertas saíram e o resultado por loja: loja que parou de entregar a foto aparece isolada ali.',
  },
  filasDlq: {
    title: 'Trabalhos parados',
    oQueE: 'Envios e avisos de pagamento que o sistema tentou processar, não conseguiu, e deixou de lado esperando decisão.',
    impacto: 'Envio parado é oferta que nunca chegou ao grupo. Aviso de pagamento parado é cliente que pagou e pode não ter recebido o acesso.',
    comoResolver: 'Clique para ver o que está parado. Aviso de pagamento tem prioridade: confira se a cliente está com o acesso liberado.',
  },
}

export default CARD_HELP
