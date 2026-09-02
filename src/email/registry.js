// Catálogo dos e-mails do BOTinho: o TEXTO PADRÃO de cada um mora aqui, no
// código. O painel admin só grava OVERRIDE (tabela EmailTemplate) — sem linha
// lá, vale o que está aqui. Assim o sistema nunca fica sem texto, e um erro de
// edição no painel se conserta apagando o override.
//
// Puro: sem banco, sem rede. O corpo usa o formato descrito em markup.js.
//
// `category` decide a regra de consentimento:
//   transactional — obrigação de serviço (cobrança, vencimento, segurança).
//                   Sempre envia, sem descadastro no rodapé.
//   marketing     — divulgação. Respeita descadastro e leva o link no rodapé.
//
// `trigger` diz quem dispara: 'auto' (gatilho no sistema) ou 'manual' (você,
// pela aba E-mails do admin). Manual também pode ser usado em qualquer 'auto'.
//
// REDAÇÃO (regra canônica do AGENTS.md, com teste que falha se regredir):
// linguagem de gente. "código de acesso" (nunca cookie/SSID), "etiqueta de
// afiliada" (nunca tag), "link mais comprido". E nunca dizer que o envio parou
// quando ele não parou.

import { VIDEO_ETIQUETAS_CAPITULOS, videoEtiquetasEm } from './layout.js'
// Mesmas garantias exibidas na tela de conexão do painel — texto único, para a
// cliente ler a MESMA frase no e-mail e na tela (regra de linguagem do projeto).
import { whatsappSafetyEmailBlock } from '../domain/painel/whatsappSafety.js'

export const EMAIL_CATEGORIES = Object.freeze(['transactional', 'marketing'])

export const EMAIL_GROUPS = Object.freeze({
  conta: 'Conta e teste grátis',
  plano: 'Plano e pagamento',
  saude: 'Saúde do robô',
  afiliados: 'Programa de afiliados',
  marketing: 'Marketing e avisos',
  contato: 'Contato e escuta',
})

// Variáveis que TODO e-mail recebe, sem precisar declarar.
export const STANDARD_VARIABLES = Object.freeze([
  { name: 'saudacao', description: 'Saudação pronta ("Olá, Juliane!" ou "Olá!" quando não há nome)', example: 'Olá, Juliane!' },
  { name: 'primeiro_nome', description: 'Primeiro nome do cliente', example: 'Juliane' },
  { name: 'nome', description: 'Nome completo do cliente', example: 'Juliane Pumuceno' },
  { name: 'link_painel', description: 'Endereço do painel', example: 'https://espelhagrupos.com.br/painel' },
  { name: 'link_login', description: 'Endereço da tela de entrada', example: 'https://espelhagrupos.com.br/login' },
  { name: 'link_planos', description: 'Endereço da tela de planos', example: 'https://espelhagrupos.com.br/painel/planos' },
  { name: 'link_lojas', description: 'Endereço da tela onde a cliente cadastra a etiqueta de afiliada de cada loja', example: 'https://espelhagrupos.com.br/painel/ids-afiliada' },
  { name: 'video_etiquetas', description: 'Vídeo-aula de como cadastrar a etiqueta de afiliada de cada loja (o mesmo do painel)', example: 'https://youtu.be/6F2AUM88FKk' },
  { name: 'email_suporte', description: 'E-mail de suporte', example: 'contato@espelhagrupos.com.br' },
  { name: 'whatsapp_suporte', description: 'WhatsApp de suporte', example: 'https://wa.me/5532999844020' },
  { name: 'marca', description: 'Nome da marca', example: 'BOTinho' },
  // Um por capítulo do vídeo, gerados da MESMA tabela que monta os links —
  // declarar à mão abriria espaço para a lista e os links divergirem.
  ...VIDEO_ETIQUETAS_CAPITULOS.map((c) => ({
    name: `video_${c.chave}`,
    description: `Vídeo-aula no trecho: ${c.rotulo}`,
    example: videoEtiquetasEm(c.segundos, 'https://youtu.be/6F2AUM88FKk'),
  })),
])

const VAR_FIM_TESTE = { name: 'fim_do_teste', description: 'Data em que o teste grátis acaba', example: '23/08/2026' }
const VAR_DIAS = { name: 'dias_restantes', description: 'Quantos dias faltam', example: '3' }
const VAR_VENCIMENTO = { name: 'data_vencimento', description: 'Data em que o plano vence', example: '19/08/2026' }
const VAR_VALOR = { name: 'valor', description: 'Valor em reais', example: 'R$ 69,00' }
const VAR_LOJA = { name: 'loja', description: 'Nome da loja', example: 'Mercado Livre' }

// Trecho repetido nos avisos de contagem regressiva do teste grátis.
function trialCountdownBody(chamada) {
  return `{{saudacao}} ${chamada} Seu teste grátis vai até **{{fim_do_teste}}**.

Depois dessa data o robô para de enviar suas ofertas. Escolhendo um plano antes disso, você continua exatamente de onde parou: seus grupos, suas etiquetas de afiliada e suas configurações ficam do jeito que estão.

[[botao:Escolher meu plano|{{link_planos}}]]

Ficou na dúvida sobre qual plano serve para você? É só responder este e-mail que a gente te ajuda a escolher.`
}

// Todo e-mail de escuta termina do MESMO jeito: as duas formas de falar com a
// gente, lado a lado, e o convite explícito para só responder o e-mail. Quem
// está travada não vai procurar canal de suporte — o canal tem que estar na
// frente dela.
const CONTATO_FECHAMENTO = `Para responder é só apertar "responder" neste e-mail. Se preferir, fala com a gente por onde for mais fácil:

- WhatsApp: {{whatsapp_suporte}}
- E-mail: {{email_suporte}}

A gente lê tudo e responde pessoalmente — não é robô respondendo aqui.`

function escutaBody(miolo) {
  return `${miolo}

${CONTATO_FECHAMENTO}`
}

function planCountdownBody(chamada) {
  return `{{saudacao}} ${chamada} Seu plano vence em **{{data_vencimento}}**.

Renovando antes do vencimento, o robô não para nenhum minuto e você não perde oferta nenhuma nos seus grupos.

[[botao:Renovar meu plano|{{link_planos}}]]`
}

const DEFINITIONS = [
  // ------------------------------------------------------------ conta
  {
    slug: 'boas_vindas',
    name: 'Conta criada + 7 dias grátis',
    description: 'Sai no cadastro. Confirma a conta e diz até quando vale o teste grátis.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 365,
    variables: [VAR_FIM_TESTE],
    title: 'Bem-vinda ao {{marca}}!',
    subject: 'Bem-vinda ao {{marca}}! Seus 7 dias grátis já começaram 🎉',
    body: `{{saudacao}} Sua conta está pronta e seu teste grátis vale até **{{fim_do_teste}}**.

Para o robô começar a trabalhar hoje, siga estes 5 passos (leva uns 4 minutos):

1. Conecte seu WhatsApp (de preferência um chip só para isso, não o pessoal).
2. Marque os grupos ou canais de ONDE as ofertas vêm.
3. Marque os grupos ou canais PARA ONDE as ofertas vão.
4. Cadastre suas etiquetas de afiliada (Mercado Livre, Amazon, Shopee).
5. Ligue o robô e acompanhe os envios na tela de Histórico.

[[botao:Acessar o painel|{{link_login}}]]

Travou em algum passo? A gente te ajuda pessoalmente pelo e-mail {{email_suporte}} ou pelo WhatsApp {{whatsapp_suporte}}.`,
  },
  {
    slug: 'teste_acaba_em_3_dias',
    name: 'Teste grátis: faltam 3 dias',
    description: 'Sai quando faltam 3 dias para o teste grátis acabar.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_FIM_TESTE, VAR_DIAS],
    title: 'Faltam 3 dias do seu teste grátis',
    subject: 'Faltam 3 dias do seu teste grátis no {{marca}}',
    body: trialCountdownBody('Passando para avisar com calma:'),
  },
  {
    slug: 'teste_acaba_em_2_dias',
    name: 'Teste grátis: faltam 2 dias',
    description: 'Sai quando faltam 2 dias para o teste grátis acabar.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_FIM_TESTE, VAR_DIAS],
    title: 'Faltam 2 dias do seu teste grátis',
    subject: 'Faltam 2 dias do seu teste grátis no {{marca}}',
    body: trialCountdownBody('Seu teste está acabando:'),
  },
  {
    slug: 'teste_acaba_em_1_dia',
    name: 'Teste grátis: falta 1 dia',
    description: 'Sai no último dia do teste grátis.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_FIM_TESTE, VAR_DIAS],
    title: 'Último dia do seu teste grátis',
    subject: 'Hoje é o último dia do seu teste grátis no {{marca}}',
    body: trialCountdownBody('É hoje:'),
  },
  {
    slug: 'teste_acabou',
    name: 'Teste grátis acabou',
    description: 'Sai no dia seguinte ao fim do teste grátis.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 30,
    variables: [],
    title: 'Seu teste grátis chegou ao fim',
    subject: 'Seu teste grátis acabou — escolha um plano para o robô voltar',
    body: `{{saudacao}} Seus 7 dias de teste terminaram e o robô parou de enviar suas ofertas.

Nada foi apagado: seus grupos, suas etiquetas de afiliada e suas configurações continuam salvos. Assim que você escolher um plano, tudo volta a funcionar do mesmo jeito, sem precisar configurar de novo.

[[botao:Escolher meu plano|{{link_planos}}]]

Se o robô não te atendeu como você esperava, responde este e-mail contando o que faltou — a gente quer saber de verdade.`,
  },
  {
    slug: 'recuperar_senha',
    name: 'Recuperar senha',
    description: 'Sai quando a pessoa pede uma nova senha na tela de entrada.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'link_nova_senha', description: 'Link seguro para criar a nova senha', example: 'https://espelhagrupos.com.br/nova-senha?c=...' },
      { name: 'validade_link', description: 'Por quanto tempo o link vale', example: '1 hora' },
    ],
    title: 'Criar uma nova senha',
    subject: 'Criar uma nova senha do {{marca}}',
    body: `{{saudacao}} Recebemos um pedido para criar uma nova senha da sua conta.

[[botao:Criar nova senha|{{link_nova_senha}}]]

Este link vale por {{validade_link}} e só pode ser usado uma vez.

Se não foi você que pediu, pode ignorar este e-mail — sua senha atual continua valendo e ninguém entrou na sua conta.`,
  },

  // ------------------------------------------------------------ plano
  {
    slug: 'pagamento_aprovado',
    name: 'Pagamento aprovado',
    description: 'Recibo. Sai quando o pagamento é confirmado.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      VAR_VALOR,
      { name: 'plano', description: 'Nome do plano contratado', example: 'Pro' },
      { name: 'vale_ate', description: 'Data até quando o acesso vale', example: '16/09/2026' },
    ],
    title: 'Pagamento confirmado!',
    subject: 'Pagamento confirmado — seu plano {{plano}} está ativo',
    body: `{{saudacao}} Recebemos seu pagamento de **{{valor}}** e seu plano **{{plano}}** já está ativo.

Seu acesso vale até **{{vale_ate}}**. O robô volta a trabalhar na hora, sem precisar mexer em nada.

[[botao:Ver meu painel|{{link_painel}}]]

Precisa da nota ou de algum dado da compra? É só responder este e-mail.`,
  },
  {
    slug: 'pagamento_pendente',
    name: 'Pagamento não concluído',
    description: 'Sai quando um pagamento foi iniciado e não foi concluído em algumas horas.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 3,
    variables: [{ name: 'plano', description: 'Plano escolhido', example: 'Pro' }],
    title: 'Seu pagamento não foi concluído',
    subject: 'Faltou concluir seu pagamento no {{marca}}',
    body: `{{saudacao}} Você começou a contratar o plano **{{plano}}**, mas o pagamento não foi concluído.

Se foi só uma distração, dá para terminar em um minuto — e se deu algum erro no caminho, me conta que a gente resolve junto.

[[botao:Concluir pagamento|{{link_planos}}]]`,
  },
  {
    slug: 'plano_vence_em_3_dias',
    name: 'Plano vence em 3 dias',
    description: 'Aviso de renovação, 3 dias antes.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_VENCIMENTO, VAR_DIAS],
    title: 'Seu plano vence em 3 dias',
    subject: 'Seu plano do {{marca}} vence em 3 dias',
    body: planCountdownBody('Passando para avisar com antecedência:'),
  },
  {
    slug: 'plano_vence_em_2_dias',
    name: 'Plano vence em 2 dias',
    description: 'Aviso de renovação, 2 dias antes.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_VENCIMENTO, VAR_DIAS],
    title: 'Seu plano vence em 2 dias',
    subject: 'Seu plano do {{marca}} vence em 2 dias',
    body: planCountdownBody('Seu plano está acabando:'),
  },
  {
    slug: 'plano_vence_em_1_dia',
    name: 'Plano vence amanhã',
    description: 'Aviso de renovação, 1 dia antes.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_VENCIMENTO, VAR_DIAS],
    title: 'Seu plano vence amanhã',
    subject: 'Seu plano do {{marca}} vence amanhã',
    body: planCountdownBody('É amanhã:'),
  },
  {
    slug: 'plano_venceu',
    name: 'Plano venceu',
    description: 'Sai no dia seguinte ao vencimento do plano pago.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 30,
    variables: [],
    title: 'Seu plano venceu',
    subject: 'Seu plano venceu — renove para continuar vendendo',
    body: `{{saudacao}} Seu plano venceu e o robô parou de enviar as ofertas para os seus grupos.

Enquanto ele está parado, cada promoção que passa nos grupos de origem é uma comissão que deixa de acontecer. Renovando agora, ele volta na hora — nada foi apagado, tudo continua configurado do seu jeito.

[[botao:Renovar meu plano|{{link_planos}}]]`,
  },
  {
    slug: 'plano_vencido_volta',
    name: 'Voltar depois de vencido (7 dias)',
    description: 'Sai uma semana depois do vencimento, para quem não renovou.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 60,
    variables: [],
    title: 'Que tal voltar a vender no automático?',
    subject: 'Seus grupos estão sem oferta há uma semana',
    body: `{{saudacao}} Faz uma semana que o robô está parado por aqui.

Seus grupos, suas etiquetas de afiliada e todas as suas configurações continuam guardados. É só escolher um plano que ele volta a espelhar as ofertas no mesmo minuto — sem reconfigurar nada.

[[botao:Ligar o robô de novo|{{link_planos}}]]

Se você desistiu por algum motivo específico, responde este e-mail contando qual foi. A gente lê tudo.`,
  },

  // ------------------------------------------------------------ saúde do robô
  {
    slug: 'codigo_acesso_venceu',
    name: 'Código de acesso da loja venceu',
    description: 'Sai quando a loja passa a recusar o código de acesso cadastrado (Mercado Livre ou Amazon).',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 7,
    variables: [
      { name: 'lojas', description: 'Loja(s) com o código vencido', example: 'Mercado Livre e Amazon' },
      { name: 'consequencia', description: 'O que muda na prática, por loja', example: 'no Mercado Livre, o cupom que não aponta para um produto deixa de ser convertido' },
      { name: 'link_credenciais', description: 'Endereço da tela de credenciais', example: 'https://espelhagrupos.com.br/painel/ids-afiliada' },
    ],
    title: 'O código de acesso da loja venceu',
    subject: 'Seu código de acesso ({{lojas}}) venceu — suas ofertas continuam saindo',
    body: `{{saudacao}} O código de acesso que você cadastrou para **{{lojas}}** venceu. Isso acontece de tempos em tempos e não é erro seu.

Fique tranquila: suas ofertas CONTINUAM saindo normalmente e a comissão CONTINUA sendo sua. A única diferença é que o link dessa loja sai mais comprido — e {{consequencia}}.

Como resolver, em menos de um minuto:

1. Abra o painel e vá em "Minhas credenciais".
2. Escolha a loja avisada aqui.
3. Cole o código de acesso novo e salve. A gente testa na hora e te diz se ficou certo.

[[botao:Abrir minhas credenciais|{{link_credenciais}}]]`,
  },
  {
    slug: 'chave_shopee_recusada',
    name: 'Shopee parou de aceitar a chave',
    description: 'Sai quando a Shopee passa a recusar o App ID / chave secreta cadastrados. Diferente do ML e da Amazon, aqui as ofertas da Shopee PARAM de sair — o texto diz isso.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 7,
    variables: [
      { name: 'link_credenciais', description: 'Endereço da tela de credenciais', example: 'https://espelhagrupos.com.br/painel/ids-afiliada' },
    ],
    title: 'A Shopee parou de aceitar sua chave',
    subject: 'Sua chave da Shopee parou de valer — as ofertas da Shopee estão paradas',
    body: `{{saudacao}} A Shopee parou de aceitar a chave que você cadastrou. Isso acontece de tempos em tempos e não é erro seu.

Aqui é diferente das outras lojas, e por isso este aviso: **as ofertas da Shopee pararam de sair**. Sem a chave aceita, o robô não consegue montar o seu link, e prefere não publicar a publicar um link que não é seu. Suas ofertas automáticas da Shopee também estão paradas. As outras lojas seguem normalmente.

Como resolver, em menos de dois minutos:

1. Entre no painel de afiliada da Shopee e gere um App ID e uma chave secreta novos.
2. Aqui no nosso painel, abra "Minhas credenciais" e escolha a Shopee.
3. Cole os dois e salve. A gente testa na hora e te diz se ficou certo.

[[botao:Abrir minhas credenciais|{{link_credenciais}}]]`,
  },
  {
    slug: 'nao_conseguiu_conectar_sem_vaga',
    name: 'Não conseguiu conectar (servidor estava lotado)',
    description:
      'Para quem tentou ligar o robô e recebeu erro porque o servidor tinha batido o limite de robôs ' +
      'ligados ao mesmo tempo. Disparo MANUAL pela aba E-mails, com a lista que o script ' +
      'scripts/diag-clientes-sem-vaga.mjs produz. Não é gatilho automático de propósito: a hora de ' +
      'avisar é depois de a vaga já existir, senão a cliente tenta de novo e esbarra no mesmo erro.',
    group: 'saude',
    // Aviso de serviço (o robô dela não ligou por causa nossa), não divulgação:
    // vai para quem descadastrou de marketing e não leva link de descadastro.
    category: 'transactional',
    trigger: 'manual',
    dedupDays: 7,
    variables: [],
    title: 'Já dá para conectar seu robô',
    subject: 'O erro ao conectar seu robô era nosso — já está resolvido',
    body: `{{saudacao}} Se você tentou ligar seu robô nos últimos dias e apareceu um erro na tela, a causa era nossa: nosso servidor tinha chegado ao limite de robôs ligados ao mesmo tempo, e o seu não conseguia entrar. Não era problema do seu número, nem da sua conta, nem de nada que você tenha feito.

Já trocamos o servidor por um bem maior e o limite subiu. **Agora é só entrar no painel e conectar normalmente.**

[[botao:Conectar meu robô|{{link_painel}}]]

Se aparecer qualquer coisa estranha na tela, responde este e-mail ou chama a gente no WhatsApp ({{whatsapp_suporte}}) que a gente resolve com você.

Desculpa pelo transtorno — e obrigada pela paciência.`,
  },
  {
    slug: 'whatsapp_desconectado',
    name: 'WhatsApp caiu e não voltou',
    description: 'Sai quando o WhatsApp fica desconectado por mais de 24h com plano ativo.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 3,
    variables: [{ name: 'link_whatsapp', description: 'Endereço da tela de conexão', example: 'https://espelhagrupos.com.br/painel/whatsapp' }],
    title: 'Seu WhatsApp está desconectado',
    subject: 'Atenção: o robô está sem WhatsApp há mais de um dia',
    body: `{{saudacao}} O WhatsApp do robô está desconectado há mais de um dia — e, desconectado, ele não consegue espelhar nenhuma oferta.

O robô tenta reconectar sozinho o tempo todo. Quando passa desse tempo, quase sempre é porque o aparelho precisa ler o código de novo.

1. Abra o painel na tela do WhatsApp.
2. Clique em Conectar e leia o código com o celular do robô.
3. Confira se a tela ficou verde, com "Conectado".

[[botao:Reconectar meu WhatsApp|{{link_whatsapp}}]]

Se o código não aparecer ou der erro, me chama no {{whatsapp_suporte}} que eu resolvo com você.`,
  },
  {
    slug: 'onboarding_conecte_whatsapp',
    name: 'Cadastrou e não conectou o WhatsApp',
    description: 'Sai 2 dias depois do cadastro para quem nunca conectou o WhatsApp.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 30,
    variables: [{ name: 'link_whatsapp', description: 'Endereço da tela de conexão', example: 'https://espelhagrupos.com.br/painel/whatsapp' }],
    title: 'Falta conectar seu WhatsApp',
    subject: 'Seu robô ainda não começou — falta 1 passo',
    body: `{{saudacao}} Sua conta está criada, mas o WhatsApp ainda não foi conectado — e é ele que faz o robô trabalhar.

São dois minutos: abre a tela do WhatsApp no painel, clica em Conectar e lê o código com o celular. Depois disso o robô já começa a espelhar as ofertas nos grupos que você escolher.

Se ficou com o pé atrás em conectar o seu WhatsApp, é justo — então vale dizer o que acontece:

${whatsappSafetyEmailBlock()}

[[botao:Conectar meu WhatsApp|{{link_whatsapp}}]]

Se preferir, a gente faz isso junto com você por chamada. É só responder este e-mail.`,
  },
  {
    slug: 'configuracao_incompleta',
    name: 'Falta escolher grupo de origem ou destino',
    description: 'Sai para quem conectou o WhatsApp mas não terminou de escolher os grupos.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 14,
    variables: [
      { name: 'o_que_falta', description: 'O que ainda não foi escolhido', example: 'os grupos de destino' },
      { name: 'link_grupos', description: 'Endereço da tela de grupos', example: 'https://espelhagrupos.com.br/painel/grupos' },
    ],
    title: 'Falta pouco para o robô começar',
    subject: 'Falta escolher {{o_que_falta}} para o robô começar',
    body: `{{saudacao}} Seu WhatsApp já está conectado — falta só escolher **{{o_que_falta}}**.

O robô precisa saber de onde vêm as ofertas e para onde elas vão. Depois disso ele começa a trabalhar sozinho.

[[botao:Escolher meus grupos|{{link_grupos}}]]`,
  },
  {
    slug: 'primeira_oferta_enviada',
    name: 'Primeira oferta enviada',
    description: 'Parabéns pela primeira oferta espelhada com sucesso.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 365,
    variables: [{ name: 'link_historico', description: 'Endereço da tela de histórico', example: 'https://espelhagrupos.com.br/painel/logs' }],
    title: 'Sua primeira oferta saiu! 🎉',
    subject: 'Sua primeira oferta foi enviada pelo {{marca}}',
    body: `{{saudacao}} Sua primeira oferta acabou de ser espelhada com a sua comissão. O robô está oficialmente trabalhando para você.

Daqui para frente, tudo o que passar nos grupos de origem vai sair nos seus grupos de destino, já com o seu link de afiliada.

[[botao:Ver meu histórico de envios|{{link_historico}}]]

Uma dica: quanto mais grupos de origem bons você marcar, mais oferta o robô tem para espelhar.`,
  },
  {
    slug: 'robo_parado',
    name: 'Plano ativo mas robô parado',
    description: 'Sai quando um cliente pagante fica 2 dias sem nenhum envio.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 7,
    variables: [{ name: 'link_historico', description: 'Endereço da tela de histórico', example: 'https://espelhagrupos.com.br/painel/logs' }],
    title: 'Seu robô está parado',
    subject: 'Seu plano está ativo, mas o robô não envia há 2 dias',
    body: `{{saudacao}} Você está com plano ativo, mas o robô não envia nenhuma oferta há dois dias. Como você está pagando por ele, vale a pena conferir.

Os motivos mais comuns são: o WhatsApp caiu, os grupos de origem pararam de publicar, ou o robô está desligado no painel.

[[botao:Ver o que está acontecendo|{{link_historico}}]]

Se não achar o motivo em dois minutos, me chama no {{whatsapp_suporte}} que eu olho com você.`,
  },

  // ------------------------------------------------------------ afiliados
  {
    slug: 'seja_afiliado',
    name: 'Convite para o programa de afiliados',
    description: 'Convite para indicar o BOTinho e ganhar comissão.',
    group: 'afiliados',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 90,
    variables: [
      { name: 'percentual', description: 'Percentual de comissão', example: '30%' },
      { name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' },
    ],
    title: 'Indique o {{marca}} e ganhe comissão',
    subject: 'Ganhe {{percentual}} indicando o {{marca}}',
    body: `{{saudacao}} Você já usa o robô no dia a dia — que tal ganhar com ele também?

No programa de afiliadas do {{marca}} você recebe **{{percentual}}** de comissão de cada pessoa que assinar pelo seu link. Você recebe por PIX, e acompanha tudo pelo painel: quem clicou, quem assinou e quanto você já tem para receber.

[[botao:Quero indicar|{{link_afiliados}}]]`,
  },
  {
    slug: 'afiliado_aprovado',
    name: 'Candidatura de afiliada aprovada',
    description: 'Sai quando a candidatura ao programa de afiliadas é aprovada.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [{ name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' }],
    title: 'Sua candidatura foi aprovada! 🎉',
    subject: 'Sua candidatura ao programa de afiliadas do {{marca}} foi aprovada',
    body: `{{saudacao}} Boas notícias! Sua candidatura ao programa de afiliadas do {{marca}} foi aprovada.

Seu link de indicação já está ativo. Abra o painel para copiar o seu link e acompanhar cliques, indicações e comissões.

[[botao:Ver meu painel de afiliada|{{link_afiliados}}]]`,
  },
  {
    slug: 'afiliado_recusado',
    name: 'Candidatura de afiliada recusada',
    description: 'Sai quando a candidatura não é aprovada.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'motivo', description: 'Motivo informado pela administração', example: 'dados de pagamento incompletos' },
      { name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' },
    ],
    title: 'Sobre sua candidatura ao programa de afiliadas',
    subject: 'Atualização sobre sua candidatura de afiliada no {{marca}}',
    body: `{{saudacao}} Sua candidatura ao programa de afiliadas não foi aprovada desta vez.

Motivo: {{motivo}}

Isso não impede uma nova tentativa: ajustando o que foi apontado, você pode se candidatar de novo pelo painel.

[[botao:Enviar nova candidatura|{{link_afiliados}}]]`,
  },
  {
    slug: 'indicado_se_cadastrou',
    name: 'Alguém que você indicou se cadastrou',
    description: 'Sai para a afiliada quando alguém cria conta pelo link dela.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [{ name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' }],
    title: 'Uma indicação sua criou conta',
    subject: 'Boa! Alguém se cadastrou pelo seu link no {{marca}}',
    body: `{{saudacao}} Uma pessoa acabou de criar conta pelo seu link de indicação.

Ela está no período de teste. Se assinar um plano, a comissão entra automaticamente na sua conta de afiliada.

[[botao:Acompanhar minhas indicações|{{link_afiliados}}]]`,
  },
  {
    slug: 'indicado_pagou',
    name: 'Uma indicação sua assinou',
    description: 'Sai quando uma pessoa indicada faz um pagamento e gera comissão.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      VAR_VALOR,
      { name: 'dias_carencia', description: 'Dias até a comissão liberar', example: '30' },
      { name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' },
    ],
    title: 'Você tem uma comissão nova 💰',
    subject: 'Uma indicação sua assinou — comissão de {{valor}}',
    body: `{{saudacao}} Boas notícias! Uma pessoa que você indicou assinou um plano, e você tem **{{valor}}** de comissão registrada.

O valor fica em espera por {{dias_carencia}} dias (é a janela de segurança para o caso de reembolso). Passado esse prazo, ele entra no seu saldo disponível para saque.

[[botao:Ver minhas comissões|{{link_afiliados}}]]`,
  },
  {
    slug: 'comissao_liberada',
    name: 'Comissão liberada para saque',
    description: 'Sai quando uma comissão passa da carência e entra no saldo.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      VAR_VALOR,
      { name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' },
    ],
    title: 'Sua comissão foi liberada 💰',
    subject: 'Comissão de {{valor}} liberada no {{marca}}',
    body: `{{saudacao}} Uma comissão de **{{valor}}** passou da janela de segurança e entrou no seu saldo disponível.

[[botao:Ver meu saldo|{{link_afiliados}}]]`,
  },
  {
    slug: 'saque_disponivel',
    name: 'Já pode pedir saque',
    description: 'Sai quando o saldo liberado alcança o mínimo para saque.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 15,
    variables: [
      { name: 'saldo', description: 'Saldo disponível', example: 'R$ 62,00' },
      { name: 'minimo', description: 'Valor mínimo para sacar', example: 'R$ 50,00' },
      { name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' },
    ],
    title: 'Você já pode pedir seu saque',
    subject: 'Você tem {{saldo}} para sacar no {{marca}}',
    body: `{{saudacao}} Seu saldo de afiliada chegou a **{{saldo}}** e já passou do mínimo de {{minimo}} para saque.

É só pedir pelo painel: o pagamento vai para a chave PIX que você cadastrou.

[[botao:Pedir meu saque|{{link_afiliados}}]]`,
  },
  {
    slug: 'saque_pago',
    name: 'Saque pago',
    description: 'Sai quando o pagamento da comissão é feito.',
    group: 'afiliados',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      VAR_VALOR,
      { name: 'link_afiliados', description: 'Endereço da tela de afiliados', example: 'https://espelhagrupos.com.br/painel/afiliados' },
    ],
    title: 'Pagamento enviado ✅',
    subject: 'Enviamos {{valor}} da sua comissão no {{marca}}',
    body: `{{saudacao}} Enviamos **{{valor}}** de comissão para a chave PIX cadastrada na sua conta de afiliada.

Dependendo do banco, o valor cai na hora ou em alguns minutos.

[[botao:Ver meu histórico|{{link_afiliados}}]]`,
  },

  // ------------------------------------------------------------ marketing e avisos
  {
    slug: 'promocao_relampago',
    name: 'Promoção relâmpago (manual)',
    description: 'Você dispara pelo painel. Serve para campanha de desconto por tempo limitado.',
    group: 'marketing',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 7,
    variables: [
      { name: 'oferta', description: 'O que está sendo oferecido', example: '40% de desconto no plano Pro' },
      { name: 'validade', description: 'Até quando vale', example: 'só até domingo' },
    ],
    title: 'Promoção relâmpago no {{marca}}',
    subject: '{{oferta}} no {{marca}} — {{validade}}',
    body: `{{saudacao}} Estamos com uma condição especial: **{{oferta}}**, {{validade}}.

O robô volta a espelhar suas ofertas assim que o plano estiver ativo — seus grupos, suas etiquetas de afiliada e suas configurações continuam salvos, do jeito que você deixou.

[[botao:Aproveitar agora|{{link_planos}}]]`,
  },
  {
    slug: 'novidade_produto',
    name: 'Novidade do produto (manual)',
    description: 'Você dispara pelo painel para contar uma novidade ou melhoria.',
    group: 'marketing',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 3,
    variables: [
      { name: 'novidade', description: 'Título da novidade', example: 'Agora dá para agendar ofertas' },
      { name: 'detalhes', description: 'Explicação em uma ou duas frases', example: 'Você monta a oferta hoje e escolhe a hora em que ela sai.' },
    ],
    title: '{{novidade}}',
    subject: 'Novidade no {{marca}}: {{novidade}}',
    body: `{{saudacao}} Temos uma novidade no {{marca}}: **{{novidade}}**.

{{detalhes}}

[[botao:Ver no painel|{{link_painel}}]]

Achou útil? Achou confuso? Responde este e-mail contando — é assim que a gente decide o que fazer em seguida.`,
  },
  {
    slug: 'resumo_semanal',
    name: 'Resumo da semana',
    description: 'Resumo do que o robô fez na semana. Pode sair sozinho ou ser disparado por você.',
    group: 'marketing',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 6,
    variables: [
      { name: 'ofertas_enviadas', description: 'Quantas ofertas saíram na semana', example: '184' },
      { name: 'grupos_atendidos', description: 'Para quantos grupos/canais', example: '6' },
      { name: 'cliques', description: 'Cliques nos links da semana', example: '312' },
      { name: 'link_historico', description: 'Endereço da tela de histórico', example: 'https://espelhagrupos.com.br/painel/logs' },
    ],
    title: 'O que seu robô fez esta semana',
    subject: 'Sua semana no {{marca}}: {{ofertas_enviadas}} ofertas enviadas',
    body: `{{saudacao}} Resumo do que o robô fez por você nos últimos 7 dias:

- **{{ofertas_enviadas}}** ofertas enviadas
- **{{grupos_atendidos}}** grupos e canais atendidos
- **{{cliques}}** cliques nos seus links

[[botao:Ver os detalhes|{{link_historico}}]]`,
  },
  {
    slug: 'aviso_mudanca',
    name: 'Aviso de mudança (manual)',
    description: 'Comunicado de mudança de preço, regras ou termos. Transacional: vai para todo mundo.',
    group: 'marketing',
    category: 'transactional',
    trigger: 'manual',
    dedupDays: 1,
    variables: [
      { name: 'assunto_aviso', description: 'Do que se trata', example: 'Atualização dos nossos planos' },
      { name: 'detalhes', description: 'O que muda, em uma ou duas frases', example: 'A partir de 1º de outubro o plano Pro passa a custar R$ 89.' },
      { name: 'a_partir_de', description: 'Quando passa a valer', example: '1º de outubro de 2026' },
    ],
    title: '{{assunto_aviso}}',
    subject: '{{assunto_aviso}} — {{marca}}',
    body: `{{saudacao}} Precisamos te avisar de uma mudança: **{{assunto_aviso}}**.

{{detalhes}}

Isso passa a valer em **{{a_partir_de}}**. Até lá nada muda para você.

Ficou com alguma dúvida? Responde este e-mail que a gente explica direitinho.`,
  },

  // ------------------------------------------------------------ trilha de nutrição
  {
    slug: 'nutricao_dia_2',
    name: 'Trilha: 2 dias após o cadastro',
    description: 'Lembrete de valor no segundo dia.',
    group: 'conta',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 365,
    variables: [],
    title: '3 jeitos de tirar mais proveito do robô',
    subject: '{{marca}}: 3 jeitos rápidos de tirar mais proveito do robô',
    body: `{{saudacao}} Já faz dois dias que você conheceu o {{marca}}. Um lembrete rápido:

1. Conecte o WhatsApp e marque os grupos de origem e destino.
2. Cadastre suas etiquetas de afiliada (Mercado Livre, Amazon, Shopee).
3. Acompanhe os envios em tempo real pela tela de Histórico.

[[botao:Acessar o painel|{{link_login}}]]`,
  },
  {
    slug: 'nutricao_dia_5',
    name: 'Trilha: 5 dias após o cadastro',
    description: 'Convite para testar de verdade.',
    group: 'conta',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 365,
    variables: [],
    title: 'Já testou o robô com uma oferta de verdade?',
    subject: '{{marca}}: já testou o robô com uma oferta de verdade?',
    body: `{{saudacao}} Se você ainda não testou, esse é o momento: cadastre uma oferta e veja o robô enviar sozinho para os seus grupos de destino.

[[botao:Testar agora|{{link_login}}]]

Travou em algum passo? A gente te ajuda pessoalmente pelo {{whatsapp_suporte}}.`,
  },
  {
    slug: 'nutricao_dia_7',
    name: 'Trilha: 7 dias após o cadastro',
    description: 'Último empurrão antes do fim do teste.',
    group: 'conta',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 365,
    variables: [],
    title: 'Seu teste grátis está acabando',
    subject: '{{marca}}: seu teste grátis está perto de acabar',
    body: `{{saudacao}} Passou uma semana desde que você conheceu o {{marca}}.

Ative o robô agora para não perder nenhuma oferta enquanto o teste grátis ainda está valendo.

[[botao:Ligar meu robô|{{link_login}}]]`,
  },

  // ------------------------------------------------------------ contato e escuta
  //
  // Grupo de e-mails PRONTOS para perguntar o que travou. Todos são disparados
  // por você, pela aba E-mails, escolhendo o público na hora — não têm gatilho
  // automático de propósito: pergunta feita por robô, na hora errada, queima o
  // canal. Todos são 'marketing' porque não são obrigação de serviço: quem
  // pediu para não receber divulgação também não quer ser sondada.
  {
    slug: 'contato_como_esta_indo',
    name: 'Como está indo? (check-in geral)',
    description: 'Pergunta aberta para qualquer cliente: está indo bem, travou em alguma coisa?',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 30,
    variables: [],
    title: 'Como está indo por aí?',
    subject: 'Posso te ajudar em alguma coisa no {{marca}}?',
    body: escutaBody(`{{saudacao}} Passando só para saber como está indo com o robô.

Está conseguindo usar do jeito que queria? Tem alguma coisa que você tentou fazer e não achou, ou que deu trabalho demais?

Não precisa escrever bonito nem detalhar: uma frase já ajuda muito. Se estiver tudo certo, pode responder só "tá tudo certo" que eu já fico feliz.`),
  },
  {
    slug: 'contato_travou_na_configuracao',
    name: 'Travou na configuração?',
    description: 'Para quem criou a conta e não terminou de configurar. Pergunta onde parou.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 21,
    variables: [],
    title: 'Travou em algum passo?',
    subject: 'Ficou faltando algum passo para o seu robô começar?',
    body: escutaBody(`{{saudacao}} Vi que a sua conta está criada, mas o robô ainda não começou a trabalhar de verdade.

Isso quase sempre é um passo que ficou pelo meio, e acontece com todo mundo. Me conta em que ponto você parou:

- Não conseguiu conectar o WhatsApp?
- Ficou em dúvida sobre quais grupos marcar?
- Empacou nas etiquetas de afiliada das lojas?
- Foi outra coisa?

Se preferir, a gente faz junto por chamada, na hora que der para você. Leva uns 15 minutos e resolve.`),
  },
  {
    // ATENÇÃO — este e-mail e o `contato_sem_etiqueta_nada_sai` logo abaixo
    // tratam de situações OPOSTAS e não podem ser fundidos nem trocados:
    //
    //   aqui  = a cliente TEM etiqueta cadastrada e ela venceu/está incompleta.
    //           No ML e na Amazon o plano B continua publicando, só com link
    //           mais comprido. Por isso o texto tranquiliza.
    //   abaixo = a cliente NUNCA cadastrou etiqueta nenhuma. Aí o robô se
    //           RECUSA a publicar (`skip:no_valid_conversions`) e NADA sai.
    //           Dizer "continua saindo" ali seria mentira.
    //
    // Guarda em `test/email-contato-escuta.test.js`.
    slug: 'contato_duvida_credenciais',
    name: 'Dúvida nas etiquetas e códigos das lojas',
    description: 'Para quem JÁ cadastrou etiqueta de alguma loja e ela venceu ou ficou incompleta. NÃO usar para quem nunca cadastrou — nesse caso nada é publicado e o texto certo é o contato_sem_etiqueta_nada_sai.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 21,
    variables: [],
    title: 'Dúvida com as lojas?',
    subject: 'Precisa de ajuda com as etiquetas de afiliada?',
    body: escutaBody(`{{saudacao}} Reparei que os dados de alguma loja sua estão faltando ou pararam de valer.

Essa é a parte que mais gera dúvida, e é onde a gente mais consegue ajudar. Se você me disser qual loja está te dando trabalho — Mercado Livre, Amazon, Shopee ou Magalu — eu te mando o passo a passo com print, ou a gente faz junto por chamada.

Enquanto isso suas ofertas continuam saindo e a comissão continua sendo sua: o link só sai mais comprido.`),
  },
  {
    // Existe porque as 22 pessoas que travaram nesta etapa (32% de quem não
    // pagou, medido em 2026-08) não cabiam em nenhum e-mail existente: o
    // `contato_duvida_credenciais` diz "suas ofertas continuam saindo", e para
    // quem nunca cadastrou etiqueta nenhuma isso é FALSO — nada saiu.
    //
    // O ponto que muda a conversa: elas acham que o robô não funciona. Ele
    // está funcionando exatamente como deveria — recusando publicar link que
    // daria a comissão para outra pessoa. Dizer isso transforma "quebrado" em
    // "protegendo você", e o próximo passo fica óbvio.
    slug: 'contato_sem_etiqueta_nada_sai',
    name: 'Conectou o WhatsApp mas não cadastrou etiqueta',
    description: 'Para quem conectou o WhatsApp e NUNCA cadastrou etiqueta de loja nenhuma. Sem etiqueta o robô não publica nada — e a pessoa costuma achar que o robô está quebrado. NÃO usar para quem já cadastrou e a etiqueta venceu (aí é o contato_duvida_credenciais).',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 21,
    variables: [],
    title: 'Falta um passo para o robô começar',
    subject: 'Seu robô está pronto, falta só a etiqueta da loja',
    body: escutaBody(`{{saudacao}} Você já conectou o WhatsApp — essa é a parte mais chata de todas, e ela já está feita.

Falta só uma coisa para o robô começar a trabalhar: cadastrar a sua etiqueta de afiliada de pelo menos uma loja. Enquanto ela não estiver lá, o robô **não publica nenhuma oferta**.

E isso é de propósito, não é defeito. Publicar sem a sua etiqueta faria a comissão daquela venda ir para outra pessoa — o robô prefere não enviar a te fazer trabalhar de graça.

Uma loja só já resolve, e leva uns 5 minutos:

[[botao:Cadastrar minha etiqueta|{{link_lojas}}]]

Se preferir ver antes de mexer, tem uma vídeo-aula mostrando o passo a passo. Cada link abaixo já abre o vídeo no minuto exato da sua loja — não precisa procurar:

- [Shopee: pedir seu acesso de afiliada (0:15)]({{video_shopee_pedir}})
- [Shopee: copiar a chave (1:43)]({{video_shopee}})
- [Instalar o programinha que o vídeo indica (3:15)]({{video_extensao}}) — só para os dois passos seguintes
- [Amazon: pegar o código de acesso (4:10)]({{video_amazon}})
- [Mercado Livre: pegar o código de acesso (6:11)]({{video_mercadolivre}})
- [Mercado Livre: cadastrar o link da sua vitrine (8:20)]({{video_vitrine_ml}})
- [Magalu: pegar a etiqueta de afiliada (9:22)]({{video_magalu}})

Se você chegou a tentar e travou em alguma parte, me conta qual — eu te mando o passo a passo com print da tela, ou a gente faz junto por chamada, na hora que der para você.`),
  },
  {
    slug: 'contato_primeira_semana',
    name: 'Como foi a primeira semana?',
    description: 'Para quem acabou de completar os primeiros dias usando o robô.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 60,
    variables: [],
    title: 'Como foi sua primeira semana?',
    subject: 'Como foi sua primeira semana com o {{marca}}?',
    body: escutaBody(`{{saudacao}} Você já tem alguns dias de robô rodando. Queria muito saber como está sendo.

Três perguntas rápidas (responde só as que quiser):

1. O que funcionou melhor do que você esperava?
2. O que te deu trabalho ou te deixou insegura?
3. Se você pudesse mudar UMA coisa no robô, qual seria?

Sua resposta muda o que a gente constrói em seguida — a maior parte do que existe hoje nasceu de e-mail de cliente igual a este.`),
  },
  {
    slug: 'contato_parou_de_usar',
    name: 'Parou de usar — o que aconteceu?',
    description: 'Para quem está com plano ativo mas parou de enviar. Pergunta sem cobrar.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 30,
    variables: [],
    title: 'Aconteceu alguma coisa?',
    subject: 'Seu robô está parado — posso ajudar?',
    body: escutaBody(`{{saudacao}} Notei que faz um tempo que o robô não envia nada por aí.

Não é cobrança — pode ser que você tenha decidido dar uma pausa, e tudo bem. Mas se foi alguma coisa que quebrou, ficou confusa ou parou de funcionar, eu quero saber para resolver.

Me conta o que houve? Se for algo do robô, a gente conserta. Se for uma dúvida, a gente responde. Se for só uma pausa, é só ignorar este e-mail.`),
  },
  {
    slug: 'contato_o_que_faltou',
    name: 'O que faltou? (quem não continuou)',
    description: 'Para quem não renovou ou deixou o teste acabar. Pergunta o motivo, sem vender.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 90,
    variables: [],
    title: 'O que faltou para você?',
    subject: 'Me conta o que faltou no {{marca}}?',
    body: escutaBody(`{{saudacao}} Você conheceu o robô e decidiu não continuar — e está tudo bem.

Só queria te pedir um favor rápido: me conta o que faltou? Pode ser sincera, inclusive se for algo duro de ouvir.

- Não entendeu como usar?
- Não deu o resultado que você esperava?
- O preço não fechou?
- Achou outra ferramenta melhor?

Este e-mail não é para te vender nada. É para a gente melhorar o que ficou faltando.`),
  },
  {
    slug: 'contato_convite_conversa',
    name: 'Convite para uma conversa rápida',
    description: 'Convite para uma chamada de 15 minutos para resolver o que estiver travado.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 45,
    variables: [
      { name: 'convite', description: 'Motivo do convite, em uma frase', example: 'te ajudar a deixar o robô rodando redondo' },
    ],
    title: 'Vamos conversar 15 minutos?',
    subject: 'Uma conversa rápida para {{convite}}?',
    body: escutaBody(`{{saudacao}} Queria te chamar para uma conversa rápida, de uns 15 minutos, para {{convite}}.

É por chamada de WhatsApp, na hora que for melhor para você — inclusive fora do horário comercial. Não tem apresentação, não tem venda: é você mostrando onde está travando e a gente resolvendo junto.

Topa? Me responde com dois horários que funcionam para você.`),
  },
  {
    slug: 'contato_pesquisa_rapida',
    name: 'Pesquisa de uma pergunta só',
    description: 'Uma pergunta única para descobrir a maior dificuldade da base.',
    group: 'contato',
    category: 'marketing',
    trigger: 'manual',
    dedupDays: 90,
    variables: [
      { name: 'pergunta', description: 'A pergunta única desta rodada', example: 'qual é hoje a parte mais chata do seu dia divulgando ofertas?' },
    ],
    title: 'Uma pergunta só',
    subject: 'Uma pergunta rápida (responde em 30 segundos)',
    body: escutaBody(`{{saudacao}} Uma pergunta só, e prometo que é rápida:

**{{pergunta}}**

Pode responder em uma linha, do jeito que vier à cabeça. Não tem resposta errada, e eu leio todas.`),
  },
]

const BY_SLUG = new Map(DEFINITIONS.map((definition) => [definition.slug, Object.freeze(definition)]))

export function listTemplateDefinitions() {
  return DEFINITIONS.map((definition) => Object.freeze(definition))
}

export function getTemplateDefinition(slug) {
  return BY_SLUG.get(String(slug ?? '')) ?? null
}

export function templateExists(slug) {
  return BY_SLUG.has(String(slug ?? ''))
}

/**
 * Todas as variáveis que um e-mail aceita (padrão + próprias).
 * @param {string} slug
 * @returns {Array<{name: string, description: string, example: string}>}
 */
export function variablesForTemplate(slug) {
  const definition = getTemplateDefinition(slug)
  return [...STANDARD_VARIABLES, ...(definition?.variables ?? [])]
}
