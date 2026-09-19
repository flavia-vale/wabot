// Catálogo dos e-mails do Espelha Grupos: o TEXTO PADRÃO de cada um mora aqui, no
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
  // Avisos que vão para a ADMIN do produto, não para a cliente. Ficam no mesmo
  // catálogo (dá para editar o texto pelo painel), mas saem por um caminho
  // próprio: `src/email/adminAlerts.js`. Disparo em massa é BARRADO para eles.
  interno: 'Avisos internos (para a administradora)',
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
  { name: 'marca', description: 'Nome da marca', example: 'Espelha Grupos' },
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
// Voucher de desconto para voltar depois do acesso vencido. O código é gerado
// em `src/domain/payments/recoveryVoucher.js` e é o MESMO nos dois e-mails da
// etapa — o segundo só acrescenta quanto prazo sobrou.
const VAR_VOUCHER = { name: 'codigo_voucher', description: 'Código de desconto para voltar', example: 'VOLTA20-3J9ETN' }
const VAR_VOUCHER_DESCONTO = { name: 'desconto_voucher', description: 'Desconto do código', example: '20%' }
const VAR_VOUCHER_ATE = { name: 'voucher_vale_ate', description: 'Último dia em que o código vale', example: '22/09/2026' }
const VAR_VOUCHER_DIAS = { name: 'dias_do_voucher', description: 'Quantos dias o código ainda vale', example: '3' }
const VAR_VALOR = { name: 'valor', description: 'Valor em reais', example: 'R$ 69,00' }
const VAR_LOJA = { name: 'loja', description: 'Nome da loja', example: 'Mercado Livre' }
const VAR_OFERTAS = { name: 'ofertas_publicadas', description: 'Quantas ofertas o robô já publicou no teste', example: '47' }
const VAR_MENSAGENS = { name: 'mensagens_poupadas', description: 'Mensagens que a cliente não precisou digitar', example: '141' }
const VAR_GRUPOS = { name: 'grupos', description: 'Em quantos grupos as ofertas saíram', example: '3' }

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
    // D1/D2 do plano de ativação de 2026-09-08. O aviso com a prova já existia,
    // mas só DENTRO do painel — e a cliente cujo robô está funcionando não abre
    // o painel, justamente porque está tudo funcionando sozinho. Sai no
    // terceiro dia do teste, o único ponto em que não disputa espaço com a
    // contagem regressiva.
    slug: 'teste_prova_de_valor',
    name: 'Teste grátis: o que o robô já fez por você',
    description: 'Sai no 3º dia do teste, com o número de ofertas já publicadas. Só sai para quem já teve oferta publicada — sem isso não há prova nenhuma a mostrar.',
    group: 'conta',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 10,
    variables: [VAR_OFERTAS, VAR_MENSAGENS, VAR_GRUPOS, VAR_FIM_TESTE],
    title: 'O robô já publicou {{ofertas_publicadas}} ofertas para você',
    subject: 'Seu robô já publicou {{ofertas_publicadas}} ofertas — e você não digitou nenhuma',
    body: `{{saudacao}} Passando só para te mostrar o que aconteceu enquanto você tocava a sua vida.

Nestes primeiros dias de teste, o robô publicou **{{ofertas_publicadas}} ofertas** em {{grupos}} grupo(s). Isso são **{{mensagens_poupadas}} mensagens** que você não precisou copiar, colar nem converter uma por uma — cada uma com a sua etiqueta de afiliada, para a comissão ser sua.

Seu teste vai até {{fim_do_teste}}. Se quiser continuar, seus grupos, suas lojas e suas regras ficam do jeito que estão — escolher um plano só religa o envio.

[[botao:Continuar com o robô|{{link_planos}}]]

Se alguma oferta saiu diferente do que você esperava, responde aqui contando: dá para ajustar.`,
  },
  {
    // C5 do mesmo plano: 18 pessoas conectaram o WhatsApp e nunca cadastraram
    // loja. Sem etiqueta o robô se RECUSA a publicar, e do lado de fora isso
    // parece produto quebrado — o painel fica verde e nada chega no grupo.
    //
    // O texto de `contato_sem_etiqueta_nada_sai` (grupo "contato e escuta")
    // continua MANUAL de propósito: aquele grupo tem contrato de nunca disparar
    // sozinho. Este aqui é irmão dele, no grupo de saúde, e por isso herda a
    // trava de conta parada do despachante.
    slug: 'sem_loja_cadastrada',
    name: 'Conectou e não cadastrou nenhuma loja',
    description: 'Sai um dia depois de conectar o WhatsApp quando não há nenhuma loja cadastrada. Sem etiqueta o robô não publica nada.',
    group: 'saude',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 7,
    variables: [],
    title: 'Seu robô está pronto — falta cadastrar uma loja',
    subject: 'Falta um passo: sem a sua etiqueta o robô não publica nada',
    body: `{{saudacao}} Você já conectou o WhatsApp, que é a parte mais chata de todas. Só falta uma coisa.

Enquanto não houver nenhuma loja cadastrada, **o robô não publica nenhuma oferta**. E isso não é defeito: sem a sua etiqueta de afiliada, a comissão daquela venda iria para outra pessoa. Ele prefere não enviar a te fazer trabalhar de graça.

Uma loja só já resolve, e tem loja que pede só a sua etiqueta — leva menos de um minuto.

[[botao:Cadastrar minha primeira loja|{{link_lojas}}]]

Se preferir ver antes: {{video_etiquetas}} mostra o passo a passo de cada loja.

Se travar em algum passo, responde este e-mail que a gente faz junto com você.`,
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
  // Jornada de quem testou e não assinou: dias 3, 5 e 7 depois do fim do teste.
  // Até 2026-09-19 a conta recebia SÓ o aviso acima e nunca mais nada, com tudo
  // dela ainda guardado no sistema. Os dias, o espaçamento e o fim da jornada
  // moram em src/emailTriggers/expiredTrialJourney.js — aqui só o texto.
  //
  // Todos são de divulgação (quem não assinou não tem obrigação de serviço com
  // a gente): respeitam descadastro e levam o link de saída no rodapé.
  {
    slug: 'teste_acabou_lembrete',
    name: 'Teste acabou (lembrete)',
    description: 'Sai poucos dias depois do fim do teste grátis, para quem ainda não assinou.',
    group: 'conta',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 30,
    variables: [],
    title: 'Seus grupos estão parados',
    subject: 'Seus grupos estão sem oferta desde o fim do teste',
    body: `{{saudacao}} Faz alguns dias que seu teste acabou e o robô parou de publicar nos seus grupos.

Nesse tempo as promoções continuaram saindo nas lojas e nos grupos de onde você copia — só não chegaram nos seus. Cada uma era uma chance de comissão.

Assinando um plano, ele volta a trabalhar no mesmo minuto: seus grupos, suas etiquetas de afiliada e tudo que você configurou continuam salvos.

[[botao:Escolher meu plano|{{link_planos}}]]

E se alguma coisa não funcionou como você esperava no teste, responde este e-mail contando o que foi. A gente lê tudo — e conserta.`,
  },
  // O voucher chega no primeiro e é REPETIDO no segundo, com o prazo que sobrou.
  // O resgate é por conversa (responder o e-mail ou chamar no WhatsApp) de
  // propósito: é assim que a gente descobre o que travou a assinatura, que é a
  // informação que nenhum relatório dá. Por isso os dois levam o WhatsApp.
  {
    slug: 'teste_voucher',
    name: 'Voucher de desconto depois do teste',
    description: 'Sai cerca de cinco dias depois do fim do teste, com um código de desconto para assinar.',
    group: 'conta',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 60,
    variables: [VAR_VOUCHER, VAR_VOUCHER_DESCONTO, VAR_VOUCHER_ATE],
    title: 'Um desconto para o robô voltar',
    subject: 'Separei {{desconto_voucher}} de desconto para você voltar',
    body: `{{saudacao}} Seu teste acabou e o robô continua parado por aqui.

Para facilitar a sua volta, separei um desconto de **{{desconto_voucher}}** no seu plano:

**{{codigo_voucher}}**

O código vale até **{{voucher_vale_ate}}** e serve para qualquer plano. Para usar, é só responder este e-mail com ele ou chamar a gente no WhatsApp — a gente aplica o desconto e o robô volta a publicar no mesmo dia, com seus grupos e suas etiquetas do jeito que você deixou.

[[botao:Falar no WhatsApp|{{whatsapp_suporte}}]]

Se preferir ver os planos antes de decidir, estão todos aqui:

[[botao:Ver os planos|{{link_planos}}]]`,
  },
  {
    slug: 'teste_voucher_ultimos_dias',
    name: 'Voucher de desconto depois do teste (últimos dias)',
    description: 'Sai cerca de sete dias depois do fim do teste, repetindo o mesmo código e dizendo quanto prazo sobrou. É o último e-mail automático da jornada.',
    group: 'conta',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 60,
    variables: [VAR_VOUCHER, VAR_VOUCHER_DESCONTO, VAR_VOUCHER_ATE, VAR_VOUCHER_DIAS],
    title: 'Seu desconto está acabando',
    subject: 'Faltam {{dias_do_voucher}} dias para o seu desconto de {{desconto_voucher}}',
    body: `{{saudacao}} Passando só para lembrar do desconto que separei para você:

**{{codigo_voucher}}** — **{{desconto_voucher}}** de desconto no seu plano.

Faltam **{{dias_do_voucher}} dias** para ele expirar: vale até **{{voucher_vale_ate}}**.

Para usar, responde este e-mail com o código ou chama a gente no WhatsApp. A gente aplica o desconto e o robô volta a publicar as ofertas nos seus grupos no mesmo dia.

[[botao:Falar no WhatsApp|{{whatsapp_suporte}}]]

[[botao:Ver os planos|{{link_planos}}]]

Este é o último e-mail automático que eu te mando sobre isso — não quero virar mais um e-mail chato na sua caixa. Sua conta e tudo que você configurou continuam guardados, e a porta fica aberta quando você quiser voltar.`,
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
    description: 'Sai pouco mais de uma semana depois do vencimento, para quem não renovou.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 60,
    variables: [],
    title: 'Que tal voltar a vender no automático?',
    subject: 'Seus grupos estão sem oferta há mais de uma semana',
    body: `{{saudacao}} Faz mais de uma semana que o robô está parado por aqui.

Seus grupos, suas etiquetas de afiliada e todas as suas configurações continuam guardados. É só escolher um plano que ele volta a espelhar as ofertas no mesmo minuto — sem reconfigurar nada.

[[botao:Ligar o robô de novo|{{link_planos}}]]

Se você desistiu por algum motivo específico, responde este e-mail contando qual foi. A gente lê tudo.`,
  },
  // Os quatro abaixo completam a jornada de quem não renovou. A ordem, os dias
  // e o espaçamento moram em src/emailTriggers/expiredPlanJourney.js — aqui só
  // o texto. Todos são de divulgação: respeitam descadastro e levam o link no
  // rodapé, porque quem não quer mais ser chamada de volta tem que conseguir
  // sair sem perder os avisos da conta.
  {
    slug: 'plano_vencido_primeiros_dias',
    name: 'Vencido há alguns dias',
    description: 'Sai poucos dias depois do vencimento, para quem ainda não renovou.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 30,
    variables: [VAR_VENCIMENTO],
    title: 'Seus grupos estão parados',
    subject: 'Seus grupos estão sem oferta desde {{data_vencimento}}',
    body: `{{saudacao}} Seu plano venceu em **{{data_vencimento}}** e desde então o robô não publicou nenhuma oferta nos seus grupos.

Nesses dias as promoções continuaram acontecendo nas lojas e nos grupos de onde você copia — só não chegaram nos seus. Cada uma delas era uma chance de comissão.

Renovando, ele volta a trabalhar no mesmo minuto: seus grupos, suas etiquetas de afiliada e todas as suas configurações continuam salvas, do jeito que você deixou.

[[botao:Ligar o robô de novo|{{link_planos}}]]

Se o que travou foi o pagamento (cartão recusado, boleto que não fechou), me conta que a gente resolve junto — é só responder este e-mail.`,
  },
  // Os dois do voucher (dias 5 e 7 do vencimento). O código chega no primeiro e
  // é REPETIDO no segundo, com o prazo que sobrou — quem decidiu no fim da
  // semana não precisa procurar o e-mail antigo.
  //
  // O resgate é por conversa (responder o e-mail ou chamar no WhatsApp) de
  // propósito: é assim que a gente descobre o que travou a renovação, que é a
  // informação que nenhum relatório dá. Por isso os dois levam o WhatsApp.
  {
    slug: 'plano_vencido_voucher',
    name: 'Voucher de desconto para voltar',
    description: 'Sai cerca de cinco dias depois do vencimento, com um código de desconto para renovar.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 60,
    variables: [VAR_VENCIMENTO, VAR_VOUCHER, VAR_VOUCHER_DESCONTO, VAR_VOUCHER_ATE],
    title: 'Um desconto para o robô voltar',
    subject: 'Separei {{desconto_voucher}} de desconto para você voltar',
    body: `{{saudacao}} Seu plano venceu em **{{data_vencimento}}** e o robô continua parado por aqui.

Para facilitar a sua volta, separei um desconto de **{{desconto_voucher}}** no seu plano:

**{{codigo_voucher}}**

O código vale até **{{voucher_vale_ate}}** e serve para qualquer plano. Para usar, é só responder este e-mail com ele ou chamar a gente no WhatsApp — a gente aplica o desconto e o robô volta a publicar no mesmo dia, com seus grupos e suas etiquetas do jeito que você deixou.

[[botao:Falar no WhatsApp|{{whatsapp_suporte}}]]

Se preferir ver os planos antes de decidir, estão todos aqui:

[[botao:Ver os planos|{{link_planos}}]]`,
  },
  {
    slug: 'plano_vencido_voucher_ultimos_dias',
    name: 'Voucher de desconto (últimos dias)',
    description: 'Sai cerca de sete dias depois do vencimento, repetindo o mesmo código e dizendo quanto prazo sobrou.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 60,
    variables: [VAR_VENCIMENTO, VAR_VOUCHER, VAR_VOUCHER_DESCONTO, VAR_VOUCHER_ATE, VAR_VOUCHER_DIAS],
    title: 'Seu desconto está acabando',
    subject: 'Faltam {{dias_do_voucher}} dias para o seu desconto de {{desconto_voucher}}',
    body: `{{saudacao}} Passando só para lembrar do desconto que separei para você voltar:

**{{codigo_voucher}}** — **{{desconto_voucher}}** de desconto no seu plano.

Faltam **{{dias_do_voucher}} dias** para ele expirar: vale até **{{voucher_vale_ate}}**.

Para usar, responde este e-mail com o código ou chama a gente no WhatsApp. A gente aplica o desconto e o robô volta a publicar as ofertas nos seus grupos no mesmo dia.

[[botao:Falar no WhatsApp|{{whatsapp_suporte}}]]

[[botao:Ver os planos|{{link_planos}}]]

Se agora não for o momento, sem problema — seus grupos e suas configurações continuam guardados de qualquer forma.`,
  },
  {
    slug: 'plano_vencido_2_semanas',
    name: 'Vencido há 2 semanas',
    description: 'Sai duas semanas depois do vencimento, para quem ainda não renovou.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 30,
    variables: [],
    title: 'O que fez você parar?',
    subject: 'Duas semanas sem o robô — o que fez você parar?',
    body: `{{saudacao}} Faz cerca de duas semanas que seu plano venceu e o robô está parado.

A gente não sabe o motivo, e queria saber de verdade. Normalmente é uma destas três coisas:

- **O preço não fechou para o seu momento.** Responde este e-mail contando: dependendo do caso a gente consegue te ajudar a escolher um plano que caiba.
- **Alguma coisa não funcionou como você esperava.** Se foi isso, me conta o que aconteceu — é assim que o robô melhora.
- **Você só não teve tempo de renovar.** Aí é um clique e ele volta agora.

[[botao:Ver os planos|{{link_planos}}]]

Sua conta continua inteira aqui: grupos, etiquetas de afiliada e configurações não foram apagados.`,
  },
  {
    slug: 'plano_vencido_conta_guardada',
    name: 'Vencido: a conta continua guardada',
    description: 'Sai cerca de duas semanas e meia depois do vencimento, para quem ainda não renovou.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 30,
    variables: [],
    title: 'Sua conta continua guardada',
    subject: 'Sua conta ainda está guardada aqui',
    body: `{{saudacao}} O robô está parado por aqui faz um tempo, e eu passei só para dizer uma coisa: **nada foi apagado**.

Seus grupos de origem, seus grupos de destino, suas etiquetas de afiliada de cada loja e todas as suas configurações de envio continuam exatamente como você deixou. Se um dia você voltar, é escolher um plano e pronto — não tem nada para configurar de novo.

[[botao:Voltar a usar o robô|{{link_planos}}]]

E se você mudou de ideia sobre divulgar em grupos, tudo bem também. Só me conta o que aconteceu, respondendo este e-mail — ajuda muito a gente entender o que faltou.`,
  },
  {
    slug: 'plano_vencido_ultimo_aviso',
    name: 'Vencido: último e-mail da jornada',
    description: 'Último e-mail automático de recuperação, cerca de 40 dias depois do vencimento.',
    group: 'plano',
    category: 'marketing',
    trigger: 'auto',
    dedupDays: 30,
    variables: [],
    title: 'Este é o último e-mail sobre isso',
    subject: 'Último e-mail sobre o seu plano parado',
    body: `{{saudacao}} Este é o último e-mail automático que a gente manda sobre o seu plano parado. Não é ameaça nem prazo acabando — é só respeito pela sua caixa de entrada.

Sua conta continua no ar e sem nada apagado. Quando quiser, entra e escolhe um plano: o robô volta a espelhar as ofertas no mesmo minuto, com tudo que você já tinha configurado.

[[botao:Entrar na minha conta|{{link_login}}]]

Se quiser conversar antes de decidir — ou contar o que fez você parar — é só responder este e-mail ou chamar no WhatsApp {{whatsapp_suporte}}. A gente responde pessoalmente.

Obrigada por ter dado uma chance ao robô.`,
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

[[botao:Abrir minhas credenciais|{{link_lojas}}]]`,
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

[[botao:Abrir minhas credenciais|{{link_lojas}}]]`,
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
    description: 'Convite para indicar o Espelha Grupos e ganhar comissão.',
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
  // ------------------------------------------------------- plano (cobrança)
  {
    slug: 'cobranca_recusada',
    name: 'A cobrança automática não passou',
    description: 'Sai quando o Mercado Pago tenta cobrar a assinatura e o pagamento é recusado. É o plano B de cobrar: avisa ENQUANTO o acesso ainda vale.',
    group: 'plano',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 2,
    variables: [
      { name: 'plano', description: 'Plano da assinatura', example: 'Pro' },
      VAR_VALOR,
      { name: 'motivo', description: 'Por que a cobrança não passou, em linguagem de gente', example: 'Sem limite ou saldo no cartão.' },
      { name: 'o_que_fazer', description: 'O que a cliente precisa fazer (muda conforme o motivo)', example: 'Atualize o cartão da cobrança automática ou use outro.' },
      { name: 'vale_ate', description: 'Até quando o acesso atual continua valendo', example: '16/09/2026' },
    ],
    title: 'A cobrança do seu plano não passou',
    subject: 'A cobrança automática do seu plano não passou',
    body: `{{saudacao}} O Mercado Pago tentou cobrar **{{valor}}** do seu plano **{{plano}}** e a cobrança não passou.

**Por quê:** {{motivo}}

**O que fazer:** {{o_que_fazer}}

Seu robô continua trabalhando normalmente até **{{vale_ate}}** — dá tempo de resolver sem parar nada.

[[botao:Resolver agora|{{link_planos}}]]

Se ficar qualquer dúvida, é só responder este e-mail.`,
  },

  // ------------------------------------------------------------ interno
  //
  // Estes três não vão para cliente nenhuma. Existem porque toda falha de
  // pagamento é silenciosa por natureza: ninguém reclama de uma cobrança que
  // não aconteceu, e o dinheiro simplesmente deixa de entrar.
  {
    // B2 do plano de ativação de 2026-09-08. O funil separa "nem chegou a pedir
    // a conexão" de "tentou e NÃO conseguiu" porque o segundo é obstáculo
    // NOSSO — mas esse número só aparecia para quem abrisse o /admin/funil e
    // fosse procurar. Aviso que ninguém lê não é aviso.
    slug: 'admin_conexao_falhou',
    name: '[Interno] Gente que tentou conectar e não conseguiu',
    description: 'Avisa a administradora quando há contas que pediram a conexão do WhatsApp e continuam sem conectar depois de 24h. É obstáculo nosso, não desistência delas.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'resumo', description: 'Quantas pessoas estão nessa situação', example: '3 pessoas pediram a conexão do WhatsApp e não conseguiram' },
      { name: 'lista', description: 'Quem são, com há quanto tempo tentaram', example: '- Ana (ana@exemplo.com) — pediu a conexão há 30h e não conectou' },
    ],
    title: '{{resumo}}',
    subject: '[Interno] {{resumo}}',
    body: `{{resumo}} nas últimas 24h a 7 dias.

{{lista}}

Isso é obstáculo nosso, não desistência delas: leitura do QR, servidor sem vaga ou recusa do WhatsApp. Vale abrir o histórico de cada uma antes de qualquer ação de marketing.

Se várias caírem no mesmo dia, provavelmente é um incidente — confira os eventos de conexão daquelas datas.

[[botao:Abrir o funil|{{link_painel}}/admin/funil]]`,
  },
  {
    // As vagas de robô acabando. O sinal que já existia
    // (`ops_session_capacity_limit`) só nasce DEPOIS da primeira recusa —
    // quando alguma cliente já ficou sem conseguir conectar. Este chega antes.
    slug: 'admin_vagas_acabando',
    name: '[Interno] Estão acabando as vagas de robô',
    description: 'Avisa a administradora quando faltam poucas vagas para o servidor parar de aceitar robô novo. Cliente nova não consegue conectar quando acaba.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'resumo', description: 'Quantos robôs estão ligados e quantos cabem', example: '18 robôs ligados de 20 que cabem' },
      { name: 'situacao', description: 'O que acontece agora', example: 'Sobram 2 vagas.' },
      { name: 'link_capacidade', description: 'Endereço da aba Capacidade do admin', example: 'https://espelhagrupos.com.br/admin/capacidade' },
    ],
    title: 'Estão acabando as vagas de robô',
    subject: '[BOTinho] {{resumo}}',
    body: `{{resumo}}.

{{situacao}}

Quando acabam as vagas, **cliente nova não consegue conectar** e quem desligou o próprio robô não consegue voltar.

O que dá para fazer: desligar o staging enquanto não estiver validando, ou aumentar o servidor. Cada robô ocupa cerca de 272 MB.

[[botao:Ver a capacidade do servidor|{{link_capacidade}}]]`,
  },
  {
    slug: 'admin_cobranca_recusada',
    name: '[Interno] Uma cobrança foi recusada',
    description: 'Avisa a administradora quando a cobrança de uma assinatura é recusada, com cliente, valor e o código que o Mercado Pago devolveu.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'cliente', description: 'E-mail da cliente', example: 'cliente@exemplo.com' },
      { name: 'plano', description: 'Plano da assinatura', example: 'Pro' },
      VAR_VALOR,
      { name: 'codigo', description: 'Código de retorno do Mercado Pago', example: 'cc_rejected_insufficient_amount' },
      { name: 'motivo', description: 'O que o código significa e de quem é a ação', example: 'Sem limite ou saldo. Ação dela: outro cartão.' },
      { name: 'quando', description: 'Quando a cobrança foi tentada', example: '08/09/2026 09:12' },
      { name: 'link_cobrancas', description: 'Endereço da aba Financeiro do admin', example: 'https://espelhagrupos.com.br/admin' },
    ],
    title: 'Cobrança recusada',
    subject: '[BOTinho] Cobrança recusada — {{cliente}}',
    body: `A cobrança da assinatura de **{{cliente}}** foi recusada.

[[lista]]
Plano: {{plano}}
Valor: {{valor}}
Quando: {{quando}}
Código do Mercado Pago: {{codigo}}
O que significa: {{motivo}}
[[/lista]]

A cliente já foi avisada por e-mail, com o que ela precisa fazer.

[[botao:Ver todas as cobranças|{{link_cobrancas}}]]`,
  },
  {
    slug: 'admin_cobranca_maquina_parada',
    name: '[Interno] A máquina de cobrança tem problema',
    description: 'Avisa a administradora quando a cobrança para de funcionar em silêncio: chave errada, avisos do Mercado Pago não chegando, rede de segurança parada ou recusa em série.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'resumo', description: 'Frase do estado geral', example: 'A cobrança tem problema agora.' },
      { name: 'problemas', description: 'Lista do que está errado e o que fazer', example: 'A chave em uso é de TESTE — nenhum cartão real é aceito.' },
      { name: 'link_cobrancas', description: 'Endereço da aba Financeiro do admin', example: 'https://espelhagrupos.com.br/admin' },
    ],
    title: 'A cobrança precisa de atenção',
    subject: '[BOTinho] A cobrança precisa de atenção',
    body: `{{resumo}}

{{problemas}}

[[botao:Abrir o Financeiro|{{link_cobrancas}}]]

Este aviso sai no máximo uma vez por dia para cada problema.`,
  },
  {
    slug: 'admin_api_com_erro',
    name: '[Interno] O painel está falhando por erro nosso',
    description: 'Avisa a administradora quando a API passa a falhar por incompatibilidade entre o código e o banco — o tipo de erro que derruba o painel inteiro, não uma tela só.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'o_que_aconteceu', description: 'O tipo do problema, em uma frase', example: 'O código e o banco discordam sobre alguma coluna.' },
      { name: 'onde', description: 'A chamada que falhou', example: 'GET /api/auth/me' },
      { name: 'detalhe', description: 'Mensagem técnica do erro', example: 'Unknown field `blockedReason`' },
      { name: 'quando', description: 'Quando aconteceu', example: '09/09/2026 18:20' },
    ],
    title: 'O painel está falhando',
    subject: '[BOTinho] O painel está falhando por erro nosso',
    body: `Uma chamada do painel falhou por erro nosso, não por algo que a cliente fez.

[[lista]]
O que aconteceu: {{o_que_aconteceu}}
Onde: {{onde}}
Detalhe: {{detalhe}}
Quando: {{quando}}
[[/lista]]

Este aviso só sai para erro grave, do tipo que costuma afetar todas as contas ao mesmo tempo. Vale conferir agora se o painel abre.

Este aviso sai no máximo uma vez por dia para cada tipo de problema.`,
  },
  {
    slug: 'admin_numero_repetido',
    name: '[Interno] Número de WhatsApp já usado em outra conta',
    description: 'Avisa a administradora quando uma conta liga um número de WhatsApp que já foi ligado por outra conta. É aviso para conferir; a recusa automática só acontece se a trava estiver ligada.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'cliente', description: 'E-mail da conta que acabou de ligar', example: 'novaconta@exemplo.com' },
      { name: 'contas_anteriores', description: 'Contas que já usaram este número', example: 'contaantiga@exemplo.com' },
      { name: 'o_que_aconteceu', description: 'Se a conexão foi recusada ou só registrada', example: 'A conexão foi permitida (modo aviso)' },
      { name: 'quando', description: 'Quando aconteceu', example: '09/09/2026 15:40' },
    ],
    title: 'Um número de WhatsApp está em mais de uma conta',
    subject: '[BOTinho] Número de WhatsApp repetido entre contas',
    body: `Uma conta acabou de ligar um número de WhatsApp que já tinha sido ligado por outra conta.

[[lista]]
Conta atual: {{cliente}}
Contas que já usaram este número: {{contas_anteriores}}
O que aconteceu: {{o_que_aconteceu}}
Quando: {{quando}}
[[/lista]]

Número repetido não é prova de nada sozinho: a mesma pessoa pode ter trocado de chip, ou ter uma conta antiga abandonada. Vale abrir o histórico das duas contas antes de decidir qualquer coisa.

A etiqueta também aparece nas listas de clientes, na aba Online e na fila de Sucesso do Cliente.

Este aviso sai no máximo uma vez por dia para cada conta.`,
  },
  {
    slug: 'admin_teste_repetido',
    name: '[Interno] Cadastro parece repetir o teste grátis',
    description: 'Avisa a administradora quando nasce uma conta com o mesmo nome ou a mesma raiz de e-mail de outra que já teve teste. É aviso para conferir, nunca bloqueio automático.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'cliente', description: 'E-mail da conta nova', example: 'novaconta@exemplo.com' },
      { name: 'nome', description: 'Nome informado no cadastro novo', example: 'Fulana de Tal' },
      { name: 'motivo', description: 'O que casou', example: 'mesma raiz de e-mail' },
      { name: 'contas_anteriores', description: 'Contas anteriores parecidas', example: 'contaantiga@exemplo.com' },
      { name: 'quando', description: 'Quando o cadastro aconteceu', example: '09/09/2026 10:20' },
    ],
    title: 'Um cadastro novo parece repetir o teste',
    subject: '[BOTinho] Cadastro parece repetir o teste grátis',
    body: `Uma conta nova se cadastrou e parece ser de alguém que já fez o teste.

[[lista]]
Conta nova: {{cliente}}
Nome: {{nome}}
O que casou: {{motivo}}
Contas anteriores parecidas: {{contas_anteriores}}
Quando: {{quando}}
[[/lista]]

Isto é só um aviso para você conferir. Nada foi bloqueado e a conta nova está funcionando normalmente.

Nome repetido acontece, e a mesma pessoa pode ter recadastrado por ter perdido a senha ou errado o e-mail. Vale olhar o histórico das duas contas antes de decidir qualquer coisa.

Este aviso sai no máximo uma vez por dia para cada cadastro.`,
  },
  {
    slug: 'admin_pagamento_com_falha',
    name: '[Interno] Falha ao processar um pagamento',
    description: 'Avisa a administradora quando um aviso de pagamento do Mercado Pago não pôde ser processado por erro nosso — é o caso em que a cliente pagou e o acesso pode não ter sido liberado.',
    group: 'interno',
    audience: 'admin',
    category: 'transactional',
    trigger: 'auto',
    dedupDays: 0,
    variables: [
      { name: 'o_que_falhou', description: 'Qual etapa falhou', example: 'Liberar o acesso depois do pagamento aprovado' },
      { name: 'detalhe', description: 'Detalhe técnico do erro', example: 'SQLITE_BUSY: database is locked' },
      { name: 'cliente', description: 'Cliente afetada, quando dá para saber', example: 'cliente@exemplo.com' },
      { name: 'quando', description: 'Quando aconteceu', example: '08/09/2026 09:12' },
      { name: 'link_cobrancas', description: 'Endereço da aba Financeiro do admin', example: 'https://espelhagrupos.com.br/admin' },
    ],
    title: 'Um pagamento não foi processado',
    subject: '[BOTinho] Falha ao processar pagamento — conferir',
    body: `Um aviso de pagamento do Mercado Pago não pôde ser processado.

[[lista]]
Etapa: {{o_que_falhou}}
Cliente: {{cliente}}
Quando: {{quando}}
Detalhe: {{detalhe}}
[[/lista]]

**Isso pode significar cliente que pagou e ficou sem acesso.** A conferência automática tenta de novo na próxima passada; se o aviso se repetir, é caso de olhar na mão.

[[botao:Abrir o Financeiro|{{link_cobrancas}}]]`,
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
