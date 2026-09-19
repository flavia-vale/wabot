import './landing.css'
import Link from 'next/link'
import Footer from '@/components/landing/Footer'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'
import { getEditorialDates } from '@/lib/editorial-content'
import { buildSeoRobots } from '@/lib/seo-registry.mjs'
import { DEFAULT_LANDING_PLANS, SUPPORTED_STORES } from '@/lib/marketing-content'

const siteUrl = getSiteUrl()
const registerHref = '/login?mode=register&utm_source=seo&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=sprint2'
const mainLandingHref = '/bot-canais-whatsapp'
const diagnosticHref = '/diagnostico-antiban-whatsapp'
const checklistHref = '/materiais/checklist-antiban-whatsapp'
const riskCalculatorHref = '/ferramentas/calculadora-risco-whatsapp'

export const PRESERVATION_COMMERCIAL_PAGES = {
  /* Frente Tier 1 (PLANO_ACAO_SEO_IA_2026-09-01, ação 9). "shopee afiliados" tem
   * 50.000 buscas/mês com concorrência BAIXA — o maior volume do levantamento
   * inteiro, e a Shopee é a primeira do Trends (Shopee >> ML > Amazon > Magalu).
   *
   * Já existe /blog/como-ser-afiliado-shopee-whatsapp ("Shopee Afiliados: como
   * entrar e quanto paga"), e ela NÃO é substituída nem duplicada aqui — as duas
   * respondem intenções diferentes, e é isso que evita a canibalização que já
   * custou clique nas páginas de achadinhos (seção 2 do plano):
   *
   *   blog     -> quem AINDA NÃO é afiliada: como entrar, quanto paga, prazo.
   *   esta     -> quem JÁ é afiliada e precisa distribuir a oferta sem copiar
   *               e colar. Intenção transacional, destino comercial.
   *
   * As duas se linkam explicitamente, em `related`, para o Google saber qual
   * responde o quê.
   *
   * UMA página, não treze. O Promium ocupa esse eixo com 13 páginas de
   * "Automação <loja> para WhatsApp", mas a lição da ação 8 é fresca: dez LPs de
   * dor com ~1.100 chars cada estão em "rastreada, mas não indexada", e quatro
   * caíram do índice. Página em série fina é justamente o que o Google recusa.
   * Amazon e Mercado Livre só entram DEPOIS de esta provar que indexa e ranqueia.
   */
  'shopee-afiliados-whatsapp': {
    path: '/shopee-afiliados-whatsapp',
    title: 'Shopee Afiliados: divulgar no WhatsApp sem copiar',
    description: 'Já é afiliada Shopee? Veja como publicar suas ofertas em vários grupos e canais do WhatsApp com o seu link, sem copiar e colar oferta por oferta. 7 dias grátis.',
    eyebrow: 'Shopee Afiliados',
    h1: 'Shopee Afiliados: como divulgar suas ofertas no WhatsApp sem copiar e colar',
    lead: 'Depois de entrar no Shopee Afiliados, o trabalho deixa de ser achar oferta e passa a ser publicar. Cada produto precisa virar link com o seu código, o texto precisa ser montado, e tudo isso repetido em cada grupo. O Espelha Grupos faz esse caminho sozinho: acompanha as origens que você escolhe, troca o link pelo seu e publica nos seus destinos, com intervalo entre os envios e registro do que saiu.',
    intent: 'shopee afiliados whatsapp',
    related: [
      { href: '/seguranca-credenciais-afiliado', label: 'O que fazemos com a chave da Shopee', note: 'Onde ela fica, para que serve e como apagar quando quiser.' },
      { href: '/clonar-mensagens-de-grupo-de-afiliados', label: 'O que significa clonar um grupo de ofertas', note: 'A mensagem sai como publicação sua, com o seu link.' },
      { href: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande', label: 'Ainda não tem grupo grande?', note: 'O que dá para fazer com poucos contatos, sem esperar audiência chegar.' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Ainda não é afiliada Shopee?', note: 'Cadastro gratuito, quanto a Shopee paga por tipo de venda e o prazo de atribuição.' },
      { href: '/quanto-ganha-afiliado-shopee', label: 'Quanto ganha um afiliado Shopee', note: 'A tabela de comissão, o prazo de atribuição e como fazer a sua própria conta.' },
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'O caminho completo: origens, conversão de link, destinos e histórico.' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual paga mais', note: 'Comissão e prazo de atribuição das três lado a lado, com fonte e data.' },
      { href: '/shein-afiliados-whatsapp', label: 'Divulga SHEIN também?', note: 'O link sai encurtado pela própria loja, já com a sua identidade.' },
      { href: '/magalu-afiliados-whatsapp', label: 'Divulga Magalu também?', note: 'O código de parceiro entra em qualquer endereço da loja, inclusive cupom.' },
    ],
    about: ['Shopee Afiliados', 'Link de afiliado', 'Grupos de WhatsApp'],
    decisionQA: [
      {
        q: 'Já sou afiliada Shopee. O que isso resolve?',
        a: 'A parte que consome o dia: pegar a oferta, gerar o link com o seu código, montar a mensagem e repetir isso em cada grupo. O robô acompanha as origens que você escolher, converte o link para o seu e publica nos seus grupos e canais, um a um, com intervalo entre os envios.',
      },
      {
        q: 'Funciona com cupom da Shopee, ou só com link de produto?',
        a: 'Com os dois. Isso importa mais na Shopee do que nas outras lojas, porque muita oferta só fecha no preço anunciado com o cupom aplicado — tirar o cupom da mensagem quebra a oferta. O link de campanha também sai com o seu código.',
      },
      {
        q: 'Preciso de programação, API ou n8n?',
        a: 'Não. Você conecta o WhatsApp lendo um QR, escolhe de quais grupos as ofertas vêm e para quais grupos ou canais elas vão, e pronto. Não há código, integração para montar nem servidor para manter.',
      },
      {
        q: 'Quanto custa?',
        a: 'Sete dias grátis, sem cartão, com o plano Pro completo. Depois, plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias. O Pro acrescenta Canais do WhatsApp e as ofertas automáticas da Shopee por palavra-chave. Sem fidelidade.',
      },
    ],
    aside: {
      pill: 'O que a Shopee tem de diferente',
      title: 'Na Shopee, a chave recusada para a oferta inteira — não só encurta o link.',
      body: 'Nas outras lojas, credencial vencida faz o link sair mais comprido e a comissão continua sendo sua. Na Shopee não: sem chave aceita, a conversão falha e a oferta não é publicada. Por isso o painel avisa em verde ou vermelho o estado da sua chave, e você recebe e-mail quando ela para de ser aceita.',
    },
    primaryCta: 'Testar 7 dias grátis',
    secondaryCta: 'Ver como funciona a operação',
    problemTitle: 'O gargalo de quem já é afiliada Shopee não é achar oferta.',
    problem: 'É publicar. A oferta boa aparece, você gera o link, monta o texto, cola no primeiro grupo, no segundo, no terceiro. Quando chega no último, o preço já mudou. E nesse caminho manual três coisas acontecem sempre: link que escapa sem o seu código e paga comissão para outra pessoa, a mesma oferta publicada duas vezes no mesmo grupo, e tudo saindo de uma vez porque só sobrou aquela janela do dia.',
    bullets: ['Cada link de produto ou cupom da Shopee sai com o seu código de afiliada, convertido antes do envio.', 'A mesma oferta não sai duas vezes no mesmo grupo: a repetição é bloqueada e fica registrada.', 'Publicação espaçada em vez de tudo de uma vez, com limite por destino.', 'Histórico do que saiu, para onde e o que foi bloqueado — inclusive quando a chave da Shopee para de ser aceita.'],
    process: ['Cadastre a sua chave de afiliada da Shopee no painel (App ID e chave secreta).', 'Escolha de quais grupos ou canais as ofertas vêm e para quais destinos elas vão.', 'Defina o intervalo entre envios e o limite por destino conforme o tamanho da sua operação.', 'Acompanhe no histórico o que saiu, o que foi bloqueado por repetição e o que falhou na conversão.'],
    faqs: [
      ['Isso substitui o meu cadastro no Shopee Afiliados?', 'Não. O programa continua sendo da Shopee e a comissão é paga por ela, direto para você. O que muda é a distribuição: em vez de copiar e colar oferta por oferta, o robô publica com o seu link já aplicado.'],
      ['E se a conversão do link falhar?', 'A oferta não é publicada. É deliberado: encaminhar o link original significaria dar a sua comissão para o afiliado do grupo de origem, que normalmente é um concorrente. Melhor não enviar do que enviar pagando para outra pessoa — e a falha aparece no histórico com o motivo.'],
      ['Posso divulgar em Canais do WhatsApp, não só em grupos?', 'Pode, no plano Pro. Grupo e canal têm papéis diferentes: o grupo funciona como comunidade e como origem de ofertas, o canal como vitrine. Dá para usar os dois juntos.'],
      ['Isso é "anti-ban"?', 'Não como promessa. Nenhuma ferramenta controla a decisão do WhatsApp, e quem garante banimento zero está vendendo o que não pode entregar. O que existe é controle do que está sob controle: intervalo entre envios, limite por destino, variação de texto e horários de descanso.'],
      ['Preciso de grupo grande para valer a pena?', 'Não. O ganho é de tempo e de comissão que deixa de se perder no caminho, e isso vale desde o primeiro grupo. Volume grande muda a conta, não a lógica.'],
      ['Dá para divulgar outras lojas além da Shopee?', 'Dá. Amazon, Mercado Livre, Magalu, SHEIN e AliExpress entram no mesmo plano de entrada, sem custo a mais por loja. São seis lojas no total. Se você divulga mais de uma, vale comparar pelo plano que cobre todas.'],
    ],
  },
  /* Segunda loja da frente Tier 1 (ver o comentário em shopee-afiliados-whatsapp).
   * Mercado Livre é o segundo do Trends. Assim como na Shopee, NÃO substitui o
   * artigo de blog — o blog responde "quanto paga e como entrar", esta responde
   * "já sou afiliada, como distribuo". As duas se linkam.
   *
   * O `aside` usa o fato que é só do ML: o RCA de 2026-08-15, em que endereço de
   * anúncio montado por nós ia ao ar quebrado. É verdade verificável e útil para
   * a afiliada, não argumento de venda. */
  'mercado-livre-afiliados-whatsapp': {
    path: '/mercado-livre-afiliados-whatsapp',
    title: 'Afiliado Mercado Livre: divulgar no WhatsApp',
    description: 'Já é afiliada do Mercado Livre? Veja como publicar suas ofertas em vários grupos e canais do WhatsApp com o seu link, sem copiar e colar oferta por oferta.',
    eyebrow: 'Mercado Livre Afiliados',
    h1: 'Afiliado do Mercado Livre: como divulgar suas ofertas no WhatsApp sem copiar e colar',
    lead: 'Depois de entrar no programa de afiliados do Mercado Livre, o trabalho vira publicação: gerar o link com o seu código, montar o texto e repetir em cada grupo. O Espelha Grupos acompanha as origens que você escolher, troca o link pelo seu e publica nos seus destinos, com intervalo entre os envios e histórico do que saiu.',
    intent: 'mercado livre afiliados whatsapp',
    related: [
      { href: '/blog/migrar-grupo-achadinhos-para-canal', label: 'Levar o grupo para o Canal sem perder ninguém', note: 'O Canal alcança mais e ninguém responde por cima da oferta.' },
      { href: '/grupo-para-canal-whatsapp', label: 'Grupo ou Canal: qual usar', note: 'O que muda no alcance e em quem pode responder.' },
      { href: '/blog/como-escalar-grupos-sem-operacao-manual', label: 'Quando o trabalho manual deixa de caber', note: 'O sinal de que a operação passou do ponto de fazer na mão.' },
      { href: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp', label: 'Ainda não é afiliada do Mercado Livre?', note: 'Comissão por categoria, prazo de pagamento e como não perder a atribuição.' },
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'Origens, conversão de link, destinos e histórico de envio.' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual paga mais', note: 'As três lado a lado, com fonte e data.' },
    ],
    about: ['Mercado Livre Afiliados', 'Link de afiliado', 'Grupos de WhatsApp'],
    decisionQA: [
      {
        q: 'Já sou afiliada do Mercado Livre. O que isso resolve?',
        a: 'A parte repetitiva: pegar a oferta, gerar o link com o seu código, montar a mensagem e repetir em cada grupo. O robô acompanha as origens que você escolher, converte o link e publica nos seus grupos e canais, com intervalo entre os envios.',
      },
      {
        q: 'O link de catálogo e o de anúncio funcionam igual?',
        a: 'O Mercado Livre tem os dois formatos e eles não são a mesma coisa. A conversão reconhece cada um e usa o caminho certo para creditar você. Quando não é possível converter com segurança, a oferta não é publicada — e isso aparece no histórico com o motivo.',
      },
      {
        q: 'Preciso de programação, API ou n8n?',
        a: 'Não. Você conecta o WhatsApp lendo um QR, escolhe de quais grupos as ofertas vêm e para quais grupos ou canais elas vão. Não há código, integração para montar nem servidor para manter.',
      },
      {
        q: 'Quanto custa?',
        a: 'Sete dias grátis, sem cartão, com o plano Pro completo. Depois, plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias. Sem fidelidade.',
      },
    ],
    aside: {
      pill: 'O cuidado que é só do Mercado Livre',
      title: 'Endereço montado por nós nunca é publicado.',
      body: 'Um link de anúncio do Mercado Livre montado a partir do código do produto pode apontar para uma página que não existe — a cliente clica e vê "esta página não existe". Quando a conversão falha, a oferta simplesmente não sai, em vez de sair com um endereço quebrado. Isso veio de um caso real e virou regra no código.',
    },
    primaryCta: 'Testar 7 dias grátis',
    secondaryCta: 'Ver como funciona a operação',
    problemTitle: 'O gargalo de quem já é afiliada do Mercado Livre não é achar oferta.',
    problem: 'É publicar. Você acha a oferta boa, gera o link, monta o texto, cola no primeiro grupo, no segundo, no terceiro. Quando chega no último, o preço mudou. E no caminho manual três coisas acontecem sempre: link que escapa sem o seu código e paga comissão para outra pessoa, a mesma oferta publicada duas vezes no mesmo grupo, e tudo saindo de uma vez porque só sobrou aquela janela.',
    bullets: ['Cada link de produto do Mercado Livre sai com o seu código, convertido antes do envio.', 'A mesma oferta não sai duas vezes no mesmo grupo: a repetição é bloqueada e fica registrada.', 'Publicação espaçada em vez de tudo de uma vez, com limite por destino.', 'Histórico do que saiu, para onde e o que foi bloqueado ou falhou na conversão.'],
    process: ['Cadastre o seu código de afiliada do Mercado Livre no painel.', 'Escolha de quais grupos ou canais as ofertas vêm e para quais destinos elas vão.', 'Defina o intervalo entre envios e o limite por destino conforme o tamanho da sua operação.', 'Acompanhe no histórico o que saiu, o que foi bloqueado por repetição e o que falhou na conversão.'],
    faqs: [
      ['Isso substitui o meu cadastro no programa do Mercado Livre?', 'Não. O programa continua sendo do Mercado Livre e a comissão é paga por ele, direto para você. O que muda é a distribuição.'],
      ['E o link de cupom do Mercado Livre?', 'O link de produto é o caso coberto. Para campanha e cupom do Mercado Livre, o mecanismo de crédito é diferente do das outras lojas e não afirmamos que funciona — preferimos dizer isso a prometer comissão que talvez não caia.'],
      ['E se a conversão falhar?', 'A oferta não é publicada. Encaminhar o link original daria a sua comissão para o afiliado do grupo de origem, que costuma ser um concorrente. Melhor não enviar do que enviar pagando para outra pessoa.'],
      ['Isso é "anti-ban"?', 'Não como promessa. Nenhuma ferramenta controla a decisão do WhatsApp. O que existe é controle do que está sob controle: intervalo entre envios, limite por destino e variação de texto.'],
      ['Dá para divulgar outras lojas junto?', 'Dá. Shopee, Amazon e Magalu entram no mesmo plano de entrada, sem custo a mais por loja.'],
    ],
  },
  /* Terceira loja da frente Tier 1. O `aside` usa o RCA de 2026-07: o link curto
   * da Amazon nascia SEM a tag, a oferta saía bonita e a comissão não caía —
   * ficou sete dias assim antes de alguém perceber. É o alerta mais útil que
   * temos para uma afiliada Amazon, e é verdade nossa, verificada. */
  'amazon-afiliados-whatsapp': {
    path: '/amazon-afiliados-whatsapp',
    title: 'Afiliado Amazon: divulgar ofertas no WhatsApp',
    description: 'Já é afiliada Amazon? Veja como publicar suas ofertas em vários grupos e canais do WhatsApp com a sua tag, sem copiar e colar oferta por oferta. 7 dias grátis.',
    eyebrow: 'Amazon Associados',
    h1: 'Afiliado Amazon: como divulgar suas ofertas no WhatsApp sem copiar e colar',
    lead: 'Depois de entrar no Amazon Associados, o trabalho vira publicação: gerar o link com a sua tag, montar o texto e repetir em cada grupo. O Espelha Grupos acompanha as origens que você escolher, troca o link pelo seu e publica nos seus destinos, com intervalo entre os envios e histórico do que saiu.',
    intent: 'afiliado amazon whatsapp',
    related: [
      { href: '/confiabilidade-sessao-whatsapp', label: 'O que acontece quando o WhatsApp cai', note: 'Como o robô se recupera sozinho, sem você precisar reconectar.' },
      { href: '/bot-canal-whatsapp', label: 'Publicar em Canal do WhatsApp', note: 'Alcança mais gente e ninguém responde por cima da oferta.' },
      { href: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp', label: 'Amazon, Shopee ou Mercado Livre: qual paga mais', note: 'A comissão muda muito por categoria — compare a sua antes de decidir.' },
      { href: '/blog/como-divulgar-ofertas-amazon-whatsapp', label: 'Ainda não é afiliada Amazon?', note: 'Comissão por categoria, de 0% a 13% conforme o produto.' },
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'Origens, conversão de link, destinos e histórico de envio.' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual paga mais', note: 'As três lado a lado, com fonte e data.' },
    ],
    about: ['Amazon Associados', 'Link de afiliado', 'Grupos de WhatsApp'],
    decisionQA: [
      {
        q: 'Já sou afiliada Amazon. O que isso resolve?',
        a: 'A parte repetitiva: pegar a oferta, gerar o link com a sua tag, montar a mensagem e repetir em cada grupo. O robô acompanha as origens que você escolher, converte o link e publica nos seus grupos e canais, com intervalo entre os envios.',
      },
      {
        q: 'A tag vai mesmo no link curto?',
        a: 'Vai — e esse é o detalhe que mais custa caro na Amazon. Um link curto pode nascer sem a tag: ele funciona, abre o produto, a pessoa compra e a comissão não é sua. Aqui a tag entra no endereço antes de o link ser encurtado, para não existir versão sem ela.',
      },
      {
        q: 'Preciso de programação, API ou n8n?',
        a: 'Não. Você conecta o WhatsApp lendo um QR, escolhe de quais grupos as ofertas vêm e para quais grupos ou canais elas vão. Não há código, integração para montar nem servidor para manter.',
      },
      {
        q: 'Quanto custa?',
        a: 'Sete dias grátis, sem cartão, com o plano Pro completo. Depois, plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias. Sem fidelidade.',
      },
    ],
    aside: {
      pill: 'O erro que mais custa caro na Amazon',
      title: 'Link curto sem a tag funciona igual — e não paga nada.',
      body: 'É o pior tipo de perda, porque não dá sinal nenhum: a oferta sai bonita, o link abre o produto certo, a pessoa compra e a comissão vai para o vazio. Ninguém reclama, nada aparece no painel, e você só descobre quando olha o relatório da Amazon e vê zero clique atribuído. A tag precisa estar no endereço antes do encurtamento — depois não dá para consertar.',
    },
    primaryCta: 'Testar 7 dias grátis',
    secondaryCta: 'Ver como funciona a operação',
    problemTitle: 'O gargalo de quem já é afiliada Amazon não é achar oferta.',
    problem: 'É publicar sem perder comissão no caminho. Você acha a oferta, gera o link, monta o texto e repete em cada grupo. Nesse caminho manual três coisas acontecem: link que sai sem a sua tag e não paga nada, a mesma oferta publicada duas vezes no mesmo grupo, e tudo saindo de uma vez porque só sobrou aquela janela do dia.',
    bullets: ['Cada link de produto ou cupom da Amazon sai com a sua tag, aplicada antes do encurtamento.', 'A mesma oferta não sai duas vezes no mesmo grupo: a repetição é bloqueada e fica registrada.', 'Publicação espaçada em vez de tudo de uma vez, com limite por destino.', 'Histórico do que saiu, para onde e o que foi bloqueado ou falhou na conversão.'],
    process: ['Cadastre a sua tag de associada Amazon no painel.', 'Escolha de quais grupos ou canais as ofertas vêm e para quais destinos elas vão.', 'Defina o intervalo entre envios e o limite por destino conforme o tamanho da sua operação.', 'Acompanhe no histórico o que saiu, o que foi bloqueado por repetição e o que falhou na conversão.'],
    faqs: [
      ['Isso substitui o meu cadastro no Amazon Associados?', 'Não. O programa continua sendo da Amazon e a comissão é paga por ela, direto para você. O que muda é a distribuição.'],
      ['Funciona com cupom da Amazon, ou só com produto?', 'Com os dois. O link de campanha e de cupom também sai com a sua tag, o que importa quando o preço anunciado só fecha com o cupom aplicado.'],
      ['E se a conversão falhar?', 'A oferta não é publicada. Encaminhar o link original daria a sua comissão para o afiliado do grupo de origem. Melhor não enviar do que enviar pagando para outra pessoa.'],
      ['Isso é "anti-ban"?', 'Não como promessa. Nenhuma ferramenta controla a decisão do WhatsApp. O que existe é controle do que está sob controle: intervalo entre envios, limite por destino e variação de texto.'],
      ['Dá para divulgar outras lojas junto?', 'Dá. Shopee, Mercado Livre e Magalu entram no mesmo plano de entrada, sem custo a mais por loja.'],
    ],
  },
  /* Frente Tier 1 — Magalu. LINHA REABERTA em 2026-09-02 por decisão explícita
   * da dona do produto: o congelamento vinha do Trends (único marketplace da
   * lista em queda) e era argumento de prioridade, não de correção. A guarda
   * FR-033 em test/marketing-limites-que-nao-se-cruzam.test.js passou a aceitar
   * ESTA rota e só ela — não foi apagada. Ver a nota no AGENTS.md.
   *
   * O Magalu é o caso mais simples de todos: o código vale em qualquer endereço
   * da loja, cupom e campanha inclusive, e o `aside` usa exatamente isso. É um
   * diferencial real e verificável, e é honesto dizê-lo aqui porque nas outras
   * lojas essa parte NÃO é garantida. */
  'magalu-afiliados-whatsapp': {
    path: '/magalu-afiliados-whatsapp',
    title: 'Divulgador Magalu: publicar ofertas no WhatsApp',
    description: 'Já é divulgadora do Magalu? Veja como publicar suas ofertas em vários grupos e canais do WhatsApp com o seu código, sem copiar e colar oferta por oferta.',
    eyebrow: 'Divulgador Magalu',
    h1: 'Divulgador Magalu: como publicar suas ofertas no WhatsApp sem copiar e colar',
    lead: 'Depois de entrar no programa de divulgação do Magalu, o trabalho vira publicação: aplicar o seu código no link, montar o texto e repetir em cada grupo. O Espelha Grupos acompanha as origens que você escolher, troca o link pelo seu e publica nos seus destinos, com intervalo entre os envios e histórico do que saiu.',
    intent: 'divulgador magalu whatsapp',
    related: [
      { href: '/confiabilidade-sessao-whatsapp', label: 'O que acontece quando o WhatsApp cai', note: 'Como o robô se recupera sozinho e o que você vê no painel.' },
      { href: '/bot-canal-whatsapp', label: 'Publicar em Canal do WhatsApp', note: 'Alcança mais gente e ninguém responde por cima da oferta.' },
      { href: '/glossario', label: 'Glossário: os termos que aparecem no painel', note: 'Espelhamento, cadência, conversão de link e o resto, em português claro.' },
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'Origens, conversão de link, destinos e histórico de envio.' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual paga mais', note: 'Comparação de comissão entre os programas, com fonte e data.' },
      { href: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp', label: 'Como a conversão de link funciona', note: 'O que acontece com o link entre a origem e o seu grupo.' },
    ],
    about: ['Divulgador Magalu', 'Link de afiliado', 'Grupos de WhatsApp'],
    decisionQA: [
      {
        q: 'Já sou divulgadora Magalu. O que isso resolve?',
        a: 'A parte repetitiva: pegar a oferta, aplicar o seu código no link, montar a mensagem e repetir em cada grupo. O robô acompanha as origens que você escolher, converte o link e publica nos seus grupos e canais.',
      },
      {
        q: 'Cupom do Magalu também é convertido?',
        a: 'Também. No Magalu o seu código vale em qualquer endereço da loja, então link de produto, de campanha e de cupom saem todos com você creditada — é a loja mais simples nesse ponto.',
      },
      {
        q: 'Preciso de programação, API ou n8n?',
        a: 'Não. Você conecta o WhatsApp lendo um QR, escolhe de quais grupos as ofertas vêm e para quais grupos ou canais elas vão. Não há código, integração para montar nem servidor para manter.',
      },
      {
        q: 'Quanto custa?',
        a: 'Sete dias grátis, sem cartão, com o plano Pro completo. Depois, plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias. Sem fidelidade.',
      },
    ],
    aside: {
      pill: 'Por que o Magalu é o caso mais simples',
      title: 'No Magalu o seu código vale em qualquer endereço da loja.',
      body: 'Nas outras lojas, converter um link de cupom ou de campanha depende do mecanismo de cada programa, e nem sempre credita. No Magalu não: produto, campanha e cupom são tratados igual, e a oferta sai com você creditada em qualquer um deles. Se você divulga muita campanha e vitrine, essa diferença aparece no fim do mês.',
    },
    primaryCta: 'Testar 7 dias grátis',
    secondaryCta: 'Ver como funciona a operação',
    problemTitle: 'O gargalo de quem já divulga Magalu não é achar oferta.',
    problem: 'É publicar. Você acha a oferta, aplica o seu código, monta o texto e repete em cada grupo. Nesse caminho manual três coisas acontecem: link que escapa sem o seu código, a mesma oferta publicada duas vezes no mesmo grupo, e tudo saindo de uma vez porque só sobrou aquela janela do dia.',
    bullets: ['Link de produto, de campanha e de cupom do Magalu saem com o seu código.', 'A mesma oferta não sai duas vezes no mesmo grupo: a repetição é bloqueada e fica registrada.', 'Publicação espaçada em vez de tudo de uma vez, com limite por destino.', 'Histórico do que saiu, para onde e o que foi bloqueado ou falhou na conversão.'],
    process: ['Cadastre o seu código de divulgadora do Magalu no painel.', 'Escolha de quais grupos ou canais as ofertas vêm e para quais destinos elas vão.', 'Defina o intervalo entre envios e o limite por destino conforme o tamanho da sua operação.', 'Acompanhe no histórico o que saiu e o que foi bloqueado por repetição.'],
    faqs: [
      ['Isso substitui o meu cadastro no programa do Magalu?', 'Não. O programa continua sendo do Magalu e a comissão é paga por ele, direto para você. O que muda é a distribuição.'],
      ['E se a conversão falhar?', 'A oferta não é publicada. Encaminhar o link original daria a sua comissão para o divulgador do grupo de origem. Melhor não enviar do que enviar pagando para outra pessoa.'],
      ['Isso é "anti-ban"?', 'Não como promessa. Nenhuma ferramenta controla a decisão do WhatsApp. O que existe é controle do que está sob controle: intervalo entre envios, limite por destino e variação de texto.'],
      ['Dá para divulgar outras lojas junto?', 'Dá. Shopee, Amazon e Mercado Livre entram no mesmo plano de entrada, sem custo a mais por loja.'],
    ],
  },
  /* Quinta loja da frente Tier 1. O `aside` diz o que a SHEIN tem de específico:
   * o link curto vem da própria loja e é publicado como veio, e a falha degrada
   * para o link comprido em vez de barrar a oferta. Isso é a regra que está no
   * código (src/converters/shein.js) — não é promessa de marketing. */
  'shein-afiliados-whatsapp': {
    path: '/shein-afiliados-whatsapp',
    title: 'SHEIN Afiliados: divulgar no WhatsApp',
    description: 'Já é afiliada SHEIN? Veja como publicar suas ofertas em vários grupos e canais do WhatsApp com o seu link curto, sem copiar e colar oferta por oferta.',
    eyebrow: 'SHEIN Afiliados',
    h1: 'SHEIN Afiliados: como divulgar suas ofertas no WhatsApp sem copiar e colar',
    lead: 'Depois de entrar no programa de afiliados da SHEIN, o trabalho vira publicação: gerar o link com o seu código, montar o texto e repetir em cada grupo. O Espelha Grupos acompanha as origens que você escolher, troca o link pelo seu e publica nos seus destinos, com intervalo entre os envios e histórico do que saiu.',
    intent: 'shein afiliados whatsapp',
    related: [
      { href: '/seguranca-credenciais-afiliado', label: 'O que fazemos com os seus dados de afiliada', note: 'Onde ficam, para que servem e como apagar quando quiser.' },
      { href: '/clonar-mensagens-de-grupo-de-afiliados', label: 'O que significa clonar um grupo de ofertas', note: 'A mensagem sai como publicação sua, com o seu link.' },
      { href: '/grupo-para-canal-whatsapp', label: 'Grupo ou Canal: qual usar', note: 'O que muda no alcance e em quem pode responder.' },
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'Origens, conversão de link, destinos e histórico de envio.' },
      { href: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp', label: 'Como a conversão de link funciona', note: 'O que acontece com o link entre a origem e o seu grupo.' },
      { href: '/programa-de-afiliados', label: 'Comparar programas de afiliado', note: 'Comissão e prazo de atribuição das principais lojas, com fonte e data.' },
    ],
    about: ['SHEIN Afiliados', 'Link de afiliado', 'Grupos de WhatsApp'],
    decisionQA: [
      {
        q: 'Já sou afiliada SHEIN. O que isso resolve?',
        a: 'A parte repetitiva: pegar a oferta, gerar o link com o seu código, montar a mensagem e repetir em cada grupo. O robô acompanha as origens que você escolher, converte o link e publica nos seus grupos e canais.',
      },
      {
        q: 'O link da SHEIN sai curto?',
        a: 'Sai. O endereço da SHEIN é longo e ocupa boa parte da mensagem; a conversão pede à própria SHEIN o link curto do programa de afiliados e publica esse. Se a SHEIN não responder, a oferta sai mesmo assim, só com o link comprido — nunca deixa de sair por causa disso.',
      },
      {
        q: 'Preciso de programação, API ou n8n?',
        a: 'Não. Você conecta o WhatsApp lendo um QR, escolhe de quais grupos as ofertas vêm e para quais grupos ou canais elas vão. Não há código, integração para montar nem servidor para manter.',
      },
      {
        q: 'Quanto custa?',
        a: 'Sete dias grátis, sem cartão, com o plano Pro completo. Depois, plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias. Sem fidelidade.',
      },
    ],
    aside: {
      pill: 'O detalhe que é só da SHEIN',
      title: 'O link curto vem da própria SHEIN, não de um encurtador nosso.',
      body: 'O endereço da SHEIN é longo e come o espaço da mensagem. A conversão pede o link curto ao próprio programa de afiliados da loja, e publica exatamente o que a SHEIN devolveu — sem reescrever nem acrescentar parâmetro. Se a resposta não vier, a oferta sai com o link comprido em vez de não sair: link comprido é feio, oferta que não sai é prejuízo.',
    },
    primaryCta: 'Testar 7 dias grátis',
    secondaryCta: 'Ver como funciona a operação',
    problemTitle: 'O gargalo de quem já é afiliada SHEIN não é achar oferta.',
    problem: 'É publicar. Você acha a oferta, gera o link, monta o texto e repete em cada grupo. Nesse caminho manual três coisas acontecem: link que escapa sem o seu código, a mesma oferta publicada duas vezes no mesmo grupo, e tudo saindo de uma vez porque só sobrou aquela janela do dia.',
    bullets: ['Cada link da SHEIN sai com o seu código, e curto quando a loja devolve o link curto.', 'A mesma oferta não sai duas vezes no mesmo grupo: a repetição é bloqueada e fica registrada.', 'Publicação espaçada em vez de tudo de uma vez, com limite por destino.', 'Histórico do que saiu, para onde e o que foi bloqueado ou falhou na conversão.'],
    process: ['Cadastre as suas credenciais de afiliada da SHEIN no painel.', 'Escolha de quais grupos ou canais as ofertas vêm e para quais destinos elas vão.', 'Defina o intervalo entre envios e o limite por destino conforme o tamanho da sua operação.', 'Acompanhe no histórico o que saiu e o que foi bloqueado por repetição.'],
    faqs: [
      ['Isso substitui o meu cadastro no programa da SHEIN?', 'Não. O programa continua sendo da SHEIN e a comissão é paga por ela, direto para você. O que muda é a distribuição.'],
      ['E se a conversão falhar?', 'A oferta não é publicada. Encaminhar o link original daria a sua comissão para o afiliado do grupo de origem. Melhor não enviar do que enviar pagando para outra pessoa.'],
      ['Isso é "anti-ban"?', 'Não como promessa. Nenhuma ferramenta controla a decisão do WhatsApp. O que existe é controle do que está sob controle: intervalo entre envios, limite por destino e variação de texto.'],
      ['Dá para divulgar outras lojas junto?', 'Dá. Shopee, Amazon, Mercado Livre e Magalu entram no mesmo plano de entrada.'],
    ],
  },
  'bot-afiliados-whatsapp': {
    path: '/bot-afiliados-whatsapp',
    title: 'Bot para Afiliados no WhatsApp: Shopee, Amazon e Mercado Livre',
    // Reescrita de 2026-09-18 (PLANO_MAQUINA_DE_VENDAS_IA, seção 6 item 1): a
    // página tem CTR de 10% quando aparece e não apareceu em NENHUMA das 4
    // buscas reais de "bot para afiliados no whatsapp" — quem vence traz a
    // consulta literal + preço + teste no topo, tabela de preço estática, FAQ
    // com schema e um bloco "melhor para". O `title` fica como está: é exceção
    // MEDIDA em test/inbound-titulos-clique.test.js (8,09% de clique) e só sai
    // de lá com dado de Search Console. O H1 é que carrega preço e teste.
    description: 'Espelha os grupos que você segue e troca cada link pelo seu código de afiliada em 6 lojas. Basic R$ 39, Pro R$ 69 por 30 dias, 7 dias grátis sem cartão.',
    eyebrow: 'Bot para afiliados',
    h1: 'Bot para afiliados no WhatsApp: R$ 39 por 30 dias, 7 dias grátis',
    lead: `Um bot para afiliados no WhatsApp acompanha os grupos de origem que você já segue, troca cada link de produto ou cupom pelo seu código de afiliada e republica a oferta nos seus grupos e canais. O Espelha Grupos faz isso em ${SUPPORTED_STORES.length} lojas (${SUPPORTED_STORES.join(', ')}), com intervalo entre envios, limite por destino e histórico de tudo o que saiu.`,
    intent: 'bot para afiliados whatsapp',
    related: [
      { href: '/espelha-grupos-e-confiavel', label: 'O Espelha Grupos é confiável?', note: 'Resposta direta, incluindo por que isto não tem relação com golpe de espelhamento de tela.' },
      { href: '/seguranca-credenciais-afiliado', label: 'O que fazemos com o código de acesso da sua loja', note: 'Onde ele fica, para que serve e como apagar quando quiser.' },
      { href: '/clonar-mensagens-de-grupo-de-afiliados', label: 'O que significa clonar um grupo de ofertas', note: 'Como a mensagem sai como publicação sua, com o seu link, e não como encaminhamento.' },
      { href: '/bot-canal-whatsapp', label: 'Publicar em Canal do WhatsApp', note: 'O Canal alcança mais gente e ninguém responde por cima da oferta.' },
      { href: '/blog/quanto-custa-bot-para-whatsapp-afiliados', label: 'Quanto custa um bot para WhatsApp', note: 'Preço das ferramentas do mercado lado a lado, com fonte e data.' },
      { href: '/blog/checklist-padronizar-divulgacao-whatsapp', label: 'Checklist para padronizar o que você publica', note: 'O que conferir antes de cada oferta sair.' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'Shopee, Amazon e Mercado Livre: comissão e prazo de atribuição lado a lado.' },
      { href: '/vendas-e-comissao-afiliado-whatsapp', label: 'Quanto você ganhou de comissão', note: 'Pedidos, valor vendido e comissão estimada e confirmada das ofertas que o robô publicou.' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: cadastro e comissão', note: 'Cadastro gratuito, 3% na venda padrão e até 30% na Comissão Extra.' },
      { href: '/blog/como-divulgar-ofertas-amazon-whatsapp', label: 'Afiliado Amazon: comissão por categoria', note: 'De 0% a 13% conforme o produto, e por que a tag precisa estar na URL da loja.' },
      // Linkadas daqui de propósito (RCA 2026-09-11, AGENTS.md "Página nova
      // NUNCA nasce órfã"): estas duas não têm guia de blog próprio, então
      // esta é uma das poucas páginas fortes que lhes dá descoberta.
      { href: '/shein-afiliados-whatsapp', label: 'Divulgar SHEIN no WhatsApp', note: 'O link sai encurtado pela própria loja, já com a sua identidade.' },
      { href: '/magalu-afiliados-whatsapp', label: 'Divulgar Magalu no WhatsApp', note: 'O código de parceiro entra em qualquer endereço da loja, inclusive cupom.' },
    ],
    about: ['Marketing de afiliados', 'Link de afiliado', 'Grupos de WhatsApp'],
    // P4 (specs/013-inbound-leads-strategy, FR-023/FR-024): bloco de resposta
    // direta e extraível por IA para as quatro perguntas de decisão — o que
    // é, como funciona, quanto custa, como escolher. Curto e localizável de
    // propósito (parágrafo por pergunta, não espalhado no texto longo da
    // página). Não cria página nova — reforça esta, que já existe (FR-024).
    // Preço: mesmos valores de /precos e dashboard/lib/marketing-content.js
    // (Basic R$39, Pro R$69, 7 dias grátis) — nenhum número novo.
    decisionQA: [
      {
        q: 'O que é um bot para afiliados no WhatsApp?',
        a: `É um robô que acompanha os grupos que você já segue, troca o link de cada oferta pelo seu código de afiliado (${SUPPORTED_STORES.join(', ')}) e publica a oferta convertida nos seus próprios grupos e canais do WhatsApp — sem você copiar e colar oferta por oferta.`,
      },
      {
        q: 'Como funciona na prática?',
        a: 'Você cadastra as credenciais de afiliada de cada loja, escolhe os grupos de origem (onde as ofertas aparecem primeiro) e os grupos/canais de destino (onde você publica), define o intervalo entre envios, e o robô converte e publica sozinho — com o que saiu, para onde e o que foi bloqueado registrado no histórico.',
      },
      {
        q: 'Quanto custa?',
        a: 'Teste grátis por 7 dias, sem cartão, com o plano Pro completo. Depois, Basic a partir de R$39 por 30 dias (espelhamento e conversão de link) ou Pro a R$69 (acrescenta Canais do WhatsApp e ofertas automáticas da Shopee). Sem fidelidade — cancela quando quiser.',
      },
      {
        q: 'Como escolher entre Basic e Pro?',
        a: 'Comece pelo Basic se você opera só em grupos e quer a conversão de link automática. Migre para o Pro quando quiser publicar em Canais do WhatsApp, ativar ofertas automáticas da Shopee por palavra-chave ou precisar de fila com limite maior por hora e por dia. Dá para trocar de plano a qualquer momento pelo painel.',
      },
    ],
    aside: {
      pill: 'O erro que mais custa caro',
      title: 'Link enviado sem o seu código não gera comissão nenhuma.',
      body: 'A venda acontece, o cliente compra, e o dinheiro vai para outra pessoa. É o tipo de perda que não aparece em lugar nenhum: a oferta saiu bonita, ninguém reclamou, e a comissão simplesmente não caiu. Converter cada link antes do envio é a parte que não pode falhar.',
    },
    primaryCta: 'Ver operação para afiliados',
    secondaryCta: 'Conhecer preservação avançada',
    problemTitle: 'O gargalo do afiliado não é achar oferta — é publicar sem errar.',
    problem: 'Quem divulga ofertas em grupo passa o dia copiando link, gerando a versão de afiliado, colando o texto e repetindo isso em cada destino. Nesse caminho manual acontecem três coisas: link que sai sem o código de afiliado e não paga comissão, a mesma oferta publicada duas vezes no mesmo grupo, e tudo saindo de uma vez porque só sobrou aquela janela do dia. As três custam dinheiro, e nenhuma delas é falta de esforço.',
    // "Melhor para" / "não é ideal para" em texto próprio: a IA recomenda por
    // adequação, e até 18/09 não havia UMA ocorrência de "melhor para" nas
    // páginas comerciais. Honesto nos dois lados — o "não é ideal" é o que dá
    // crédito ao "melhor para".
    bestFor: {
      yes: [
        'Afiliada que já acompanha grupos de ofertas e quer republicar nos seus com o próprio código, sem copiar e colar.',
        'Quem divulga mais de uma loja: as 6 lojas entram no plano de entrada, sem cobrar por grupo.',
        'Quem quer ver no histórico o que saiu, o que foi bloqueado por repetição e por quê.',
      ],
      no: [
        'Quem precisa de Telegram como destino — o Espelha Grupos publica em grupos e Canais do WhatsApp.',
        'Quem quer o robô achando oferta sozinho em Amazon ou Mercado Livre: a busca automática por palavra-chave hoje é só na Shopee.',
        'Quem procura promessa de banimento zero. Ninguém controla a decisão do WhatsApp; o que existe aqui é ritmo, limite e histórico.',
      ],
    },
    // Tabela de preço estática, na própria página (os mesmos valores de
    // DEFAULT_LANDING_PLANS — nenhum número novo).
    priceTable: true,
    // Comparação com quem as IAs mais citam nesta consulta. Sem preço aqui de
    // propósito: preço de concorrente só sai com ficha datada, e ela mora nas
    // páginas de alternativa linkadas.
    versus: [
      { name: 'Pro Afiliados', href: '/alternativas/proafiliados', verdict: 'Tem plano grátis permanente, com a marca do sistema nas mensagens e anúncios do sistema no plano de entrada pago. Escolha o Pro Afiliados para testar sem custo; escolha o Espelha Grupos quando quiser a mensagem só com o seu nome e as 6 lojas desde o primeiro plano.' },
      { name: 'Afilira', href: '/alternativas/afilira', verdict: 'Busca a oferta por você, em grupos e nas lojas, e cobre Awin, Terabyte e SHEIN nos planos maiores. Escolha a Afilira se quer a ferramenta achando oferta fora dos marketplaces; escolha o Espelha Grupos para espelhar os grupos que você já acompanha, com o preço igual para poucos ou muitos grupos.' },
      { name: 'Achadinho Pro', href: '/alternativas/achadinho-pro', verdict: 'Forte em Shopee, com IA escolhendo produto; o plano de entrada é só Shopee. Escolha o Achadinho Pro se você divulga só Shopee; escolha o Espelha Grupos se divulga Mercado Livre, Amazon, Magalu, SHEIN ou AliExpress também.' },
    ],
    bullets: [`Cada link de produto ou cupom convertido para o seu código antes de sair — ${SUPPORTED_STORES.join(', ')}.`, 'A mesma oferta não sai duas vezes no mesmo grupo: repetição dentro da janela é bloqueada e fica registrada.', 'Publicação espaçada em vez de tudo de uma vez, com limite por destino.', 'Histórico do que saiu, para onde, quando — e do que foi bloqueado e por quê.'],
    process: ['Cadastre suas credenciais de afiliada de cada loja que você divulga.', 'Escolha os grupos e canais de origem que você acompanha e os destinos onde publica.', 'Defina o intervalo entre envios e o limite por destino de acordo com o tamanho da sua operação.', 'Acompanhe pelo histórico o que saiu, o que foi bloqueado por repetição e o que falhou na conversão.'],
    faqs: [
      ['Como o bot converte o link para o meu código de afiliado?', 'Você cadastra suas credenciais de afiliada de cada loja uma vez. A partir daí, quando uma oferta é capturada, o link é convertido para a sua versão antes do envio. Se a conversão não for possível com segurança, o link original de outra pessoa não é encaminhado — é melhor não publicar do que publicar dando comissão para o concorrente.'],
      ['Funciona com cupom, ou só com link de produto?', 'Também com cupom e voucher. Isso importa porque muitas vezes o preço anunciado só fecha com o cupom, e remover o cupom da mensagem quebra a oferta. O link de campanha também é convertido para o seu código.'],
      ['Quais lojas são suportadas?', `${SUPPORTED_STORES.join(', ')}. Cada uma credita comissão por um mecanismo diferente, e a conversão respeita o mecanismo de cada uma.`],
      ['Qual a diferença para Pro Afiliados, Afilira e Achadinho Pro?', 'A comparação de cada um, com preço e data de consulta, está nas páginas de alternativa linkadas nesta página. Em resumo: o Pro Afiliados tem plano grátis com a marca dele nas mensagens; a Afilira busca a oferta por você e cobre lojas fora dos marketplaces; o Achadinho Pro é forte em Shopee. O Espelha Grupos é o espelhamento com conversão em 6 lojas desde o plano de entrada, sem fidelidade.'],
      ['Preciso migrar tudo para canais?', 'Não. Dá para operar grupos e canais juntos, escolhendo o papel de cada ambiente — grupo como comunidade ou origem, canal como vitrine.'],
      ['E se a mesma oferta chegar de duas fontes diferentes?', 'Ela sai uma vez só. A repetição no mesmo destino dentro da janela é bloqueada e aparece no histórico como bloqueio, não como envio — assim você vê quantas vezes a mesma promoção tentou entrar.'],
      ['Isso é o mesmo que “anti-ban”?', 'Não como promessa. Nenhuma ferramenta controla a decisão do WhatsApp, e quem garante banimento zero está vendendo o que não pode entregar. O que existe aqui é controle do que está sob controle: intervalo entre envios, limite por destino e variação.'],
      ['Preciso ter grupo grande para valer a pena?', 'Não. O ganho principal é de tempo e de comissão que deixa de se perder no caminho, e isso vale desde o primeiro grupo. Volume grande muda a conta, não a lógica.'],
    ],
  },
  'bot-achadinhos-whatsapp': {
    path: '/bot-achadinhos-whatsapp',
    // Título e descrição reescritos em 2026-08-17. O anterior tinha 65 chars e,
    // somado ao sufixo ' | Espelha Grupos' do template do layout, chegava a 83 —
    // o Google corta perto de 55 no celular, que é de onde vêm 62% das nossas
    // impressões. O que sobrava na tela era só "Bot para Achadinhos no WhatsApp:
    // automatize seus g…": nenhum motivo para clicar. Agora o diferencial (4
    // lojas) e o teste cabem dentro da janela visível. Manter curto.
    title: 'Bot para achadinhos no WhatsApp: 6 lojas e 7 dias grátis',
    description: 'O bot pega a oferta do grupo que você acompanha, troca o link pelo seu código de afiliado e publica nos seus grupos. 6 lojas: de Shopee a AliExpress.',
    eyebrow: 'Bot para achadinhos',
    h1: 'Bot para achadinhos no WhatsApp: as ofertas saem sozinhas',
    lead: 'Um bot de achadinhos acompanha os grupos onde as promoções aparecem primeiro, troca o link pelo seu código de afiliado e publica a oferta nos seus próprios grupos e canais do WhatsApp. Você deixa de copiar e colar oferta por oferta e passa a revisar o que já foi enviado.',
    intent: 'bot para achadinhos whatsapp',
    relatedTitle: 'Continue: o que publicar nos seus achadinhos',
    related: [
      { href: '/espelha-grupos-e-confiavel', label: 'O Espelha Grupos é confiável?', note: 'O que o produto é, o que fazemos com seus dados e o que não prometemos.' },
      { href: '/confiabilidade-sessao-whatsapp', label: 'O que acontece quando o WhatsApp cai', note: 'Como o robô se recupera sozinho e o que você vê no painel enquanto isso.' },
      { href: '/grupo-para-canal-whatsapp', label: 'Grupo ou Canal: qual usar para achadinhos', note: 'O que muda no alcance, no risco e em quem pode responder.' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'De onde vem a comissão dos achadinhos que você publica.' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: cadastro e comissão', note: 'O programa com maior volume de busca no Brasil.' },
      { href: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', label: 'Montar um grupo de ofertas do zero', note: 'Os primeiros passos antes de automatizar.' },
      { href: '/clonar-mensagens-de-grupo-de-afiliados', label: 'Clonar mensagens de um grupo de afiliados', note: 'O que a busca chama de "clonar" e como o link vira o seu.' },
      { href: '/copiaram-minha-oferta-no-whatsapp', label: 'Copiaram a sua oferta?', note: 'Marca d\u2019água, texto próprio e link com o seu código: o que muda quem leva o crédito.' },
      // Links por loja adicionados em 16/09. Esta é a 2ª página mais forte do
      // site (2.514 impressões, CTR 5,0%) e não apontava para nenhuma das cinco
      // páginas por loja — que existem desde 02/09 e seguem com ~30 impressões
      // por falta de DESCOBERTA, não por falta de página. Ver o comentário de
      // COMPARISON_STORE_LINKS em `app/_comparisonContent.js`.
      { href: '/shopee-afiliados-whatsapp', label: 'Divulgar Shopee no WhatsApp', note: 'Como a oferta da Shopee sai já com o seu link, sem copiar e colar.' },
      { href: '/mercado-livre-afiliados-whatsapp', label: 'Divulgar Mercado Livre no WhatsApp', note: 'Produto, catálogo e vitrine saem convertidos com a sua etiqueta.' },
      { href: '/amazon-afiliados-whatsapp', label: 'Divulgar Amazon no WhatsApp', note: 'A etiqueta viaja junto com o link curto, e é ela que credita a venda.' },
    ],
    about: ['Achadinhos', 'Afiliados', 'Grupos de WhatsApp'],
    aside: {
      pill: 'Como funciona na prática',
      title: 'Você escolhe as fontes. O resto sai sozinho.',
      body: 'O bot acompanha os grupos que você indicou como fonte, troca o link pelo seu código de afiliado e publica nos seus grupos e canais — com intervalo entre envios e sem repetir a mesma oferta no mesmo grupo.',
    },
    primaryCta: 'Testar grátis por 7 dias',
    secondaryCta: 'Ver como funciona',
    // Esta página recebe a maior parte das suas impressões de gente digitando o
    // NOME de um concorrente (achadinhoosbot / achadinhosbot / achadinhos bot =
    // 443 impressões em 3 meses, 15% do site). Isso é busca de NAVEGAÇÃO: a
    // pessoa quer aquele produto específico. Ela cai aqui, não encontra o nome
    // que digitou em lugar nenhum e sai — não por falta de botão, mas por falta
    // de orientação. Para esse público o elemento que converte é COMPARAÇÃO, não
    // CTA: o trabalho dela ali é decidir, e botão serve para quem já decidiu.
    // Fica ANTES dos botões de propósito.
    competitorNudge: {
      text: 'Procurando o AchadinhosBot?',
      label: 'Veja a comparação lado a lado',
      href: '/alternativas/achadinhos-bot',
    },
    problemTitle: 'O achadinho bom dura minutos — e você não está sempre no celular.',
    problem: 'Promoção de achadinho é por tempo limitado e estoque curto. Quem depende de ver a oferta, copiar o link, trocar pelo seu código de afiliado e colar em cada grupo sempre chega atrasado — ou desiste de postar em metade dos grupos.',
    bullets: ['A oferta sai nos seus grupos no mesmo minuto em que aparece na fonte, não meia hora depois.', 'O link já vai com o seu código de afiliado, sem você trocar nada na mão.', 'A mesma promoção não é repostada duas vezes no mesmo grupo no mesmo dia.'],
    process: ['Escolha os grupos onde os achadinhos aparecem primeiro — eles viram sua fonte.', 'Escolha os seus grupos e canais que vão receber as ofertas.', 'Defina o intervalo entre envios e quais palavras você não quer repassar.', 'Acompanhe no histórico o que saiu, para onde e o que foi bloqueado por repetição.'],
    faqs: [
      ['O que é um bot de achadinhos?', 'É um programa que acompanha os grupos onde as promoções aparecem primeiro, troca o link pelo seu código de afiliado e publica a oferta nos seus próprios grupos e canais do WhatsApp — sem você copiar e colar oferta por oferta.'],
      ['De onde vêm os achadinhos?', 'Dos grupos que você já acompanha e escolhe como fonte. O bot não inventa oferta nem busca em lugar nenhum sozinho: ele repassa o que aparece nas fontes que você indicou, com o seu link no lugar do original.'],
      ['A comissão fica comigo mesmo se a oferta veio de outro grupo?', 'Fica, desde que o link seja convertido antes de sair. É esse o ponto: encaminhar o link do jeito que veio credita a venda para quem publicou primeiro. O Espelha Grupos troca pelo seu código de Shopee, Amazon, Mercado Livre ou Magalu antes de publicar.'],
      ['Ele posta a mesma promoção várias vezes?', 'Não no mesmo grupo dentro da janela de repetição. Se a mesma oferta chega por duas fontes diferentes, ela sai uma vez só — e o histórico mostra quantas repetições foram bloqueadas.'],
      ['Preciso ficar com o celular ligado?', 'O aparelho precisa estar conectado à internet, como no WhatsApp Web. Mas você não precisa estar olhando: as ofertas saem sozinhas conforme as regras que você definiu.'],
      ['Serve para cupom, ou só para produto?', 'Serve para os dois. Links de cupom e campanha também são convertidos para o seu código, não só links de produto — que é onde muita ferramenta simplesmente remove o link.'],
      ['Quantos grupos posso usar?', 'Não há limite de grupos. O que muda entre os planos é o acesso a Canais, ofertas automáticas da Shopee e filas de envio.'],
      ['Corro risco de perder o número?', 'Existe risco em qualquer operação de divulgação, e ninguém pode prometer o contrário. O que dá para controlar é o ritmo: intervalo entre envios, variação de texto e limite por grupo. Vale ler antes o guia sobre WhatsApp banido.'],
    ],
  },
  'anti-ban-whatsapp': {
    path: '/anti-ban-whatsapp',
    title: 'WhatsApp banido divulgando ofertas: o que controlar',
    description: 'Por que o WhatsApp bane quem divulga ofertas em grupos, o que aumenta o risco e o que dá para controlar de verdade. Ninguém pode garantir imunidade.',
    eyebrow: 'WhatsApp banido: o que dá para controlar',
    h1: 'Teve o WhatsApp banido divulgando ofertas? Veja o que dá para controlar',
    lead: 'Contas de WhatsApp usadas para divulgar ofertas costumam ser banidas quando o comportamento parece automático demais: muitas mensagens iguais em sequência, links repetidos e denúncias de membros. Nenhuma ferramenta garante imunidade — o que dá para controlar é ritmo, variação de texto e volume por destino.',
    intent: 'anti-ban whatsapp',
    relatedTitle: 'Continue: reduzir risco na prática',
    related: [
      { href: '/blog/chip-dedicado-bot-whatsapp', label: 'Por que usar chip dedicado', note: 'Não impede o banimento, mas limita o estrago — a medida mais barata de todas.' },
      { href: '/blog/como-evitar-banimento-whatsapp-afiliados', label: 'Reduzir risco de banimento como afiliado', note: 'Cadência, variação de texto e consentimento de quem recebe.' },
      { href: '/blog/bot-whatsapp-antiban-existe', label: 'Bot antiban existe mesmo?', note: 'O que nenhuma ferramenta do mercado pode garantir.' },
    ],
    about: ['WhatsApp banido', 'Banimento de conta', 'Divulgação em grupos'],
    aside: {
      pill: 'Sem promessa de imunidade',
      title: 'Ninguém pode garantir que você não será banido.',
      body: 'O WhatsApp decide sozinho e não explica o critério. Quem promete banimento zero está vendendo o que não controla. O que dá para controlar é ritmo de envio, variação de texto, limite por grupo e divulgar só para quem aceitou receber.',
    },
    primaryCta: 'Testar grátis por 7 dias',
    secondaryCta: 'Fazer o teste de risco',
    problemTitle: 'O que faz o WhatsApp banir um número que divulga oferta.',
    problem: 'O WhatsApp não bane por você vender — bane por comportamento que parece robô. Na prática, três coisas pesam mais: mandar muitas mensagens iguais em sequência, ter gente clicando em "denunciar" ou "bloquear", e adicionar pessoas em grupo sem elas pedirem. Volume sozinho não é o problema; volume com mensagem idêntica é.',
    bullets: ['Mensagem repetida no mesmo formato para vários grupos seguidos é o padrão mais fácil de detectar.', 'Denúncia de membro pesa mais que quantidade de envio — um grupo irritado derruba mais rápido que mil mensagens.', 'Número novo tem menos margem que número antigo com histórico de conversa real.'],
    process: ['Use um chip só para a operação, nunca o número pessoal — se cair, você não perde seus contatos.', 'Deixe intervalo entre os envios em vez de disparar tudo de uma vez.', 'Varie o texto: a mesma oferta com chamadas diferentes por grupo.', 'Só divulgue em grupo que aceitou receber oferta — denúncia é o que mais derruba.', 'Tenha um plano B pronto: segundo chip, backup da lista de grupos e das configurações.'],
    faqs: [
      ['Por que meu WhatsApp foi banido divulgando ofertas?', 'Quase sempre por um destes três: mensagens iguais disparadas em sequência, denúncias de membros que não queriam receber, ou adição de pessoas em grupos sem consentimento. O WhatsApp não divulga o motivo exato, mas esses são os padrões que ele descreve como uso automatizado ou não solicitado.'],
      ['Dá para recuperar um número banido do WhatsApp?', 'Às vezes. O próprio app oferece a opção de pedir revisão quando você tenta entrar e vê a mensagem de banimento. A revisão é feita pelo WhatsApp, não por nenhuma ferramenta, e não há prazo garantido nem certeza de retorno. Se o número era o da operação e não o pessoal, o prejuízo fica limitado.'],
      ['Qual a diferença entre número banido, conta banida e shadowban?', 'Banimento de número ou conta é explícito: você não consegue mais usar e vê o aviso ao abrir o app. O que o mercado chama de shadowban é diferente e mais difícil de identificar — nada avisa, mas a entrega cai e as mensagens param de aparecer para parte das pessoas. O primeiro é um evento; o segundo, uma queda silenciosa.'],
      ['Existe bot “anti-ban” de verdade?', 'Não. Nenhuma ferramenta controla a decisão do WhatsApp, e quem promete banimento zero está vendendo o que não pode entregar. O que existe é reduzir os padrões que chamam atenção: ritmo, variação de texto, limite por grupo e consentimento de quem recebe.'],
      ['Usar um bot aumenta o risco de tomar ban?', 'Depende de como ele envia. Uma ferramenta que dispara tudo de uma vez, com texto idêntico, aumenta. Uma que espaça os envios, varia o texto e respeita limite por grupo tende a parecer mais com uso humano do que a pessoa copiando e colando às pressas em vinte grupos seguidos.'],
      ['Quantas mensagens posso mandar por dia sem risco?', 'Não existe número oficial, e desconfie de quem cita um. O que importa mais que a quantidade é o padrão: cem mensagens espaçadas, com texto variado, para grupos que pediram para receber, são mais seguras que vinte idênticas em dois minutos.'],
      ['Chip dedicado resolve?', 'Não impede o banimento, mas limita o estrago. Se o número da operação cair, seus contatos pessoais, suas conversas e seu histórico continuam intactos em outro número. É a medida mais barata de todas.'],
      ['O Espelha Grupos garante que eu não seja banido?', 'Não, e desconfie de qualquer ferramenta que garanta. O que ele faz é controlar o que está sob controle: intervalo entre envios, variação de texto, limite por destino e histórico do que saiu.'],
    ],
  },
  'grupo-para-canal-whatsapp': {
    path: '/grupo-para-canal-whatsapp',
    title: 'Como migrar grupo de achadinhos para Canal do WhatsApp',
    description: 'Planeje a migração de grupos de achadinhos para Canais do WhatsApp com o Espelha Grupos, mantendo grupos como fonte/comunidade e canais como vitrine preservada.',
    eyebrow: 'Migração grupo → canal',
    h1: 'Migre grupos de achadinhos para canais sem parar a operação',
    lead: 'O Espelha Grupos permite uma transição gradual: grupos continuam úteis como comunidade ou fonte, enquanto os Canais do WhatsApp viram uma vitrine organizada com cadência e preservação avançada.',
    intent: 'migrar grupo para canal whatsapp',
    relatedTitle: 'Continue: grupos, canais e o que publicar',
    related: [
      { href: '/blog/migrar-grupo-achadinhos-para-canal', label: 'Migrar um grupo de achadinhos para canal', note: 'O passo a passo sem perder a audiência no caminho.' },
      { href: '/blog/grupo-ou-canal-whatsapp-achadinhos', label: 'Grupo ou canal para achadinhos?', note: 'O que muda em alcance, interação e risco.' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'De onde vem a comissão das ofertas que você publica.' },
    ],
    about: ['Canais do WhatsApp', 'Grupos de WhatsApp', 'Achadinhos'],
    aside: {
      pill: 'Migração gradual',
      title: 'Grupo e canal não são a mesma coisa — e você não precisa escolher.',
      body: 'No grupo as pessoas conversam, respondem e o limite de membros é fixo. No canal você publica para muita gente e quase ninguém responde. Quem migra de uma vez costuma perder as duas coisas ao mesmo tempo: a conversa que tinha e o alcance que ainda não construiu.',
    },
    primaryCta: 'Planejar minha migração',
    secondaryCta: 'Ver fluxos grupo e canal',
    problemTitle: 'Migrar de uma vez é como fechar a loja para mudar de rua.',
    problem: 'O grupo que você levou meses para encher não se transfere para um canal com um aviso. Parte das pessoas não entra, parte não vê o recado, e nas primeiras semanas o canal novo tem menos alcance do que o grupo antigo tinha. A migração que funciona mantém os dois vivos enquanto a audiência atravessa — o grupo continua como comunidade ou como fonte de ofertas, e o canal vai virando a vitrine principal aos poucos.',
    bullets: ['Grupos seguem funcionando como comunidade ou como origem das ofertas que você acompanha.', 'O canal vira a vitrine, recebendo as ofertas já convertidas para o seu código de afiliado.', 'Cada destino tem o seu ritmo: o que vale para o grupo não precisa valer para o canal.', 'A mesma oferta não é publicada duas vezes no mesmo destino durante a transição.'],
    process: ['Liste os grupos e canais que você já tem e defina o papel de cada um: origem, comunidade, vitrine ou reserva.', 'Crie o canal e comece publicando nele em paralelo, sem desmontar nada.', 'Avise a audiência do grupo mais de uma vez, ao longo de semanas — aviso único não alcança quem não abriu naquele dia.', 'Só reduza o ritmo do grupo quando o canal já estiver entregando de forma estável.'],
    faqs: [
      ['Preciso fechar meus grupos?', 'Não, e fechar cedo é o erro mais comum. A migração que funciona é gradual: grupo e canal convivem enquanto a audiência aprende o caminho novo. O grupo pode inclusive continuar para sempre, com outro papel.'],
      ['Dá para publicar de grupo para canal automaticamente?', 'Sim. O fluxo cobre grupo para canal, canal para grupo, canal para canal e grupo para grupo — com o link já convertido para o seu código de afiliado.'],
      ['Vou perder alcance na migração?', 'No começo, quase sempre sim. O canal novo não nasce com a audiência do grupo, e parte das pessoas não faz a troca. Por isso a recomendação é sobrepor os dois por semanas, não por dias.'],
      ['Qual a vantagem do canal, então?', 'Não tem limite de membros como o grupo, ninguém vê o número de quem entrou, e não há conversa paralela cobrindo a oferta. Para quem publica achadinhos em volume, é um ambiente mais organizado.'],
      ['E a vantagem de manter o grupo?', 'Conversa. No grupo as pessoas perguntam, respondem, dizem se a oferta valeu — e isso não existe no canal. Quem depende dessa relação costuma manter os dois.'],
      ['Como reduzir o risco durante a migração?', 'Publicar nos dois lugares aumenta o volume total de envio, então é justamente o momento de espaçar mais, não menos. Limite por destino, intervalo entre envios e chip dedicado valem ainda mais nessa fase.'],
    ],
  },
  'bot-canal-whatsapp': {
    path: '/bot-canal-whatsapp',
    title: 'Bot para Canal do WhatsApp com cadência e preservação',
    description: 'Publique ofertas em Canal do WhatsApp com o Espelha Grupos usando cadência humana, variações, monitoramento e Módulo de Preservação Avançada.',
    eyebrow: 'Bot para Canal do WhatsApp',
    h1: 'Canal do WhatsApp precisa de bot com cadência, não disparo',
    lead: 'O Espelha Grupos transforma o canal em vitrine de ofertas com regras de publicação, variações e monitoramento. O objetivo é preservar a operação, não apenas postar mais rápido.',
    intent: 'bot para canal whatsapp',
    relatedTitle: 'Continue: cadência, canal e o que publicar',
    related: [
      { href: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', label: 'Melhores horários para postar ofertas', note: 'Quando a audiência responde — e por que concentrar tudo num horário só é arriscado.' },
      { href: '/blog/shadowban-whatsapp-canais', label: 'Shadowban em canais do WhatsApp', note: 'A queda silenciosa de entrega que nada avisa.' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'Shopee, Amazon e Mercado Livre: comissão e prazo de atribuição.' },
    ],
    aside: {
      pill: 'O que ninguém avisa',
      title: 'No canal, quando a entrega cai, nada avisa.',
      body: 'Grupo dá sinal: as pessoas somem, reclamam, saem. Canal não — o número de inscritos continua igual e as ofertas simplesmente aparecem para menos gente. Por isso ritmo e histórico importam mais no canal do que no grupo: é o único jeito de perceber antes de perder o alcance inteiro.',
    },
    primaryCta: 'Criar operação com canal',
    secondaryCta: 'Conhecer preservação avançada',
    problemTitle: 'Canal não é lugar de despejar oferta — é vitrine.',
    problem: 'Como o canal aceita muito mais gente que o grupo, a tentação é publicar tudo o que aparece. Só que quem recebe vinte ofertas seguidas silencia o canal, e canal silenciado não entrega — sem aviso, sem reclamação, sem nada no painel do WhatsApp. O que sustenta um canal de ofertas no médio prazo é publicar espaçado, com curadoria, e conseguir olhar para trás e ver o que saiu.',
    bullets: ['Publicação espaçada em vez de rajada, com limite por canal.', 'A mesma oferta não repete no mesmo canal dentro da janela definida.', 'Vários canais recebem em momentos diferentes, em vez de tudo ao mesmo tempo.', 'Histórico do que saiu e do que foi bloqueado, para ajustar antes de perder alcance.'],
    process: ['Conecte o canal e escolha as fontes de oferta que você acompanha.', 'Defina o intervalo entre publicações e o teto por dia para esse canal.', 'Se tiver mais de um canal, escalone os horários em vez de publicar em todos de uma vez.', 'Revise o histórico com frequência e reduza o ritmo ao primeiro sinal de queda.'],
    faqs: [
      ['Dá para publicar em Canal do WhatsApp automaticamente?', 'Sim. O canal recebe a oferta já com o link convertido para o seu código de afiliado e com o card de preview montado, no ritmo que você definir.'],
      ['Posso usar vários canais ao mesmo tempo?', 'Sim, e o recomendado é escalonar: cada canal recebe em um momento diferente, em vez de todos receberem a mesma oferta no mesmo minuto.'],
      ['Quantas ofertas por dia dá para publicar num canal?', 'Não existe número oficial, e desconfie de quem cita um. O que pesa mais que a quantidade é o espaçamento e a qualidade da curadoria — quem silencia o canal não volta.'],
      ['É melhor canal ou grupo?', 'Depende do que você quer. Canal alcança mais e organiza melhor a vitrine; grupo gera conversa e resposta. Para achadinhos, muita gente usa canal como vitrine e mantém o grupo como comunidade ou como fonte de ofertas.'],
      ['Como sei se meu canal está com a entrega ruim?', 'É difícil, e esse é o ponto: o WhatsApp não mostra alcance por publicação em canal como uma rede social mostraria. Os sinais que sobram são indiretos — queda de cliques e de resposta. Por isso o histórico de envio importa: sem ele você não tem nem com o que comparar.'],
      ['Preciso de chip dedicado para operar canal?', 'Não é obrigatório, mas é a medida mais barata de proteção. Se o número cair, você perde a operação, não os seus contatos pessoais e conversas.'],
    ],
  },
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function getPreservationCommercialMetadata(pageKey) {
  const page = PRESERVATION_COMMERCIAL_PAGES[pageKey]
  if (!page) return {}
  const ogImage = buildOgImageUrl({ slug: pageKey, cluster: 'canais-preservacao', template: 'commercial-seo' })
  const robots = buildSeoRobots(page.path)
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${siteUrl}${page.path}`,
      siteName: 'Espelha Grupos',
      locale: 'pt_BR',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [ogImage],
    },
  }
}

function buildSchemas(page) {
  const pageUrl = `${siteUrl}${page.path}`
  const dates = getEditorialDates(page.path)
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: pageUrl,
      inLanguage: 'pt-BR',
      // Data e dono: as 5 páginas de loja do Tier 1 saíam sem nenhum sinal de
      // frescor nem de quem publica (RCA 2026-09-18). Datas em
      // lib/editorial-content.js (EDITORIAL_DATES).
      datePublished: dates.publishedAt,
      dateModified: dates.updatedAt,
      publisher: { '@id': `${siteUrl}#organization` },
      isPartOf: { '@id': `${siteUrl}#website` },
      about: page.about ?? ['Canais do WhatsApp', 'Afiliados', 'Módulo de Preservação Avançada'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      // decisionQA entra ANTES das FAQs "tradicionais" — são as quatro
      // perguntas de decisão (FR-023), o bloco mais citável por motor de IA.
      mainEntity: [
        ...(page.decisionQA ?? []).map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
        ...page.faqs.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Canais e preservação', item: `${siteUrl}/bot-canais-whatsapp` },
        { '@type': 'ListItem', position: 3, name: page.title, item: pageUrl },
      ],
    },
  ]
}

const s = {
  section: { padding: '56px 0' },
  hero: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 30, alignItems: 'center', padding: '44px 0 64px' },
  h1: { fontSize: 'clamp(40px, 5vw, 68px)', lineHeight: 0.98, letterSpacing: '-0.055em', margin: '18px 0' },
  h2: { fontSize: 'clamp(28px, 3vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.04em', margin: '12px 0 14px' },
  lead: { fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.55, color: 'var(--ink-soft)' },
  small: { fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)' },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 24, boxShadow: '0 10px 28px rgba(63, 63, 70, 0.04)' },
  softCard: { background: 'color-mix(in oklab, var(--accent) 12%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 },
  ctas: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 },
  nudge: { fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-soft)', marginTop: 18 },
  nudgeLink: { color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 },
  list: { margin: 0, paddingLeft: 20, display: 'grid', gap: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: 520 },
  th: { textAlign: 'left', padding: '12px 10px', borderBottom: '2px solid var(--line)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)' },
  td: { padding: '12px 10px', borderTop: '1px solid var(--line)', verticalAlign: 'top', lineHeight: 1.55 },
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div style={{ maxWidth: 820, marginBottom: 26 }}>
      <span className="pill"><span className="dot" />{eyebrow}</span>
      <h2 style={s.h2}>{title}</h2>
      {body ? <p style={s.lead}>{body}</p> : null}
    </div>
  )
}

export function PreservationCommercialPage({ pageKey }) {
  const page = PRESERVATION_COMMERCIAL_PAGES[pageKey]
  // Barra lateral configurável por página. O default preserva o texto da campanha
  // "Canais + Preservação" para as páginas que continuam sendo sobre isso; páginas
  // que entram por outra intenção (achadinhos, WhatsApp banido) sobrescrevem, para
  // o corpo não contradizer o título.
  const aside = page.aside ?? {
    pill: 'Módulo de Preservação Avançada',
    title: 'Redução de risco sem promessa absoluta.',
    body: 'O Espelha Grupos usa cadência, variações, limites, monitoramento e plano de recuperação. Quando falamos de “anti-ban”, é como termo de busca do mercado, não garantia.',
  }
  // Links internos para o conteúdo editorial. Antes destas páginas comerciais só
  // apontarem para cadastro/diagnóstico/checklist, a força que elas acumulam ficava
  // presa aqui em vez de reforçar os guias que já rankeiam (Shopee/Amazon/ML e o hub
  // /programa-de-afiliados). Cada página escolhe os seus — link sem relação temática
  // é descontado pelo Google e ignorado pelo leitor.
  const related = page.related ?? []
  const relatedTitle = page.relatedTitle ?? 'Continue no cluster de afiliados'
  const schemas = buildSchemas(page)
  const trackerRoute = { slug: pageKey, path: page.path, cluster: 'canais-preservacao', intent: page.intent, template: 'commercial-seo' }

  return (
    <div className="landing-root">
      <OrganicPageTracker route={trackerRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      ))}

      <main>
        <section aria-labelledby="page-title">
          <div className="wrap" style={s.hero}>
            <div>
              <span className="pill"><span className="dot" />{page.eyebrow}</span>
              <h1 id="page-title" style={s.h1}>{page.h1}</h1>
              <p style={s.lead}>{page.lead}</p>
              {page.competitorNudge ? (
                <p style={s.nudge}>
                  {page.competitorNudge.text}{' '}
                  <Link
                    href={page.competitorNudge.href}
                    style={s.nudgeLink}
                    data-seo-cta="commercial_competitor_nudge"
                    data-cta-position="hero_nudge"
                    data-cta-stage="comparison"
                    data-cta-destination="comparison"
                  >
                    {page.competitorNudge.label}
                  </Link>
                </p>
              ) : null}
              <div style={s.ctas}>
                <Link className="btn btn-accent" href={registerHref} data-seo-cta="commercial_signup" data-cta-position="hero_primary" data-cta-stage="conversion" data-cta-destination="signup">{page.primaryCta}</Link>
                <Link className="btn btn-ghost" href={diagnosticHref} data-seo-cta="commercial_diagnostic" data-cta-position="hero_secondary" data-cta-stage="diagnostic" data-cta-destination="diagnostic">Fazer diagnóstico</Link>
              </div>
            </div>
            <aside style={s.softCard} aria-label={`Resumo: ${aside.pill}`}>
              <span className="pill"><span className="dot" />{aside.pill}</span>
              <h2 style={{ ...s.h2, fontSize: 'clamp(24px, 2.5vw, 34px)' }}>{aside.title}</h2>
              <p style={s.small}>{aside.body}</p>
            </aside>
          </div>
        </section>

        {Array.isArray(page.decisionQA) && page.decisionQA.length > 0 && (
          <section style={s.section} aria-labelledby="decision-qa-title">
            <div className="wrap">
              <SectionHeader eyebrow="Resposta rápida" title="O que você precisa saber antes de decidir" />
              <div style={{ display: 'grid', gap: 14 }}>
                {page.decisionQA.map(({ q, a }) => (
                  <div key={q} style={s.card}>
                    <strong style={{ display: 'block', fontSize: 16.5, marginBottom: 8 }}>{q}</strong>
                    <p style={s.small}>{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {page.bestFor ? (
          <section style={s.section} aria-labelledby="best-for-title">
            <div className="wrap">
              <SectionHeader eyebrow="Para quem é" title="Melhor para — e para quem não é" />
              <div style={s.grid}>
                <div style={s.card}>
                  <strong style={{ display: 'block', fontSize: 18, marginBottom: 10 }}>Melhor para</strong>
                  <ul style={s.list}>
                    {page.bestFor.yes.map((item) => (
                      <li key={item} style={s.small}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div style={s.card}>
                  <strong style={{ display: 'block', fontSize: 18, marginBottom: 10 }}>Não é ideal para</strong>
                  <ul style={s.list}>
                    {page.bestFor.no.map((item) => (
                      <li key={item} style={s.small}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {page.priceTable ? (
          <section style={s.section} aria-labelledby="price-table-title">
            <div className="wrap">
              <SectionHeader eyebrow="Quanto custa" title="Preço em uma tabela, sem surpresa" body="Os mesmos valores da página de preços: 7 dias grátis sem cartão, depois Basic ou Pro por 30 dias, sem fidelidade — cancela pelo painel." />
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Plano</th>
                      <th style={s.th}>Preço</th>
                      <th style={s.th}>O que inclui</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_LANDING_PLANS.map((plan) => (
                      <tr key={plan.id}>
                        <td style={s.td}><strong>{plan.name}</strong></td>
                        <td style={s.td}>{plan.price} <span style={{ color: 'var(--ink-soft)' }}>/ {plan.period}</span></td>
                        <td style={s.td}>{plan.features.slice(0, 4).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link className="btn btn-ghost" style={{ marginTop: 18 }} href="/precos" data-seo-cta="commercial_pricing" data-cta-position="price_table" data-cta-stage="consideration" data-cta-destination="pricing">Ver a página de preços</Link>
            </div>
          </section>
        ) : null}

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="Por que importa" title={page.problemTitle} body={page.problem} />
            <div style={s.grid}>
              {page.bullets.map((item) => (
                <div key={item} style={s.card}>
                  <strong style={{ display: 'block', fontSize: 18, marginBottom: 8 }}>{item}</strong>
                  <p style={s.small}>Pensado para afiliados que tratam canal, grupo, chip e audiência como ativos de negócio.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="Como começar" title="Um caminho prático antes de escalar volume." body="A próxima etapa não é postar mais: é estruturar a operação para que cada destino tenha papel, cadência e monitoramento." />
            <ol style={{ ...s.grid, listStyle: 'none', margin: 0, padding: 0 }}>
              {page.process.map((step, index) => (
                <li key={step} style={s.card}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-strong)', color: 'white', fontWeight: 800, marginBottom: 12 }}>{index + 1}</span>
                  <p style={{ ...s.small, color: 'var(--ink)' }}>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {Array.isArray(page.versus) && page.versus.length > 0 ? (
          <section style={s.section} aria-labelledby="versus-title">
            <div className="wrap">
              <SectionHeader eyebrow="Comparação honesta" title="Espelha Grupos ou outro bot? Depende do que você divulga." body="Nenhum é melhor em tudo. Cada comparação abaixo traz o preço do concorrente com a data em que foi conferido." />
              <div style={s.grid}>
                {page.versus.map((item) => (
                  <article key={item.href} style={s.card}>
                    <h3 style={{ fontSize: 20, marginBottom: 10 }}>Espelha Grupos × {item.name}</h3>
                    <p style={s.small}>{item.verdict}</p>
                    <Link className="btn btn-ghost" style={{ marginTop: 18 }} href={item.href} data-seo-cta="commercial_versus" data-cta-position="versus" data-cta-stage="comparison" data-cta-destination="comparison">Ver comparação com {item.name}</Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="Ferramentas gratuitas" title="Quer medir antes de decidir?" body="Use os ativos P1 para transformar a dor de preservação em próximo passo concreto: checklist ou cálculo de exposição." />
            <div style={s.grid}>
              <article style={s.card}>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Checklist de Preservação Avançada</h3>
                <p style={s.small}>Um roteiro rápido para revisar chip, cadência, variações, monitoramento e recuperação.</p>
                <Link className="btn btn-accent" style={{ marginTop: 18 }} href={checklistHref} data-seo-cta="commercial_checklist" data-cta-position="p1_assets_primary" data-cta-stage="lead_magnet" data-cta-destination="checklist">Abrir checklist</Link>
              </article>
              <article style={s.card}>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Calculadora de risco</h3>
                <p style={s.small}>Estime exposição por volume, intervalo, repetição, chip e monitoramento.</p>
                <Link className="btn btn-ghost" style={{ marginTop: 18 }} href={riskCalculatorHref} data-seo-cta="commercial_risk_calculator" data-cta-position="p1_assets_secondary" data-cta-stage="tool" data-cta-destination="calculator">Calcular risco</Link>
              </article>
            </div>
          </div>
        </section>

        {related.length ? (
          <section style={s.section}>
            <div className="wrap">
              <SectionHeader eyebrow="Continue lendo" title={relatedTitle} />
              <div style={s.grid}>
                {related.map((item) => (
                  <article key={item.href} style={s.card}>
                    <h3 style={{ fontSize: 20, marginBottom: 10 }}>{item.label}</h3>
                    <p style={s.small}>{item.note}</p>
                    <Link
                      className="btn btn-ghost"
                      style={{ marginTop: 18 }}
                      href={item.href}
                      data-seo-cta="commercial_related"
                      data-cta-position="related"
                      data-cta-stage="consideration"
                      data-cta-destination="content"
                    >
                      Ler
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section style={s.section}>
          <div className="wrap">
            <div style={{ ...s.softCard, textAlign: 'center' }}>
              <span className="pill"><span className="dot" />Canais + preservação</span>
              <h2 style={{ ...s.h2, marginInline: 'auto', maxWidth: 760 }}>Quer transformar WhatsApp em uma operação menos frágil?</h2>
              <p style={{ ...s.lead, maxWidth: 760, margin: '0 auto' }}>Veja a landing principal da campanha e entenda como grupos, canais e Módulo de Preservação Avançada trabalham juntos.</p>
              <div style={{ ...s.ctas, justifyContent: 'center' }}>
                <Link className="btn btn-accent" href={mainLandingHref} data-seo-cta="commercial_campaign_landing" data-cta-position="final_primary" data-cta-stage="consideration" data-cta-destination="landing">Ver campanha Canais + Preservação</Link>
                <Link className="btn btn-ghost" href={diagnosticHref} data-seo-cta="commercial_diagnostic" data-cta-position="final_secondary" data-cta-stage="diagnostic" data-cta-destination="diagnostic">Diagnosticar minha operação</Link>
              </div>
            </div>
          </div>
        </section>

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="FAQ" title="Dúvidas frequentes antes de configurar." />
            <div style={{ display: 'grid', gap: 14 }}>
              {page.faqs.map(([question, answer]) => (
                <details key={question} style={s.card}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>{question}</summary>
                  <p style={{ ...s.small, marginTop: 12 }}>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
