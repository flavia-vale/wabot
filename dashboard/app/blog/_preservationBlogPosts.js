import { Fragment } from 'react'
import Link from 'next/link'
import { ArticleShell } from '@/components/marketing/ArticleShell'
import { getSiteUrl } from '@/lib/site-url'
import {
  buildArticleJsonLd,
  getEditorialDates,
  EDITORIAL_PERSON_AUTHOR,
  EDITORIAL_PERSON_AUTHOR_DESCRIPTION,
  EDITORIAL_PERSON_AUTHOR_PHOTO_PATH,
  EDITORIAL_PERSON_AUTHOR_LINKEDIN_URL,
  EDITORIAL_PERSON_AUTHOR_ID_PATH,
  EDITORIAL_PERSON_AUTHOR_SAME_AS,
} from '@/lib/editorial-content'
import { internalContentHref } from '@/lib/marketing-attribution'
import { buildOgImageDescriptor } from '@/lib/seo-og'

const siteUrl = getSiteUrl()

export const PRESERVATION_BLOG_POSTS = {
  'grupo-ou-canal-whatsapp-achadinhos': {
    slug: '/blog/grupo-ou-canal-whatsapp-achadinhos',
    title: 'Grupo ou Canal do WhatsApp: qual é melhor?',
    description: 'Quando usar grupo, quando usar Canal do WhatsApp e como combinar os dois para divulgar achadinhos, com o que cada um exige de ritmo e de plano.',
    eyebrow: 'Canais · Estratégia de migração',
    origin: 'blog_grupo_ou_canal_whatsapp_achadinhos',
    heroImage: { path: '/blog/hero/21-grupo-canal.png', alt: 'Ilustração comparando grupo (comunidade) e Canal do WhatsApp (vitrine) lado a lado, com o símbolo de mais entre os dois', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'A resposta curta: grupo é melhor para conversa e comunidade; canal é melhor para vitrine organizada. Para afiliados de achadinhos, a operação mais madura costuma combinar os dois com papéis diferentes.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use grupos quando você precisa de conversa, feedback e senso de comunidade. Use Canais do WhatsApp quando a prioridade é publicar ofertas em formato de vitrine, com menos ruído e mais previsibilidade de leitura.', 'O erro é tratar grupo e canal como concorrentes. Em uma operação de achadinhos, o grupo pode continuar como fonte ou comunidade, enquanto o canal vira destino principal das ofertas selecionadas.'] },
      { h2: 'Quando o grupo faz sentido', bullets: ['Comunidade que comenta e pede indicação.', 'Curadoria colaborativa de achadinhos.', 'Relacionamento com seguidores mais próximos.', 'Testes rápidos de oferta e feedback.'] },
      { h2: 'Quando o canal faz sentido', bullets: ['Publicação de ofertas em vitrine limpa.', 'Menos ruído de conversa entre membros.', 'Organização por nicho, frequência e calendário.', 'Distribuição mais clara para quem quer só receber oportunidades.'] },
      { h2: 'O modelo recomendado', paragraphs: ['Comece mapeando quais grupos geram boas ofertas, quais grupos têm audiência engajada e quais canais podem funcionar como vitrine. Depois, defina regras de espelhamento para que cada destino receba a oferta no ritmo certo.', 'O Espelha Grupos entra como camada operacional: acompanha as origens que você escolhe, troca cada link pelo seu código de afiliada nas 6 lojas e publica nos seus destinos. Espelhar entre grupos está em todos os planos; publicar em Canal do WhatsApp e ajustar o ritmo de cada destino (intervalo, horário de descanso, limite por dia e variação do texto) são do plano Pro.'] },
    ],
    relatedTitle: 'Continue: o que divulgar nos seus achadinhos',
    relatedLinks: [
      { href: '/grupo-para-canal-whatsapp', label: 'Como levar um grupo para o Canal', note: 'o caminho prático, sem perder quem já está no grupo' },
      { href: '/blog/shadowban-whatsapp-canais', label: 'Canal com alcance despencando', note: 'o que costuma estar por trás e o que dá para fazer' },
      { href: '/blog/bot-whatsapp-antiban-existe', label: 'Existe bot que não é banido?', note: 'o que ninguém pode prometer, e o que dá para reduzir' },
      { href: '/blog/como-escalar-grupos-sem-operacao-manual', label: 'Quando o trabalho manual deixa de caber', note: 'o sinal de que a operação passou do ponto' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual programa escolher', note: 'comissão e prazo de atribuição dos três, lado a lado' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'o programa mais buscado no Brasil' },
      { href: '/bot-achadinhos-whatsapp', label: 'Automatizar um grupo de achadinhos', note: 'conversão de link e cadência controlada' },
    ],
    faq: [
      { q: 'Canal vende mais que grupo?', a: 'Depende do público. Canal tende a ser melhor como vitrine organizada; grupo tende a ser melhor para conversa e comunidade. O ideal é testar os dois com papéis diferentes.' },
      { q: 'Preciso abandonar meus grupos?', a: 'Não. A migração mais segura mantém grupos úteis e adiciona canais como camada de distribuição organizada.' },
      { q: 'Como o Espelha Grupos ajuda nessa escolha?', a: 'Ele espelha entre grupos em todos os planos e entre grupos e canais no plano Pro, com o ritmo de cada destino configurado à parte. Ele não mede o alcance do canal: isso você acompanha nos números do próprio canal e nos cliques do seu link de afiliada.' },
    ],
  },
  'como-evitar-banimento-whatsapp-afiliados': {
    slug: '/blog/como-evitar-banimento-whatsapp-afiliados',
    title: 'Como reduzir o risco de banimento no WhatsApp',
    description: 'Guia honesto para afiliados reduzirem o risco no WhatsApp: chip dedicado, ritmo por destino, texto que varia e grupos autorizados. Sem promessa de imunidade.',
    eyebrow: 'Preservação avançada · Risco operacional',
    origin: 'blog_como_evitar_banimento_whatsapp_afiliados',
    heroImage: { path: '/blog/hero/22-protecao-camadas.png', alt: 'Preservação avançada em quatro camadas: cadência, variações, monitoramento e recuperação', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'Não existe garantia contra banimento. O que existe é uma operação menos robótica: chip dedicado, volume controlado, texto que varia, grupos que querem receber e um plano B se o número cair.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Para reduzir risco, pare de operar como disparo: use chip dedicado, limite a quantidade por hora e por dia, evite madrugada, varie o texto, publique só em grupos onde você tem autorização e preste atenção a denúncias e saídas de membros.', 'No Espelha Grupos, os controles de ritmo ficam no Módulo de Preservação Avançada, do plano Pro. O termo “anti-ban” aparece nas buscas, mas não é promessa: nenhuma ferramenta controla a decisão do WhatsApp.'] },
      { h2: 'Checklist mínimo de preservação', bullets: ['Usar chip dedicado, nunca o número pessoal.', 'Definir intervalo entre envios e limite por dia em cada destino.', 'Ter horário de descanso, sem envio de madrugada.', 'Evitar a mesma mensagem idêntica em todos os destinos.', 'Publicar só em grupos com autorização de quem administra.', 'Ter um plano B: um segundo chip e a lista dos grupos e canais que você administra.'] },
      { h2: 'O que aumenta risco', paragraphs: ['Publicar muitas ofertas em sequência, repetir o mesmo texto em vários destinos e depender de um único grupo ou chip aumenta a fragilidade da operação.', 'Outro ponto crítico é não perceber que algo mudou. Denúncia de membro pesa mais que volume, e saída em massa de um grupo é sinal para reduzir o ritmo naquele destino antes que o problema chegue ao número.'] },
      { h2: 'Como o Espelha Grupos organiza o processo', paragraphs: ['No plano Pro, cada destino tem intervalo mínimo entre envios, limite de envios em sequência, limite por dia, horário de descanso e variação do texto; oferta que esperou demais na fila é descartada em vez de sair velha. Em todos os planos, a mesma oferta não sai duas vezes no mesmo grupo e o histórico mostra o que saiu, o que foi bloqueado e por quê.', 'A ferramenta não controla a decisão do WhatsApp e não mede o alcance dos seus canais. O que ela faz é tirar da operação o comportamento de disparo.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'comissão real de Shopee, Amazon e Mercado Livre' },
      { href: '/anti-ban-whatsapp', label: 'Reduzir o risco de banimento na prática', note: 'cadência, limites e preservação de sessão' },
      { href: '/blog/chip-dedicado-bot-whatsapp', label: 'Por que usar chip dedicado', note: 'separar o número pessoal da operação' },
    ],
    faq: [
      { q: 'Existe “anti-ban” 100%?', a: 'Não. Qualquer promessa absoluta deve ser tratada como sinal de alerta. A abordagem correta é redução de risco com camadas de preservação.' },
      { q: 'Chip dedicado é obrigatório?', a: 'É a recomendação mais segura. O número pessoal não deve sustentar uma operação comercial de achadinhos.' },
      { q: 'Canal é mais seguro que grupo?', a: 'Canal ajuda a organizar a vitrine, mas ainda precisa de ritmo e de texto que varia. Formato sozinho não resolve operação mal configurada.' },
    ],
  },
  'shadowban-whatsapp-canais': {
    slug: '/blog/shadowban-whatsapp-canais',
    title: 'Shadowban em Canais do WhatsApp: sinais para notar',
    description: 'Os sinais de queda silenciosa em Canais do WhatsApp e o que conferir (cliques, entrega e uma conta-sentinela) antes do prejuízo.',
    eyebrow: 'Monitoramento · Canais do WhatsApp',
    origin: 'blog_shadowban_whatsapp_canais',
    heroImage: { path: '/blog/hero/28-sinais.png', alt: 'Cinco sinais silenciosos de shadowban: cliques caindo, respostas caindo, mensagens idênticas em canais diferentes, destino falhando sem aviso', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'O problema do shadowban é que ele raramente aparece como um aviso claro. O afiliado percebe quando os cliques somem, as ofertas param de performar e o canal já perdeu força.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Você deve monitorar queda brusca de cliques, atraso de entrega, erros recorrentes, sumiço de visualizações e divergência entre publicação e recebimento por uma conta-sentinela.', 'Nenhum sinal isolado prova shadowban. Mas um conjunto de sinais deve acionar redução de cadência e revisão da operação.'] },
      { h2: 'Sinais que merecem atenção', bullets: ['Cliques caem sem mudança de oferta ou horário.', 'Seguidores relatam que não viram publicações.', 'Mensagens demoram mais para aparecer.', 'Canais parecidos performam bem, mas um canal específico despenca.', 'Erros técnicos começam a se repetir.'] },
      { h2: 'Conta-sentinela: por que ela importa', paragraphs: ['Uma conta-sentinela é um número secundário que segue seus canais e confirma se as mensagens aparecem como deveriam. Ela ajuda a detectar diferença entre “post publicado” e “post realmente visto”.'] },
      { h2: 'O que fazer quando o risco sobe', paragraphs: ['Reduza frequência, pause publicações no canal afetado, revise o texto e confira se houve mudança de comportamento recente. Se o canal continuar em risco, prepare um plano B antes que a audiência fique inacessível: um canal reserva e um jeito de avisar seus seguidores.', 'No Espelha Grupos (plano Pro), dá para reduzir o ritmo só daquele canal, com intervalo maior e menos envios por dia, sem mexer nos outros destinos.'] },
    ],
    relatedTitle: 'Continue: risco de bloqueio no WhatsApp',
    relatedLinks: [
      { href: '/blog/migrar-grupo-achadinhos-para-canal', label: 'Levar o grupo para o Canal sem perder ninguém', note: 'o caminho prático, passo a passo' },
      { href: '/anti-ban-whatsapp', label: 'WhatsApp banido: o que aumenta e o que reduz o risco', note: 'sem promessa de imunidade' },
      { href: '/blog/bot-whatsapp-antiban-existe', label: 'Bot antiban existe mesmo?', note: 'o que nenhuma ferramenta pode garantir' },
      { href: '/faq-antiban-whatsapp', label: 'Perguntas frequentes sobre banimento', note: 'respostas diretas' },
    ],
    faq: [
      { q: 'Shadowban no WhatsApp é sempre comprovável?', a: 'Não. Normalmente você trabalha com sinais indiretos: cliques, entrega, relatos, conta-sentinela e comparação entre canais.' },
      { q: 'O Espelha Grupos detecta shadowban?', a: 'Não. Ele não mede alcance nem visualização do canal. O que ele mostra é o lado do envio: o que saiu, quando e o que falhou. Para alcance, compare os cliques no seu link de afiliada e use uma conta-sentinela.' },
      { q: 'O que fazer primeiro diante de queda brusca?', a: 'Pause ou reduza cadência, compare canais semelhantes e valide recebimento com conta-sentinela.' },
    ],
  },
  'migrar-grupo-achadinhos-para-canal': {
    slug: '/blog/migrar-grupo-achadinhos-para-canal',
    title: 'Migrar um grupo de achadinhos para Canal do WhatsApp',
    description: 'Passo a passo para migrar grupos de achadinhos para Canais do WhatsApp sem interromper a operação e preservando audiência.',
    eyebrow: 'Migração · Grupo para canal',
    origin: 'blog_migrar_grupo_achadinhos_para_canal',
    heroImage: { path: '/blog/hero/11-fluxo.png', alt: 'Fluxo de migração: monitora, encaminha e converte, ponta a ponta', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'A migração não deve ser um corte brusco. O caminho mais seguro é transformar o canal em vitrine, manter o grupo como apoio e usar espelhamento com cadência controlada.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Crie o canal, anuncie a mudança no grupo, publique ofertas em paralelo por alguns dias, acompanhe cliques e só depois reduza a dependência do grupo.', 'Com o Espelha Grupos (plano Pro), você publica as mesmas ofertas no grupo e no canal durante a transição, cada destino com o seu ritmo, sem copiar e colar duas vezes.'] },
      { h2: 'Passo a passo recomendado', bullets: ['Faça inventário dos grupos, canais e fontes atuais.', 'Crie o canal com nome claro e descrição fiel ao conteúdo.', 'Avise o grupo com CTA simples para seguir o canal.', 'Publique em paralelo antes de cortar qualquer fluxo.', 'Monitore cliques, visualizações e reclamações.'] },
      { h2: 'Como evitar uma migração confusa', paragraphs: ['Não mude tudo de uma vez. Se você troca formato, frequência e copy no mesmo dia, fica impossível saber o que afetou o resultado. Preserve um padrão por vez e compare dados.'] },
      { h2: 'Onde entra o Módulo de Preservação Avançada', paragraphs: ['Ele define intervalo entre envios, limite por dia, horário de descanso e variação do texto em cada destino, para que o canal novo não nasça com cara de disparo. O canal deve parecer administrado por uma pessoa, não por um disparador. É um recurso do plano Pro.'] },
    ],
    relatedTitle: 'Continue: grupos, canais e achadinhos',
    relatedLinks: [
      { href: '/blog/shadowban-whatsapp-canais', label: 'Canal com alcance despencando', note: 'depois de migrar, é o próximo susto comum' },
      { href: '/glossario', label: 'Glossário: os termos que aparecem no painel', note: 'em português claro, sem jargão' },
      { href: '/blog/grupo-ou-canal-whatsapp-achadinhos', label: 'Grupo ou canal para achadinhos?', note: 'o que muda em alcance e em risco' },
      { href: '/bot-achadinhos-whatsapp', label: 'Automatizar um grupo de achadinhos', note: 'da conversão do link ao envio' },
      { href: '/bot-canal-whatsapp', label: 'Publicar em Canais do WhatsApp', note: 'como o Espelha Grupos envia para canal' },
    ],
    faq: [
      { q: 'Quanto tempo dura a migração?', a: 'Depende do tamanho da audiência, mas uma janela de paralelismo entre grupo e canal costuma ser mais segura que migração imediata.' },
      { q: 'Posso manter grupo e canal para sempre?', a: 'Sim. Muitos afiliados usam grupo como comunidade e canal como vitrine de ofertas.' },
      { q: 'O Espelha Grupos espelha grupo para canal?', a: 'Sim, no plano Pro: grupo para canal, canal para grupo e canal para canal. Grupo para grupo está em todos os planos.' },
    ],
  },
  'chip-dedicado-bot-whatsapp': {
    slug: '/blog/chip-dedicado-bot-whatsapp',
    title: 'Por que usar um chip só para o bot do WhatsApp',
    description: 'Entenda por que chip dedicado protege sua operação de afiliados no WhatsApp e evita misturar número pessoal com canais e grupos de ofertas.',
    eyebrow: 'Operação responsável · Chip dedicado',
    origin: 'blog_chip_dedicado_bot_whatsapp',
    heroImage: { path: '/blog/hero/25-antiban-honesto.png', alt: 'Checklist de preservação avançada começando por chip dedicado, cadência por destino e limite de horário', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'Se o WhatsApp gera receita, o chip virou ativo operacional. Usar o número pessoal para rodar bot, grupos e canais mistura risco comercial com vida pessoal.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Afiliados devem usar chip dedicado porque o número que publica, segue canais e administra rotina de ofertas é parte da infraestrutura do negócio.', 'Se esse número cair, travar ou precisar ser substituído, o impacto deve ficar isolado da sua vida pessoal e do seu atendimento principal.'] },
      { h2: 'Riscos de usar número pessoal', bullets: ['Perder acesso a conversas pessoais em caso de bloqueio.', 'Misturar rotina comercial e vida privada.', 'Dificultar recuperação da operação.', 'Não conseguir separar testes, canais e alertas.', 'Aumentar ansiedade operacional a cada instabilidade.'] },
      { h2: 'Como tratar chip como ativo', paragraphs: ['Registre quem usa o chip, onde ele está conectado, quais canais administra e quais rotinas dependem dele. Tenha backup de configurações, lista de canais e processo de substituição.'] },
      { h2: 'Papel do Espelha Grupos', paragraphs: ['O Espelha Grupos não elimina o risco do chip. Depois que você lê o QR Code, ele roda no servidor, então o celular com o chip não precisa ficar ligado, e o painel mostra quando a conexão cai.', 'Se precisar trocar de chip, as configurações ficam na sua conta: basta ler o QR Code com o número novo, que precisa estar nos mesmos grupos e canais.'] },
    ],
    relatedTitle: 'Continue: proteger o número da operação',
    relatedLinks: [
      { href: '/blog/checklist-padronizar-divulgacao-whatsapp', label: 'Checklist para padronizar o que você publica', note: 'chip dedicado é só uma parte do cuidado' },
      { href: '/anti-ban-whatsapp', label: 'WhatsApp banido: o que aumenta e o que reduz o risco', note: 'os fatores que realmente pesam' },
      { href: '/blog/como-evitar-banimento-whatsapp-afiliados', label: 'Reduzir risco de banimento como afiliado', note: 'cadência e variação de texto' },
      { href: '/protecao-antiban-espelha-grupos', label: 'Como o Espelha Grupos preserva a sessão', note: 'limites por destino e monitoramento' },
    ],
    faq: [
      { q: 'Posso começar com meu número pessoal?', a: 'Não é recomendado. Mesmo operações pequenas deveriam separar número pessoal e número operacional desde o início.' },
      { q: 'Preciso de mais de um chip?', a: 'Para começar, um chip dedicado já reduz bastante a mistura de risco. Operações maiores podem estruturar chips por função.' },
      { q: 'Chip dedicado evita banimento?', a: 'Não. Ele reduz o impacto e melhora a organização, mas precisa vir junto de ritmo, texto que varia e uso responsável.' },
    ],
  },
  'bot-whatsapp-antiban-existe': {
    slug: '/blog/bot-whatsapp-antiban-existe',
    title: 'Bot “anti-ban” para WhatsApp existe? A resposta honesta',
    description: 'Por que “anti-ban” absoluto não existe e o que o Módulo de Preservação Avançada do Espelha Grupos controla de fato para reduzir o risco.',
    eyebrow: 'Busca “anti-ban” · Resposta honesta',
    origin: 'blog_bot_whatsapp_antiban_existe',
    heroImage: { path: '/blog/hero/23-sem-promessa.png', alt: 'Comparação entre a promessa vazia de "anti-ban 100%" e o processo real de preservação em camadas', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'A resposta honesta é: bot “anti-ban” absoluto não existe. O que existe é controlar o ritmo do que sai e cuidar de como a operação é montada: chip dedicado, grupos autorizados e texto que não se repete idêntico.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Nenhum bot controla decisões da plataforma. Portanto, qualquer promessa de “anti-ban 100%” deve ser tratada como exagero comercial.', 'O Espelha Grupos tem o Módulo de Preservação Avançada (plano Pro), que controla o ritmo de cada destino. Chip dedicado e grupos autorizados ficam por sua conta, e pesam tanto quanto.'] },
      { h2: 'Por que o termo “anti-ban” aparece', paragraphs: ['Afiliados pesquisam por “anti-ban” porque sentem medo real de perder chip, canal e audiência. Usar o termo ajuda a responder a busca, mas a comunicação precisa deixar claro que não é garantia absoluta.'] },
      { h2: 'O que a preservação avançada faz', bullets: ['Intervalo mínimo entre envios em cada destino.', 'Limite de envios em sequência e limite por dia.', 'Horário de descanso, sem envio de madrugada.', 'Variação do texto, para a mesma oferta não sair idêntica em todos os destinos.', 'Descarte da oferta que esperou demais na fila, em vez de sair velha.', 'Em todos os planos: a mesma oferta não sai duas vezes no mesmo grupo.'] },
      { h2: 'O que ela não faz', paragraphs: ['Não mede alcance nem cliques do canal, não pausa sozinha quando o risco sobe e não recupera um número banido. Esses sinais você acompanha e essas decisões você toma; a ferramenta controla o ritmo do que sai.'] },
      { h2: 'Como avaliar uma ferramenta', paragraphs: ['Desconfie de ferramenta que só promete “não banir”. Prefira produto que explica limites, recomenda chip dedicado, fala de uso responsável e mostra quais camadas realmente controla.'] },
    ],
    relatedTitle: 'Continue: o que dá e o que não dá para prometer',
    relatedLinks: [
      { href: '/blog/quanto-custa-bot-para-whatsapp-afiliados', label: 'Quanto custa um bot para WhatsApp', note: 'preço das ferramentas do mercado, com fonte e data' },
      { href: '/anti-ban-whatsapp', label: 'WhatsApp banido: o que aumenta e o que reduz o risco', note: 'redução de risco, não imunidade' },
      { href: '/faq-antiban-whatsapp', label: 'Perguntas frequentes sobre banimento', note: 'as dúvidas mais comuns' },
      { href: '/protecao-antiban-espelha-grupos', label: 'Como o Espelha Grupos preserva a sessão', note: 'o que a ferramenta faz de fato' },
    ],
    faq: [
      { q: 'Então o Espelha Grupos é “anti-ban”?', a: 'Não como promessa. O Espelha Grupos controla o ritmo do que sai para reduzir o risco; a decisão de banir é do WhatsApp.' },
      { q: 'Por que não prometer 100%?', a: 'Porque nenhuma ferramenta externa controla todas as decisões da plataforma. Prometer 100% seria desonesto.' },
      { q: 'O que devo ativar primeiro?', a: 'Chip dedicado, intervalo e limite por dia em cada destino, horário de descanso e variação do texto.' },
    ],
  },
  'comecar-afiliado-whatsapp-sem-grupo-grande': {
    slug: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande',
    title: 'Começar como afiliado no WhatsApp sem grupo grande',
    description: 'Como um afiliado iniciante começa a divulgar ofertas no WhatsApp sem audiência: chip dedicado, primeiros grupos, conversão de link e ritmo responsável.',
    eyebrow: 'Para quem está começando · Passo a passo',
    origin: 'blog_comecar_afiliado_whatsapp_sem_grupo_grande',
    heroImage: { path: '/blog/hero/04-proteja-comissao.png', alt: 'Comissão vazando para outro afiliado sem proteção, contra 100% da comissão protegida com o bot ativado', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'Você não precisa de um grupo gigante para começar a ganhar comissão no WhatsApp. Precisa de um chip dedicado, links de afiliado convertidos certo e uma rotina de envio que não pareça spam. O resto cresce com consistência.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Comece pequeno e organizado: separe um chip só para a operação, cadastre seus IDs de afiliada (Mercado Livre, Amazon, Shopee), monte 1 ou 2 grupos/canais de destino e publique poucas ofertas boas por dia com texto que pareça você falando.', 'Grupo grande é consequência, não pré-requisito. Quem começa focando em volume costuma queimar o número antes de ter audiência.'] },
      { h2: 'O que você precisa no dia 1', bullets: ['Um chip dedicado (nunca o número pessoal).', 'Contas de afiliado nas plataformas que você vai divulgar.', 'Um grupo ou canal de destino, mesmo que pequeno.', 'Uma fonte de ofertas (grupos que você acompanha, sites, encartes).', 'Uma ferramenta que converte o link e mantém cadência.'] },
      { h2: 'O erro mais comum de quem começa', paragraphs: ['O iniciante cola o link cru, sem converter para afiliado — e perde a comissão da venda que ele mesmo gerou. O segundo erro é despejar 30 ofertas seguidas no mesmo dia, o que parece spam e arrisca o número.', 'A correção é simples: converta todo link antes de enviar e limite a frequência. Poucas ofertas boas convertem mais do que muitas ofertas repetidas.'] },
      { h2: 'Como o Espelha Grupos ajuda quem está começando', paragraphs: ['O Espelha Grupos converte automaticamente os links de Mercado Livre, Amazon e Shopee para o seu código de afiliada antes de enviar, espelha as ofertas dos grupos que você acompanha para os seus destinos e mantém uma cadência responsável para reduzir risco no número.', 'Para quem está começando, isso elimina a parte chata (copiar, converter, reescrever, reenviar) e deixa você focar em escolher boas ofertas.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
      { href: '/blog/como-evitar-banimento-whatsapp-afiliados', label: 'O que faz o WhatsApp restringir um número', note: 'vale saber antes de crescer, não depois' },
      { href: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', label: 'Que horas as ofertas rendem mais', note: 'com poucos contatos, a hora certa pesa mais' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'cadastro gratuito, comissão a partir de 3%' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'Shopee, Amazon e Mercado Livre comparados' },
      { href: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', label: 'Montar um grupo de ofertas do zero', note: 'os primeiros passos' },
    ],
    faq: [
      { q: 'Preciso de muitos seguidores para começar?', a: 'Não. Dá para começar com um grupo ou canal pequeno. O que importa no início é converter os links corretamente e manter consistência, não o tamanho da audiência.' },
      { q: 'Posso usar meu WhatsApp pessoal?', a: 'Não é recomendado. Use um chip dedicado para a operação, separando do seu número pessoal e reduzindo o risco de perder seus contatos se algo der errado.' },
      { q: 'O Espelha Grupos converte os links sozinho?', a: 'Sim. Ele converte links suportados (Mercado Livre, Amazon, Shopee) para o seu código de afiliada antes do envio, então você não esquece de marcar a comissão.' },
    ],
  },
  'como-ser-afiliado-shopee-whatsapp': {
    slug: '/blog/como-ser-afiliado-shopee-whatsapp',
    title: 'Shopee Afiliados: como entrar e quanto paga',
    description: 'Como entrar no Shopee Afiliados, quanto a Shopee paga por tipo de venda, o prazo para a comissão contar e como divulgar no WhatsApp sem perder venda.',
    eyebrow: 'Shopee Afiliados · Guia completo',
    origin: 'blog_como_ser_afiliado_shopee_whatsapp',
    heroImage: { path: '/blog/hero/shopee-afiliada-hero.jpg', alt: 'Mascote Bit ao lado da tela de conversão de ofertas da Shopee no Espelha Grupos', width: 1024, height: 1024 },
    leadMagnetVariant: 'afiliados',
    // FR-027 (US6, specs/013-inbound-leads-strategy): a chamada de produto
    // fica no FIM do artigo, depois de cadastro/comissão/regras/divulgação —
    // nunca no meio, disputando atenção com o conteúdo técnico. `position:
    // 'end'` é o que muda o comportamento padrão do render (ver
    // PreservationBlogPost abaixo); outros posts com midBridge continuam na
    // posição padrão (meio do artigo) até decisão em contrário.
    midBridge: {
      question: 'Já tem um grupo ou canal pra divulgar?',
      body: 'Se já tem, o gargalo deixa de ser o cadastro na Shopee e passa a ser o trabalho de postar oferta por oferta. O Espelha Grupos pega os links, troca pelo seu código de afiliada e posta sozinho — com intervalo controlado entre os envios. Teste 7 dias, sem cartão.',
      cta: 'Ver preços e testar grátis',
      href: '/precos',
      secondary: { label: 'Ainda não tenho grupo', href: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero' },
      position: 'end',
    },
    usePersonAuthor: true,
    intro: 'Shopee Afiliados é o programa que paga comissão sobre vendas geradas pelo seu link. O cadastro é gratuito, a comissão parte de 3% e a atribuição vale por até 7 dias após o clique. Divulgar no WhatsApp funciona bem quando o link sai sempre com o seu código e a frequência de envio é controlada.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Cadastre-se no Programa de Afiliados Shopee, pegue suas credenciais de afiliado, gere o link de cada produto com o seu código e divulgue no WhatsApp com texto próprio e frequência controlada.', 'O ponto crítico é garantir que TODO link enviado já esteja convertido para o seu código — senão a venda acontece, mas a comissão não cai para você.'] },
      { h2: 'Quanto paga a comissão da Shopee', paragraphs: ['A comissão-base é de 3% sobre o valor líquido da venda (sem impostos, cupons ou frete), tanto para vendas via redes sociais/WhatsApp quanto para vendas geradas em lives e Shopee Vídeo.', 'Existe também o programa de Comissão Extra: ao divulgar produtos de parceiros selecionados, a comissão pode chegar a até 30% — a comissão padrão da Shopee soma com uma comissão extra paga pelo próprio vendedor.'], table: { headers: ['Tipo de venda', 'Comissão'], rows: [['Venda padrão (redes sociais e WhatsApp)', '3%'], ['Vendas em lives', '3%'], ['Vendas via Shopee Vídeo', '3%'], ['Produtos do programa de Comissão Extra', 'até 30% (padrão + extra do vendedor)']], note: 'Fonte: Shopee Affiliate Program, "Entenda o Comissionamento da Shopee" (consultado em 30/07/2026). Comissão calculada sobre o valor líquido da venda; sujeita às condições especiais e a alterações sem aviso prévio da Shopee.' } },
      { h2: 'Prazo para a comissão ser atribuída a você', paragraphs: ['Quando alguém clica no seu link e adiciona o produto ao carrinho, a Shopee guarda essa atribuição por até 7 dias — mesmo que a pessoa não compre na hora, você ainda ganha a comissão se ela finalizar a compra dentro desse prazo.', 'Sites e apps especializados em cupom, cashback ou tecnologia têm taxa de comissão sob consulta — as regras padrão valem para o afiliado comum divulgando em grupos e canais.'] },
      { h2: 'Como se tornar afiliado Shopee: passo a passo', paragraphs: ['Tornar-se afiliado Shopee leva poucos minutos e não tem custo. O cadastro é feito no site do Programa de Afiliados Shopee, e depois da aprovação você já consegue gerar links com o seu código.'], bullets: ['Acesse o site do Programa de Afiliados Shopee e crie sua conta.', 'Confirme seus dados cadastrais e aguarde a aprovação.', 'Ao entrar na sua conta de afiliado, localize suas credenciais (appId / secret).', 'Gere links com o seu código para os produtos que vai divulgar.', 'Organize seus grupos e canais de destino no WhatsApp antes de começar a publicar.'] },
      // Adicionado em 2026-08-19 (US6, specs/013-inbound-leads-strategy,
      // FR-027): das quatro coberturas exigidas (cadastro, comissão, regras,
      // como divulgar), "regras" era a que faltava — o guia falava de
      // comissão e prazo, mas não do que o programa proíbe. Regras gerais de
      // programa de afiliado, sem citar número que exigiria fonte/data (ao
      // contrário da tabela de comissão acima).
      { h2: 'Regras do programa que você precisa respeitar', paragraphs: ['Nenhum programa de afiliado paga comissão sobre compra feita com o seu próprio link — comprar para você mesmo não gera comissão e pode levar à suspensão da conta de afiliado.', 'A divulgação precisa ser honesta: preço, condição e disponibilidade anunciados têm que bater com o que está realmente na página do produto. Prometer desconto ou brinde que não existe é o tipo de coisa que gera denúncia e desgasta o grupo.', 'O programa não é feito para disparo em massa sem critério — cadência e relevância protegem tanto a sua conta de afiliado quanto o número de WhatsApp usado para divulgar.'], bullets: ['Nunca compre pelo próprio link de afiliado esperando comissão.', 'Não anuncie preço, cupom ou condição que não existe de verdade no produto.', 'Publique só para quem topou receber oferta — divulgação sem consentimento gera denúncia.', 'Guarde suas credenciais (appId/secret) só para você — são o que identifica suas vendas.'] },
      { h2: 'Como divulgar sem queimar o número', paragraphs: ['Use um chip dedicado, publique poucas ofertas boas por vez, varie o texto e evite mandar a mesma mensagem idêntica para todos os destinos ao mesmo tempo.', 'Quem dispara dezenas de links iguais em sequência arrisca o número e ainda cansa a audiência. Cadência responsável vende mais no médio prazo.'] },
      { h2: 'Como o Espelha Grupos automatiza a Shopee', paragraphs: ['Com as credenciais de afiliada Shopee cadastradas, o Espelha Grupos converte os links para o seu código automaticamente antes de enviar, monta a oferta com título e preço e distribui para os seus grupos e canais com cadência controlada.', 'Assim você não precisa gerar link a link na mão nem corre o risco de enviar um link sem comissão.'] },
    ],
    relatedLinks: [
      { href: '/blog/melhores-automacoes-para-afiliado-shopee-2026', label: 'As automações que um afiliado Shopee usa em 2026', note: 'espelhar, garimpar, converter, enfileirar — e quem faz cada uma' },
      { href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', label: 'Como espelhar mensagens entre grupos', note: 'os 4 caminhos e o passo a passo com o robô' },
      { href: '/quanto-ganha-afiliado-shopee', label: 'Quanto ganha um afiliado Shopee, na prática', note: 'a conta que transforma a tabela de comissão em dinheiro no mês' },
      { href: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp', label: 'Shopee, Amazon ou Mercado Livre: qual escolher primeiro', note: 'comparação de comissão e prazo, para decidir por onde começar' },
      { href: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande', label: 'Começar sem ter grupo grande', note: 'o que dá para fazer com poucos contatos' },
      { href: '/shopee-afiliados-whatsapp', label: 'Divulgar Shopee no WhatsApp sem copiar e colar', note: 'o que muda na prática depois do cadastro' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual programa escolher', note: 'comparativo de comissão e prazo de atribuição dos três' },
      { href: '/blog/como-divulgar-ofertas-amazon-whatsapp', label: 'Afiliado Amazon: comissão por categoria', note: 'a Amazon paga de 0% a 13% dependendo do produto' },
      { href: '/bot-afiliados-whatsapp', label: 'Converter os links de afiliado automaticamente', note: 'para não enviar link sem o seu código' },
    ],
    faq: [
      { q: 'Ser afiliado Shopee é gratuito?', a: 'Sim, a entrada no programa de afiliados não tem custo. Você ganha comissão sobre as vendas geradas pelos seus links.' },
      { q: 'Shopee Afiliados como funciona?', a: 'Você se cadastra no programa, gera links de produtos com o seu código de afiliado e ganha comissão (a partir de 3%) sobre as vendas feitas por esse link em até 7 dias após o clique.' },
      { q: 'Como se tornar afiliado Shopee?', a: 'Crie sua conta no site do Programa de Afiliados Shopee, confirme seus dados e aguarde a aprovação. Depois disso, localize suas credenciais de afiliado na conta e comece a gerar links com o seu código. O cadastro é gratuito.' },
      { q: 'Como entrar na minha conta do Shopee Afiliados?', a: 'O acesso é feito pelo site do Programa de Afiliados Shopee, com o mesmo login da sua conta Shopee. É lá que ficam suas credenciais de afiliado, os relatórios de venda e a tabela de comissão vigente.' },
      { q: 'Preciso ter um site ou muitos seguidores para ser afiliado Shopee?', a: 'Não. É possível divulgar em grupos e canais de WhatsApp, redes sociais e listas próprias. O que importa é ter um público real e enviar sempre o link com o seu código de afiliado.' },
      { q: 'Quanto a Shopee paga de comissão?', a: 'A comissão padrão é 3% sobre o valor líquido da venda. Produtos do programa de Comissão Extra podem chegar a até 30%, somando a comissão padrão com uma comissão adicional paga pelo vendedor.' },
      { q: 'Preciso gerar cada link na mão?', a: 'Não, se usar uma ferramenta de conversão. Com as credenciais Shopee no Espelha Grupos, os links são convertidos automaticamente para o seu código antes do envio.' },
      { q: 'Posso divulgar Shopee e outras lojas juntas?', a: 'Sim. É comum divulgar Shopee, Mercado Livre e Amazon na mesma operação. O importante é manter cada link com o código de afiliado correto.' },
    ],
  },
  'como-divulgar-ofertas-amazon-whatsapp': {
    slug: '/blog/como-divulgar-ofertas-amazon-whatsapp',
    // Título encurtado em 2026-08-19 (P1): era 75 chars de texto próprio. O
    // número da comissão vai na frente — é o motivo concreto pra clicar.
    title: 'Afiliado Amazon: comissão por categoria (0% a 13%)',
    description: 'Guia de afiliado Amazon: quanto paga de comissão por categoria, como divulgar no WhatsApp com a tag correta e cadência que protege o número.',
    eyebrow: 'Afiliado Amazon · Divulgação',
    origin: 'blog_como_divulgar_ofertas_amazon_whatsapp',
    heroImage: { path: '/blog/hero/amazon-associado-hero.jpg', alt: 'Mascote Bit ao lado da tela de conversão de ofertas da Amazon no Espelha Grupos', width: 1024, height: 1024 },
    leadMagnetVariant: 'afiliados',
    midBridge: {
      question: 'Cansou de conferir a tag oferta por oferta?',
      body: 'Errar a tag é o jeito mais rápido de trabalhar de graça — e conferir na mão em cada link é o que mais consome tempo. O robô converte o link com a sua tag e posta no seu grupo, no intervalo que você definir. Teste 7 dias, sem cartão.',
      cta: 'Ver preços e testar grátis',
      href: '/precos',
      secondary: { label: 'Como converter link automaticamente', href: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp' },
    },
    usePersonAuthor: true,
    intro: 'Divulgar Amazon no WhatsApp como associado dá certo quando o link sai com a sua tag, o preview mostra a imagem do produto e o envio respeita uma cadência que não queima o número. A comissão varia por categoria — de 0% a 13% — e errar a tag é o jeito mais rápido de trabalhar de graça.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Entre no Amazon Associados, pegue sua tag de afiliado, gere o link do produto com essa tag e divulgue no WhatsApp com imagem, preço e texto próprio — controlando a frequência de envio.', 'A regra de ouro: confira sempre se a sua tag está no link antes de enviar. Sem a tag, a venda não gera comissão para você.'] },
      { h2: 'Quanto a Amazon paga de comissão por categoria', paragraphs: ['A comissão da Amazon Associados não é fixa — varia por categoria de produto, de 0% (categoria Coach) a 13% (bebê, beleza, saúde e alimentos).'], table: { headers: ['Categoria', 'Comissão'], rows: [['Bebê, Beleza, Beleza de Luxo, Saúde e Cuidados Pessoais, Bebidas Alcoólicas, Alimentos e Bebidas, Audiolivros', '13%'], ['Roupas, Pet Shop', '11%'], ['Livros, Livros Digitais', '10%'], ['Dispositivos Amazon (Echo, Fire TV, Kindle)', '9,5%'], ['Aventura e Lazer, Esportes, Brinquedos e Jogos, Móveis, Casa, Construção, Ferramentas, Cozinha, Jardim e Piscina, Eletrodomésticos', '8%'], ['Câmeras e Foto, Eletrônicos, Informática, Instrumentos Musicais, Papelaria, Celulares, Games e Consoles, TV e Áudio', '8%'], ['Bolsas, Malas e Mochilas, Calçados, Jóias, Relógios', '7%'], ['CD e Vinil, DVD e Blu-ray, Automotivo, Produtos Industriais e Científicos', '7%'], ['Outras categorias', '7%'], ['Coach', '0%']], note: 'Fonte: programa Amazon Associados, tabela de comissão padrão fixa (consultado em 30/07/2026). A Amazon também paga recompensas fixas por assinatura de Prime, Prime Video, Kindle Unlimited e Amazon Music — valores sujeitos a alteração sem aviso prévio.' } },
      { h2: 'O que cuidar nos links da Amazon', bullets: ['Garantir que a tag de associado está presente no link.', 'Usar link curto quando possível, sem perder a tag.', 'Conferir se o preview mostra imagem em boa resolução.', 'Evitar links com parâmetros que quebram o rastreamento.', 'Atualizar a oferta se o preço mudar.'] },
      { h2: 'Cadência e preservação do número', paragraphs: ['A Amazon costuma ter muitas ofertas, e a tentação é mandar tudo de uma vez. Resista: poucas ofertas selecionadas por vez, com variação de texto, performam melhor e protegem o número.', 'Use chip dedicado e horário de silêncio para a operação não parecer um robô disparando.'] },
      { h2: 'Como o Espelha Grupos cuida da Amazon', paragraphs: ['Com a sua tag de associado cadastrada, o Espelha Grupos converte os links da Amazon automaticamente, busca a imagem em alta resolução para o preview do WhatsApp e distribui a oferta para seus grupos e canais com cadência responsável.', 'Isso evita o erro clássico de enviar um link sem tag e garante que a oferta chegue com cara profissional.'] },
    ],
    relatedLinks: [
      { href: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp', label: 'Amazon, Shopee ou Mercado Livre: qual paga mais na sua categoria', note: 'a comissão muda muito conforme o produto' },
      { href: '/blog/quanto-custa-bot-para-whatsapp-afiliados', label: 'Quanto custa automatizar isso', note: 'preço das ferramentas do mercado, lado a lado' },
      { href: '/amazon-afiliados-whatsapp', label: 'Divulgar Amazon no WhatsApp sem copiar e colar', note: 'a etiqueta viaja junto com o link curto' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual programa escolher', note: 'comparativo de comissão e prazo de atribuição dos três' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: '3% na venda padrão, até 30% na Comissão Extra' },
      { href: '/bot-afiliados-whatsapp', label: 'Converter os links de afiliado automaticamente', note: 'para a tag nunca cair no caminho' },
      { href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', label: 'Como espelhar mensagens entre grupos', note: 'os 4 caminhos e o passo a passo com o robô' },
      { href: '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp', label: 'O que uma ferramenta de divulgação precisa ter', note: 'checklist, preço e como testar em 7 dias' },
    ],
    faq: [
      { q: 'Como sei se o link tem minha tag?', a: 'O link de afiliado da Amazon inclui um parâmetro de tag (tag=seucodigo). Sem ela, a venda não é atribuída a você. Uma ferramenta de conversão garante isso automaticamente.' },
      { q: 'Qual categoria da Amazon paga mais comissão?', a: 'Bebê, Beleza, Saúde e Cuidados Pessoais, Bebidas Alcoólicas e Alimentos pagam 13%, a maior faixa da tabela padrão. A categoria Coach não paga comissão (0%).' },
      { q: 'Por que a imagem do produto importa?', a: 'O preview com imagem em boa resolução aumenta o clique. O Espelha Grupos busca a imagem em alta para o link preview do WhatsApp.' },
      { q: 'Posso agendar as ofertas da Amazon?', a: 'Sim. Distribuir ao longo do dia, com cadência controlada, costuma converter melhor do que despejar tudo de uma vez e ainda protege o número.' },
    ],
  },
  'como-divulgar-ofertas-mercado-livre-whatsapp': {
    slug: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp',
    // Título encurtado em 2026-08-19 (P1): era 74 chars de texto próprio.
    title: 'Afiliado Mercado Livre: de 0% a 16% por categoria',
    description: 'Quanto o Mercado Livre paga de comissão por categoria (direta e indireta), prazo de pagamento e como divulgar no WhatsApp sem perder a atribuição.',
    eyebrow: 'Afiliado Mercado Livre · Guia completo',
    usePersonAuthor: true,
    origin: 'blog_como_divulgar_ofertas_mercado_livre_whatsapp',
    heroImage: { path: '/blog/hero/mercado-livre-afiliado-hero.jpg', alt: 'Mascote Bit ao lado da tela de conversão de ofertas do Mercado Livre no Espelha Grupos', width: 1024, height: 1024 },
    leadMagnetVariant: 'afiliados',
    intro: 'O Mercado Livre Afiliados paga de 0% a 16% de comissão, dependendo da categoria do produto e de a venda ser direta ou indireta. A entrada é gratuita. Para divulgar no WhatsApp você precisa do link com o seu identificador, um preview com imagem e cadência que não pareça disparo — encaminhar o link do grupo de origem credita a comissão para o concorrente.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Gere seu link de afiliado no programa do Mercado Livre (Mercado Livre Afiliados), confirme que o link carrega o seu identificador, monte a oferta com título, preço e imagem e distribua nos grupos e canais com intervalo entre envios.', 'O ponto crítico é a atribuição: o link precisa ser o SEU, não o do grupo de onde a oferta veio. Quando o Espelha Grupos espelha, ele converte o link para o seu código automaticamente antes de enviar.'] },
      { h2: 'Quanto o Mercado Livre paga de comissão por categoria', paragraphs: ['A tabela abaixo é a do Percentual de Pagamentos dos Resultados aplicável a Afiliados generalistas. O Mercado Livre separa venda direta (o produto que você divulgou) de venda indireta, com percentual menor.'], table: { headers: ['Categoria', 'Venda direta', 'Venda indireta'], rows: [['Beleza e Cuidado Pessoal; Calçados, Roupas e Bolsas; Esportes e Fitness', '16%', '8%'], ['Acessórios para Veículos; Bebês; Brinquedos e Hobbies; Casa, Móveis e Decoração; Construção; Ferramentas; Games; Joias e Relógios; Livros, Revistas e Comics; demais categorias', '12%', '6%'], ['Câmeras e Acessórios; Celulares e Telefones; Eletrodomésticos; Eletrônicos, Áudio e Vídeo; Informática', '5%', '2,5%'], ['Alimentos e Bebidas', '0%', '0%']], note: 'Fonte: Mercado Livre, Central de Ajuda do Programa de Afiliados (consultado em 31/07/2026). Percentuais sujeitos a alteração pelo Mercado Livre — confirme na sua conta antes de decidir.' } },
      { h2: 'Atenção: quem divulga ofertas tem tabela própria', paragraphs: ['A tabela acima vale para Afiliados generalistas. O próprio Mercado Livre avisa que os afiliados enquadrados na categoria de Afiliados Divulgadores de Ofertas, conforme definição nos termos e condições do programa, recebem uma tabela de percentuais diferente — enviada para o e-mail cadastrado no Programa, e não publicada na Central de Ajuda.', 'Isso importa muito para quem opera grupo de achadinhos ou de promoções: é provável que você se enquadre nessa categoria. Antes de planejar receita em cima dos 16%, confirme no e-mail cadastrado qual é a sua tabela.'] },
      { h2: 'Comissão de cupom personalizado', paragraphs: ['Para cupons personalizados, o percentual é calculado sobre o valor final da transação válida e segue uma tabela separada, bem menor que a de produto.'], table: { headers: ['Tipo de produto', 'Percentual'], rows: [['Todas as categorias, exceto as da linha abaixo', '3%'], ['Roupas e calçados; Bolsas e acessórios; Esportes e fitness', '5%']], note: 'Fonte: Mercado Livre, Central de Ajuda do Programa de Afiliados (consultado em 31/07/2026).' } },
      { h2: 'Quando a comissão cai na conta', paragraphs: ['O pagamento só é efetuado após a confirmação de uma Transação Válida, o que pode levar até 60 dias contados a partir da data de entrega do produto.', 'Na prática, isso significa que a venda de hoje pode demorar cerca de dois meses para virar dinheiro disponível. Planeje o caixa da operação considerando esse intervalo, principalmente se você divulga muito produto de entrega longa.'] },
      { h2: 'Como funciona a conversão de link do Mercado Livre', bullets: ['Links de produto (com MLB) são convertidos para o seu código de afiliado.', 'Links de recomendação e landing (/up/, /social/) são resolvidos para a URL canônica do produto.', 'Short links são resolvidos antes da conversão para não perder o produto no meio da cadeia.', 'Se a conversão falhar, o link original de terceiro nunca é encaminhado — a comissão do concorrente não vaza.'] },
      { h2: 'Por que o preview com imagem importa', paragraphs: ['No WhatsApp, o card clicável com foto do produto em boa resolução converte muito mais que um link seco. O Espelha Grupos monta o preview com a imagem em alta e o nome da loja acima do domínio, mantendo o card sempre renderizado.', 'Sem imagem, a oferta compete em desvantagem com todos os outros links do grupo. Com imagem, ela ocupa espaço visual e chama o olho.'] },
      { h2: 'Cadência que protege o número', paragraphs: ['Despejar 20 ofertas em sequência é o caminho mais rápido para o número entrar em risco. Distribua ao longo do dia, varie o texto e respeite horário de silêncio.', 'O Módulo de Preservação Avançada organiza essas camadas: limite por hora, variações de copy e pausas preventivas, para que a operação não pareça robótica.'] },
    ],
    relatedLinks: [
      { href: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp', label: 'Mercado Livre, Amazon ou Shopee: qual paga mais', note: 'comissão por categoria nos três programas' },
      { href: '/blog/como-escalar-grupos-sem-operacao-manual', label: 'Quando o trabalho manual deixa de caber', note: 'o sinal de que a operação passou do ponto' },
      { href: '/mercado-livre-afiliados-whatsapp', label: 'Divulgar Mercado Livre no WhatsApp sem copiar e colar', note: 'produto, catálogo e vitrine saem convertidos' },
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual programa escolher', note: 'comparativo de comissão e prazo de atribuição dos três' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'o programa com maior volume de busca no Brasil' },
      { href: '/bot-afiliados-whatsapp', label: 'Converter os links de afiliado automaticamente', note: 'produto, cupom e short link' },
    ],
    faq: [
      { q: 'Quanto o Mercado Livre paga de comissão de afiliado?', a: 'Para Afiliados generalistas, de 0% a 16% conforme a categoria: 16% em Beleza, Calçados/Roupas/Bolsas e Esportes; 12% na maioria das categorias; 5% em eletrônicos, celulares e informática; e 0% em Alimentos e Bebidas. Em venda indireta o percentual cai pela metade.' },
      { q: 'Qual a diferença entre venda direta e venda indireta?', a: 'O Mercado Livre paga percentuais diferentes conforme a venda seja direta (o produto que você divulgou) ou indireta. A venda indireta paga metade: 8% onde a direta paga 16%, 6% onde paga 12%, e 2,5% onde paga 5%.' },
      { q: 'Quem divulga ofertas recebe a mesma comissão da tabela pública?', a: 'Não necessariamente. O Mercado Livre informa que afiliados enquadrados como Afiliados Divulgadores de Ofertas recebem uma tabela de percentuais própria, enviada ao e-mail cadastrado no Programa e não publicada na Central de Ajuda. Quem opera grupo de achadinhos deve confirmar a própria tabela antes de projetar receita.' },
      { q: 'Em quanto tempo a comissão do Mercado Livre é paga?', a: 'O pagamento só ocorre após a confirmação de uma Transação Válida, o que pode levar até 60 dias a partir da data de entrega do produto.' },
      { q: 'Preciso ser aprovado no Mercado Livre Afiliados?', a: 'Sim. Você precisa se inscrever no programa de afiliados do Mercado Livre e gerar seu link com o identificador da sua conta antes de divulgar.' },
      { q: 'O Espelha Grupos converte qualquer link do Mercado Livre?', a: 'Links de produto são convertidos para o seu código. Links de recomendação e landing são resolvidos para o produto canônico. Se não for possível converter com segurança, o link original não é encaminhado.' },
      { q: 'Cupom do Mercado Livre credita comissão?', a: 'Sim, com tabela própria: 3% na maioria das categorias e 5% em roupas e calçados, bolsas e acessórios, esportes e fitness — percentual calculado sobre o valor final da transação válida. Ainda assim, valide clicando no link em um celular antes de confiar na atribuição.' },
    ],
  },
  'quanto-custa-bot-para-whatsapp-afiliados': {
    slug: '/blog/quanto-custa-bot-para-whatsapp-afiliados',
    title: 'Quanto custa um bot de afiliados: R$ 39 a R$ 69',
    description: 'Quanto custa um bot para WhatsApp de afiliados: preço de cada plano, o que muda entre eles e o custo que não aparece na mensalidade. 7 dias grátis para testar.',
    eyebrow: 'Custo · Decisão de compra',
    origin: 'blog_quanto_custa_bot_para_whatsapp_afiliados',
    heroImage: { path: '/blog/hero/12-quanto-perde.png', alt: 'Simulação mensal de comissão perdida sem conversão automática, comparada ao valor recuperado com o bot', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'Um bot para WhatsApp de afiliados custa, na prática, entre R$39 e R$69 por mês nos planos do Espelha Grupos, com 7 dias grátis para testar. Mas o preço da mensalidade é só parte da conta: o custo real inclui o tempo que você economiza no copia-e-cola e o risco que você reduz na operação.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['No Espelha Grupos, o plano Basic é R$39 por 30 dias (operação manual de ofertas em grupos) e o plano Pro é R$69 por 30 dias (canais, ofertas automáticas da Shopee, filas de envio e Módulo de Preservação Avançada). O teste grátis de 7 dias libera o fluxo Pro completo.', 'Não há promessa de faturamento, comissão ou entrega — a ferramenta organiza a distribuição, mas a revisão humana e o resultado dependem da sua operação.'] },
      { h2: 'O que muda entre básico e avançado', bullets: ['Basic: espelhamento de grupos, conversão de link (Mercado Livre, Amazon, Shopee, Magalu), conversão de cupom, criação de oferta por link, envio imediato e agendado, relatórios.', 'Pro: tudo do Basic + monitoramento e envio em Canais, ofertas automáticas da Shopee, filas com limite por hora e por dia, e Módulo de Preservação Avançada (cadência, horário de silêncio, variações e limites).'] },
      { h2: 'Custo real além da mensalidade', paragraphs: ['Some o tempo que você gasta hoje copiando e colando oferta por oferta em cada grupo. Se são duas horas por dia, o custo escondido da operação manual costuma superar em muito o valor de uma mensalidade.', 'Há também o custo de risco: mensagens idênticas em vários destinos e volume sem cadência aumentam a chance de perder o número. Reduzir esse risco tem valor mesmo que não apareça na fatura.'] },
      { h2: 'Como avaliar antes de pagar', paragraphs: ['Use o teste grátis para medir três coisas: quanto tempo você economiza, se a conversão de link mantém sua comissão e se a cadência deixa a operação mais estável. Só depois disso escolha o plano.'] },
    ],
    relatedTitle: 'Continue: quanto custa e quanto rende',
    relatedLinks: [
      { href: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', label: 'O que um bot de afiliados faz, na prática', note: 'antes de comparar preço, veja o que está sendo comprado' },
      { href: '/clonar-mensagens-de-grupo-de-afiliados', label: 'O que significa clonar um grupo de ofertas', note: 'a mensagem sai como publicação sua, com o seu link' },
      { href: '/programa-de-afiliados', label: 'Quanto cada programa de afiliados paga', note: 'o outro lado da conta: a comissão real' },
      { href: '/vendas-e-comissao-afiliado-whatsapp', label: 'Como saber quanto você já ganhou de comissão', note: 'a diferença entre relatório de envio e relatório de venda' },
      { href: '/quanto-ganha-afiliado-shopee', label: 'Quanto ganha um afiliado Shopee', note: 'para fechar a conta do outro lado do custo' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: comissão e prazo de atribuição', note: '3% na venda padrão, até 30% na Comissão Extra' },
      { href: '/melhores-bots-para-afiliados-whatsapp', label: 'Comparativo de bots para afiliados', note: 'o que avaliar antes de assinar' },
    ],
    faq: [
      { q: 'Tem plano gratuito?', a: 'Há um teste grátis de 7 dias com o fluxo Pro completo. Depois disso, os planos pagos são Basic (R$39/30 dias) e Pro (R$69/30 dias).' },
      { q: 'Preciso pagar por segurança das credenciais?', a: 'Não. A criptografia das credenciais de afiliado e da chave PIX em repouso, além da proteção contra força bruta no login, valem para todos os planos e para o teste grátis. Não é add-on pago.' },
      { q: 'Existe fidelidade ou multa?', a: 'O modelo é de acesso por período de 30 dias. Consulte os termos atuais dentro do produto para regras de renovação e cancelamento.' },
    ],
  },
  'melhores-horarios-para-postar-ofertas-no-whatsapp': {
    slug: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp',
    // Título encurtado em 2026-08-19 (specs/013-inbound-leads-strategy, P1):
    // era 64 chars de texto próprio, o que empurrava o corte do Google no
    // celular. Motivo pra clicar ("horário certo") na frente.
    title: 'Melhor horário para postar oferta: 7h, 12h e 19h',
    description: 'Os três horários em que as pessoas abrem o WhatsApp — 7h-9h, 11h30-13h30 e 18h-21h — e por que espalhar os envios rende mais que acertar a hora exata.',
    eyebrow: 'Cadência · Rotina de postagem',
    origin: 'blog_melhores_horarios_para_postar_ofertas_no_whatsapp',
    heroImage: { path: '/blog/hero/02-radar.png', alt: 'Radar monitorando ofertas de vários grupos de origem ao mesmo tempo, para não perder o timing', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'Os melhores horários para postar ofertas no WhatsApp costumam ser início da manhã (7h–9h), horário de almoço (11h30–13h30) e início da noite (18h–21h), quando as pessoas checam o celular. Mas o horário exato importa menos do que a consistência e a distribuição: postar tudo de uma vez, mesmo no melhor horário, converte pior e expõe o número.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Concentre as ofertas mais fortes em três janelas: manhã (7h–9h), almoço (11h30–13h30) e noite (18h–21h). Evite a madrugada. Distribua as ofertas ao longo dessas janelas em vez de despejar tudo de uma vez.', 'O comportamento do seu público específico manda mais que qualquer regra geral — por isso vale acompanhar cliques por horário e ajustar.'] },
      { h2: 'Janelas que costumam funcionar', bullets: ['Manhã (7h–9h): quem checa o celular antes do trabalho.', 'Almoço (11h30–13h30): pausa e navegação livre.', 'Noite (18h–21h): maior tempo de tela e decisão de compra.', 'Fins de semana: manhãs e fim de tarde tendem a render bem para achadinhos.'] },
      { h2: 'Por que cadência importa mais que horário', paragraphs: ['Acertar o horário e mandar 15 ofertas seguidas anula o ganho: o público satura e o número fica exposto a padrão de disparo. O que sustenta resultado é frequência distribuída com intervalo entre envios.', 'Postar de forma consistente todos os dias, em horários parecidos, também treina o público a esperar suas ofertas — isso vale mais que um único horário mágico.'] },
      { h2: 'Como o Espelha Grupos ajuda a manter o ritmo', paragraphs: ['Com agendamento e filas com limite por hora e por dia, você programa as ofertas nas janelas certas sem ficar preso ao celular. O Módulo de Preservação Avançada acrescenta horário de silêncio e variações de texto para evitar comportamento robótico.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
      { href: '/blog/checklist-padronizar-divulgacao-whatsapp', label: 'Checklist para padronizar o que você publica', note: 'horário é só uma das variáveis' },
      { href: '/blog/como-escalar-grupos-sem-operacao-manual', label: 'Quando o trabalho manual deixa de caber', note: 'postar na hora certa em vários grupos não se faz na mão' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'o que publicar nesses horários' },
      { href: '/blog/como-divulgar-ofertas-amazon-whatsapp', label: 'Afiliado Amazon: comissão por categoria', note: 'de 0% a 13% conforme o produto' },
      { href: '/anti-ban-whatsapp', label: 'Frequência de envio e risco de banimento', note: 'por que concentrar tudo num horário só é arriscado' },
    ],
    faq: [
      { q: 'Existe um horário único que converte mais?', a: 'Não. As janelas de manhã, almoço e noite costumam render bem, mas o comportamento do seu público específico manda. Acompanhe cliques por horário e ajuste.' },
      { q: 'Posso postar de madrugada?', a: 'Não é recomendado. Baixa audiência e envio fora de horário natural aumentam a sensação de operação automatizada e o risco para o número.' },
      { q: 'Quantas ofertas por janela?', a: 'Prefira poucas ofertas fortes distribuídas com intervalo a muitas ofertas em sequência. Volume alto sem cadência satura o público e expõe o número.' },
    ],
  },
  'como-converter-link-de-afiliado-automaticamente-whatsapp': {
    slug: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp',
    title: 'Converter link de afiliado sozinho: 6 lojas',
    description: 'Como o link de produto ou cupom vira o seu link de afiliado na hora do envio, em 6 lojas, de Shopee e Mercado Livre a SHEIN e AliExpress.',
    eyebrow: 'Conversão de link · Automação',
    origin: 'blog_como_converter_link_de_afiliado_automaticamente_whatsapp',
    heroImage: { path: '/blog/hero/01-manual-x-auto.png', alt: 'Comparação entre converter link de afiliado manualmente e converter automaticamente', width: 1080, height: 1080 },
    usePersonAuthor: true,
    intro: 'Converter link de afiliado automaticamente significa trocar, na hora do envio, qualquer link de produto ou cupom pelo seu próprio link de afiliado — sem copiar, colar e gerar link manualmente para cada oferta. É isso que impede que a comissão do concorrente vaze quando você espelha ofertas de outros grupos.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Uma ferramenta de conversão automática recebe o link original, identifica a loja, resolve short links e páginas de recomendação, e gera o link com o SEU código de afiliado antes de a mensagem sair. Se não conseguir converter com segurança, ela não encaminha o link de terceiro.', 'O Espelha Grupos faz isso para Mercado Livre, Amazon, Shopee e Magalu, incluindo links de cupom e voucher, não só de produto.'] },
      { h2: 'O que acontece com cada loja', bullets: ['Amazon: adiciona a sua tag de associado na URL da loja.', 'Shopee: resolve o short link, preserva o cupom e devolve o link de afiliado que abre direto o app.', 'Mercado Livre: converte links de produto (MLB) e resolve landings de recomendação para o produto canônico.', 'Magalu: aplica o seu partner_id em qualquer URL, inclusive campanhas.'] },
      { h2: 'Por que cupom também precisa ser convertido', paragraphs: ['Muitas ofertas só fecham o preço anunciado com o cupom. Encaminhar o cupom original credita a comissão para o afiliado de origem; removê-lo quebra a oferta. A conversão de cupom resolve isso mantendo a identidade do cupom e trocando a atribuição para você.', 'A regra de ouro é: o link original de terceiro nunca é encaminhado. Se a conversão falhar, o sistema cai em um tratamento seguro em vez de vazar comissão.'] },
      { h2: 'Conferir antes de confiar', paragraphs: ['Automatizar não elimina a revisão. Antes de escalar, clique no link convertido em um celular e confirme que ele carrega o seu código e leva ao produto certo. Depois disso, a conversão automática economiza horas por dia.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
      { href: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', label: 'Como o robô trata cupom e link de produto', note: 'cupom quebra a oferta quando é removido da mensagem' },
      { href: '/glossario', label: 'Glossário: os termos que aparecem no painel', note: 'conversão de link, espelhamento, cadência' },
      { href: '/blog/quanto-custa-bot-para-whatsapp-afiliados', label: 'Quanto custa automatizar isso', note: 'preço das ferramentas do mercado, lado a lado' },
      { href: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande', label: 'Começar sem ter grupo grande', note: 'o que dá para fazer com poucos contatos' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'onde ficam suas credenciais de afiliada' },
      { href: '/vendas-e-comissao-afiliado-whatsapp', label: 'Conferir se o link convertido virou venda', note: 'pedidos, valor vendido e comissão estimada e confirmada' },
      { href: '/copiaram-minha-oferta-no-whatsapp', label: 'Copiaram a sua oferta no WhatsApp', note: 'link com o seu código é a defesa que mexe no bolso' },
      { href: '/blog/como-divulgar-ofertas-amazon-whatsapp', label: 'Afiliado Amazon: a tag na URL da loja', note: 'sem ela a venda não é atribuída a você' },
      { href: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp', label: 'Afiliado Mercado Livre: comissão por categoria', note: 'venda direta e venda indireta' },
    ],
    faq: [
      { q: 'A conversão automática funciona com short link?', a: 'Sim. O short link é resolvido antes da conversão para não perder o produto no meio da cadeia de redirecionamento, especialmente na Shopee.' },
      { q: 'E se o link não puder ser convertido?', a: 'O link original de terceiro nunca é encaminhado. O sistema cai em um tratamento seguro para não creditar comissão ao concorrente.' },
      { q: 'Preciso conferir cada link mesmo com automação?', a: 'Recomendado validar por amostragem, principalmente no começo: clique no link convertido e confirme que carrega o seu código e leva ao produto certo.' },
    ],
  },
  'amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp': {
    slug: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp',
    title: 'Amazon, Shopee e Mercado Livre no mesmo grupo',
    description: 'Como operar os três programas de afiliados ao mesmo tempo no WhatsApp: qual loja usar em cada oferta, como não misturar os códigos e qual rende mais.',
    eyebrow: 'Estratégia · Operar os três programas',
    origin: 'blog_amazon_shopee_ou_mercado_livre_para_afiliados_whatsapp',
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'Não existe um único programa vencedor: Amazon é forte em variedade e confiança, Shopee é forte em achadinhos baratos e cupom, e Mercado Livre é forte em ticket médio e frete. Para quem divulga no WhatsApp, a estratégia madura combina os três, escolhendo o programa por tipo de oferta. Se você ainda está decidindo por onde começar, veja antes o comparativo de comissão dos três programas.',
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Comparativo de comissão dos três programas', note: 'quanto cada um paga e prazo de atribuição' },
      { href: '/quanto-ganha-afiliado-shopee', label: 'Quanto ganha um afiliado Shopee', note: 'a conta por trás dos 3% e da Comissão Extra' },
      { href: '/shopee-afiliados-whatsapp', label: 'Divulgar Shopee no WhatsApp', note: 'como as ofertas saem já convertidas' },
      { href: '/amazon-afiliados-whatsapp', label: 'Divulgar Amazon no WhatsApp', note: 'a etiqueta junto com o link curto' },
      { href: '/mercado-livre-afiliados-whatsapp', label: 'Divulgar Mercado Livre no WhatsApp', note: 'produto, catálogo e vitrine' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: guia de cadastro', note: 'o programa com maior volume de busca' },
    ],
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use Shopee para achadinhos de baixo preço e campanhas de cupom, Amazon para variedade e produtos de marca com boa taxa de clique, e Mercado Livre para ticket médio maior e itens com frete competitivo.', 'O que decide a comissão real é a atribuição correta do link e a taxa de conversão do seu público, não só o percentual do programa.'] },
      { h2: 'Como cada programa se comporta no WhatsApp', bullets: ['Shopee: cupom e voucher fazem parte da oferta; a conversão precisa preservar o cupom e usar short link que abre o app.', 'Amazon: a tag de associado precisa estar na URL da loja; preview com imagem em alta ajuda muito no clique.', 'Mercado Livre: links de produto (MLB) convertem direto; landings de recomendação precisam ser resolvidas para o produto.'] },
      { h2: 'Por que combinar os três', paragraphs: ['Depender de um só programa limita seu catálogo de ofertas e te deixa refém de mudanças de regra de um único parceiro. Rodar os três amplia a variedade e deixa você escolher sempre a melhor oferta do dia por categoria.', 'O desafio operacional de rodar três programas é justamente a conversão de link — cada loja tem um mecanismo diferente. Uma ferramenta que converte todos automaticamente elimina esse atrito.'] },
      { h2: 'O papel do Espelha Grupos', paragraphs: ['O Espelha Grupos converte links de Amazon, Shopee, Mercado Livre e Magalu (incluindo cupons) para o seu código, monta o preview com imagem e distribui com cadência. Assim você opera os três programas no mesmo fluxo, sem gerar link manualmente para cada oferta.'] },
    ],
    faq: [
      { q: 'Qual paga mais comissão?', a: 'O percentual varia por categoria e por programa e muda com o tempo. Na prática, a comissão real depende mais da atribuição correta do link e da conversão do seu público do que do percentual nominal.' },
      { q: 'Posso divulgar os três ao mesmo tempo?', a: 'Sim, e é o mais recomendado. Cada programa é forte em um tipo de oferta. O desafio é converter o link de cada loja corretamente — o que uma ferramenta de conversão automática resolve.' },
      { q: 'Preciso de contas separadas?', a: 'Sim. Você se inscreve em cada programa de afiliados separadamente e gera um link com o seu identificador em cada um deles.' },
    ],
  },
  'como-montar-grupo-de-ofertas-no-whatsapp-do-zero': {
    slug: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero',
    // Título ajustado em 2026-08-19 (P1): já cabia em 55, mas o passo a passo
    // ("do zero") reforça o motivo pra quem está começando clicar.
    title: 'Grupo de ofertas no WhatsApp: montar do zero',
    description: 'Guia para montar um grupo de ofertas no WhatsApp do zero: chip dedicado, primeiras fontes de oferta, conversão de link, cadência e quando migrar para canal.',
    eyebrow: 'Começando · Grupo de ofertas',
    origin: 'blog_como_montar_grupo_de_ofertas_no_whatsapp_do_zero',
    heroImage: { path: '/blog/hero/05-copia-cola.png', alt: 'Checklist da rotina manual de copiar, colar e reenviar oferta grupo por grupo, substituída pelo bot', width: 1080, height: 1080 },
    intro: 'Montar um grupo de ofertas no WhatsApp do zero é menos sobre audiência grande e mais sobre processo: chip dedicado, boas fontes de oferta, link com a sua comissão e uma rotina de postagem consistente. Quem começa com processo cresce com estabilidade; quem começa no improviso perde o número.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use um chip dedicado (nunca o número pessoal), defina o nicho do grupo, encontre boas fontes de oferta, converta cada link para o seu código de afiliado e poste com cadência consistente. Só depois pense em escalar para mais grupos ou canais.', 'Não precisa de audiência grande para começar — precisa de constância e de ofertas realmente boas para o seu público.'] },
      { h2: 'Passo a passo inicial', bullets: ['Ative um chip dedicado para a operação de ofertas.', 'Escolha um nicho claro (achadinhos, eletrônicos, casa, moda, etc.).', 'Inscreva-se nos programas de afiliados (Amazon, Shopee, Mercado Livre, Magalu).', 'Defina 2 a 3 janelas de postagem por dia.', 'Converta todo link para o seu código antes de divulgar.'] },
      { h2: 'Erros que travam quem começa', paragraphs: ['Os mais comuns: usar o número pessoal, encaminhar link de terceiro (perdendo comissão), postar em rajada e abandonar o grupo por falta de rotina. Todos são de processo, não de audiência.', 'Outro erro é não medir. Sem acompanhar cliques e envios, você não sabe qual oferta e qual horário funcionam.'] },
      { h2: 'Quando escalar e migrar para canal', paragraphs: ['Quando a rotina estiver estável e o grupo engajado, o próximo passo costuma ser adicionar um Canal do WhatsApp como vitrine e espelhar as ofertas selecionadas do grupo para o canal.', 'É aqui que o Espelha Grupos entra: espelha entre grupos e canais, converte os links, mantém cadência e monitora a saúde da operação — para você crescer sem multiplicar o copia-e-cola.'] },
    ],
    relatedTitle: 'Continue: o que publicar no grupo novo',
    relatedLinks: [
      { href: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', label: 'Como o robô trata cupom e link de produto', note: 'o que muda quando a oferta só fecha com cupom' },
      { href: '/blog/chip-dedicado-bot-whatsapp', label: 'Vale a pena usar um chip só para o robô', note: 'decidir isso no começo evita retrabalho' },
      { href: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande', label: 'Começar sem ter grupo grande', note: 'não é preciso ter audiência antes de começar' },
      { href: '/blog/checklist-padronizar-divulgacao-whatsapp', label: 'Checklist para padronizar o que você publica', note: 'o que conferir antes de cada oferta sair' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'comissão de Shopee, Amazon e Mercado Livre' },
      { href: '/copiaram-minha-oferta-no-whatsapp', label: 'E quando copiarem as suas ofertas?', note: 'o que dá e o que não dá para fazer — e por que o link importa mais que a foto' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'cadastro gratuito, sem exigir audiência grande' },
      { href: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', label: 'Melhores horários para postar ofertas', note: 'quando o grupo responde mais' },
    ],
    faq: [
      { q: 'Preciso de muita gente para começar?', a: 'Não. Constância e ofertas boas importam mais que tamanho no início. Audiência cresce com rotina consistente e curadoria.' },
      { q: 'Posso usar meu número pessoal?', a: 'Não é recomendado. Use um chip dedicado para separar a operação comercial do número pessoal e reduzir o risco de perder contatos importantes.' },
      { q: 'Quando devo criar um canal?', a: 'Quando a rotina estiver estável e o grupo engajado. O canal funciona como vitrine organizada; o grupo continua útil para comunidade e feedback.' },
    ],
  },
  // -------------------------------------------------------------------------
  // PÁGINAS DE RESPOSTA (19/09/2026, plano "máquina de vendas por IA", §6.2).
  //
  // As três consultas abaixo são as que as IAs recebem e para as quais não
  // havia página nossa respondendo de frente (medição de 18/09: nas buscas
  // 2 e 4 não há terceiro nenhum disputando). Os concorrentes mais citados
  // são citados DAS PRÓPRIAS páginas, com título igual à pergunta — é esse o
  // formato. Cada uma traz o bloco de conversão (preço, "melhor para", CTA)
  // porque comparação sem ele converteu 0% (medição de 11/09), e entra
  // linkada de páginas COM impressão (regra "página nova nunca nasce órfã").
  //
  // Preço de concorrente NÃO aparece aqui: só nome e o que faz, com link para
  // a ficha datada em /alternativas/* (FR-031). O nosso pode.
  // -------------------------------------------------------------------------
  'como-espelhar-mensagens-entre-grupos-whatsapp': {
    slug: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp',
    title: 'Como espelhar mensagens entre grupos de WhatsApp',
    description: 'Os 4 jeitos de espelhar mensagens entre grupos de WhatsApp — na mão, com agendador, com automação genérica ou com robô de afiliada — e o que cada um custa.',
    eyebrow: 'Espelhamento · Passo a passo',
    origin: 'blog_como_espelhar_mensagens_entre_grupos_whatsapp',
    heroImage: { path: '/blog/hero/06-escalar.png', alt: 'Um robô central distribuindo ofertas para vários grupos e canais de destino ao mesmo tempo', width: 1080, height: 1080 },
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'Espelhar mensagens entre grupos de WhatsApp é fazer a oferta que aparece num grupo de origem sair, sozinha, nos seus grupos e canais — com o link trocado pelo seu código de afiliada. Serve para quem divulga ofertas de Shopee, Mercado Livre, Amazon, Magalu, SHEIN ou AliExpress e hoje copia e cola oferta por oferta. Dá para fazer de quatro jeitos; com robô especializado custa a partir de R$ 39 por 30 dias e tem 7 dias de teste sem cartão.',
    midBridge: {
      question: 'Quer ver o espelhamento funcionando antes de conectar o seu número?',
      body: 'No Espelha Grupos você escolhe os grupos de origem, cadastra o seu código de afiliada e escolhe os destinos; o robô faz o resto e mostra o histórico de tudo o que saiu. Basic por R$ 39 e Pro por R$ 69 a cada 30 dias, grupos ilimitados, 7 dias grátis sem cartão.',
      cta: 'Ver preços e testar 7 dias grátis',
      href: '/precos',
      secondary: { label: 'Como funciona a operação para afiliados', href: '/bot-afiliados-whatsapp' },
    },
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Escolha um grupo de origem (onde a promoção aparece primeiro), um ou mais grupos ou canais de destino (os seus) e uma regra para o meio do caminho: trocar o link pelo seu código de afiliada, respeitar um intervalo entre envios e não repetir a mesma oferta. Feito na mão, isso é copiar, editar e colar; feito por robô, é configurar uma vez e revisar o histórico.', 'O que separa os quatro caminhos abaixo não é "postar mais": é quem troca o link, quem controla o ritmo e quem registra o que saiu.'] },
      {
        h2: 'Os 4 caminhos, lado a lado',
        table: {
          headers: ['Caminho', 'Como funciona', 'Custa', 'Melhor para'],
          rows: [
            ['Na mão', 'Você encaminha a mensagem, apaga o link do outro afiliado, cola o seu e envia em cada grupo.', 'Seu tempo: 2 a 4 minutos por oferta, por grupo.', 'Quem publica menos de 10 ofertas por dia em 1 ou 2 grupos.'],
            ['Agendador de mensagens', 'Você monta a oferta uma vez, com o seu link, e agenda o envio para vários grupos.', 'Grátis ou barato, mas continua manual: nada troca o link nem lê o grupo de origem.', 'Quem cria as próprias ofertas e não acompanha grupo de origem.'],
            ['Automação genérica (fluxos, scripts, API não oficial)', 'Um fluxo lê o grupo de origem e reposta. Trocar o link e controlar intervalo é você quem programa.', 'Horas de montagem e manutenção; quebra quando a loja ou o WhatsApp mudam algo.', 'Quem tem gente técnica e precisa integrar vários sistemas além do WhatsApp.'],
            ['Robô de afiliada (espelhador)', 'O robô lê a origem, troca o link pelo seu código em cada loja, respeita intervalo e limite por destino e guarda o histórico.', 'Espelha Grupos: R$ 39 (Basic) ou R$ 69 (Pro) a cada 30 dias, grupos ilimitados, 7 dias grátis.', 'Quem já acompanha grupos de origem e divulga em mais de um grupo ou canal.'],
          ],
          note: 'Preços do Espelha Grupos verificados em 19/09/2026 na página de preços. Ferramentas concorrentes têm ficha própria, com data, em /alternativas.',
        },
      },
      {
        h2: 'Como espelhar com um robô de afiliada, passo a passo',
        schema: 'HowTo',
        steps: [
          { name: 'Separe um número para a operação', text: 'Chip dedicado, não o pessoal. Se algo der errado com o número, sua vida pessoal não vai junto.' },
          { name: 'Conecte o número ao robô', text: 'Pelo QR Code ou por código, como um WhatsApp Web. O robô só lê os grupos que você escolher; o resto é descartado na hora.' },
          { name: 'Cadastre o seu código de afiliada em cada loja', text: 'Etiqueta da Amazon, código do Mercado Livre, chave da Shopee. É isso que faz a comissão ser sua, e não do grupo de origem.' },
          { name: 'Escolha origem, destinos e ritmo', text: 'Quais grupos o robô acompanha, para quais grupos e canais ele publica, com que intervalo e com que limite por dia. Aqui entram também as palavras bloqueadas e o modelo de mensagem.' },
          { name: 'Acompanhe o histórico', text: 'Tudo o que saiu, o que foi segurado por repetição e o que falhou fica registrado. É o que separa "achei que enviou" de "enviou".' },
        ],
      },
      { h2: 'O que espelhar mensagens NÃO é', bullets: ['Não é espelhar o WhatsApp em outro celular ou no computador — isso é usar a mesma conta em dois aparelhos, e não tem relação com grupos de ofertas.', 'Não é clonar contatos nem entrar em grupo escondido: o robô usa o seu número, nos grupos onde ele já está, e publica como você.', 'Não é disparo em massa: espelhar é republicar UMA oferta de origem nos SEUS destinos, com intervalo — o oposto de mandar a mesma mensagem para uma lista fria.'] },
      { h2: 'Melhor para e não é ideal para', bullets: ['Melhor para: afiliada que já segue grupos onde a promoção aparece primeiro, publica em mais de um grupo ou canal e perde comissão por link errado ou por oferta que chega atrasada.', 'Melhor para: quem quer o robô publicando 24 horas sem depender de estar no celular.', 'Não é ideal para: quem cria todas as ofertas do zero, sem grupo de origem — um agendador resolve por menos.', 'Não é ideal para: quem espera que uma ferramenta impeça banimento. Nenhuma ferramenta controla a decisão do WhatsApp; o que dá para controlar é ritmo, variação e para quem você publica.'] },
      { h2: 'Como o Espelha Grupos faz isso', paragraphs: ['O Espelha Grupos é um espelhador: acompanha os grupos de origem que você escolhe, troca o link de cada oferta pelo seu código de afiliada em seis lojas (Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress), converte também link de cupom, e publica nos seus grupos e canais com intervalo, limite por destino e histórico completo. Além do espelhamento, tem filas de ofertas e busca automática de ofertas da Shopee.', 'Ele não promete que ninguém será banido e não promete quanto você vai vender. O que promete é o trabalho repetitivo saindo da sua mão, com registro de tudo o que saiu.'] },
    ],
    relatedLinks: [
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'origens, conversão de link, destinos e histórico' },
      { href: '/clonar-mensagens-de-grupo-de-afiliados', label: 'O que significa "clonar" um grupo de ofertas', note: 'o outro nome que o mercado dá para o espelhamento' },
      { href: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp', label: 'Como a conversão de link funciona', note: 'o que acontece com o link entre a origem e o seu grupo' },
      { href: '/blog/melhores-automacoes-para-afiliado-shopee-2026', label: 'As automações que um afiliado Shopee usa em 2026', note: 'espelhar, garimpar, converter, enfileirar' },
      { href: '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp', label: 'O que uma ferramenta de divulgação precisa ter', note: 'checklist antes de assinar qualquer uma' },
      { href: '/espelha-grupos-vs-planilha-manual', label: 'Quando a planilha ainda basta', note: 'e quando o robô passa a compensar' },
      { href: '/grupo-para-canal-whatsapp', label: 'Grupo ou Canal: qual usar como destino', note: 'o que muda no alcance e em quem pode responder' },
    ],
    faq: [
      { q: 'Espelhar mensagens entre grupos é o mesmo que espelhar o WhatsApp em outro celular?', a: 'Não. Espelhar o WhatsApp em outro aparelho é usar a mesma conta em dois lugares. Espelhar mensagens entre grupos é republicar, nos seus grupos, a oferta que apareceu num grupo de origem — com o seu link de afiliada no lugar do original.' },
      { q: 'Preciso ser administradora do grupo de origem?', a: 'Não. Basta o seu número estar no grupo. O robô lê o que chega ali e publica nos grupos e canais onde você é quem publica.' },
      { q: 'O grupo de origem fica sabendo que eu espelho?', a: 'A mensagem sai do seu número, nos seus grupos, como publicação sua. Nada é enviado de volta ao grupo de origem e o robô não responde ninguém.' },
      { q: 'Espelhar dá banimento?', a: 'Ninguém pode garantir que um número não será banido — quem decide é o WhatsApp, com critérios que não são públicos. O que reduz o risco é o que está sob o seu controle: intervalo entre envios, limite por grupo, mensagem que não é idêntica em todos os destinos e publicar só para quem quer receber.' },
      { q: 'Funciona com Canais do WhatsApp?', a: 'Sim. Canal pode ser origem ou destino. Como destino, ele alcança mais gente e ninguém responde por cima da oferta.' },
    ],
  },
  'melhores-automacoes-para-afiliado-shopee-2026': {
    slug: '/blog/melhores-automacoes-para-afiliado-shopee-2026',
    title: 'Melhores automações para afiliado Shopee em 2026',
    description: 'As 6 automações que um afiliado Shopee usa no WhatsApp em 2026 — espelhar grupos, garimpar ofertas, converter link, filas, canal e vendas — e quem faz cada uma.',
    eyebrow: 'Shopee Afiliados · Automação',
    origin: 'blog_melhores_automacoes_para_afiliado_shopee_2026',
    heroImage: { path: '/blog/hero/31-camadas-variacao.png', alt: 'Camadas de automação que o bot mantém sozinho: variação de texto, mutação de imagem, monitoramento e rastreio de cliques', width: 1080, height: 1080 },
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'As melhores automações para afiliado Shopee em 2026 são as que tiram da sua mão o que se repete todo dia: acompanhar grupos de origem, trocar o link pelo seu código, achar oferta com desconto e publicar com intervalo. Nenhuma delas vende por você — o que elas fazem é a oferta chegar certa, com o seu link, no seu grupo, sem você estar no celular. Abaixo, as seis, o que cada uma resolve e quem faz cada uma; no Espelha Grupos as seis estão em um plano só, a partir de R$ 39 por 30 dias.',
    midBridge: {
      question: 'Já é afiliada Shopee e ainda copia e cola oferta por oferta?',
      body: 'O Espelha Grupos espelha os grupos que você acompanha, garimpa ofertas da Shopee por palavra-chave, converte o link com a sua chave, publica com intervalo e mostra as vendas atribuídas no painel. Basic R$ 39, Pro R$ 69, a cada 30 dias. 7 dias grátis, sem cartão.',
      cta: 'Ver preços e testar 7 dias grátis',
      href: '/precos',
      secondary: { label: 'Como funciona para a Shopee', href: '/shopee-afiliados-whatsapp' },
    },
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Automação para afiliado Shopee é qualquer coisa que faça o robô, e não você, repetir o trabalho de divulgação: ler o grupo onde a oferta aparece primeiro, trocar o link pelo seu, buscar produto com desconto, enfileirar e publicar no ritmo certo, e contar o que virou venda. Em 2026 isso se organiza em seis automações, e a diferença entre as ferramentas está em QUAIS delas cada uma faz e em qual plano.'] },
      {
        h2: 'As 6 automações, do que mais economiza tempo para o que mais mede resultado',
        schema: 'ItemList',
        items: [
          { name: 'Espelhamento de grupos de ofertas', text: 'O robô acompanha os grupos de origem que você escolhe, troca o link pelo seu código e publica nos seus grupos e canais.', bestFor: 'quem já segue grupos onde a promoção aparece primeiro e publica em mais de um destino', href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', linkLabel: 'Como espelhar, passo a passo' },
          { name: 'Busca automática de ofertas da Shopee', text: 'Por palavra-chave, com desconto mínimo, ordenando por mais vendidos, maior preço ou maior comissão. As ofertas saem sozinhas, no horário e no ritmo que você definir.', bestFor: 'quem quer publicar sem depender de grupo de origem nenhum', href: '/shopee-afiliados-whatsapp', linkLabel: 'Ver como funciona' },
          { name: 'Conversão automática do link', text: 'Todo link de produto ou cupom sai com a sua chave de afiliada — inclusive o link curto da Shopee, que abre direto no app.', bestFor: 'toda afiliada: sem isso a comissão vai para o grupo de origem', href: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp', linkLabel: 'Como a conversão funciona' },
          { name: 'Filas com intervalo e limite por grupo', text: 'A oferta entra numa fila e sai com intervalo, horário de funcionamento e teto por dia. É o que impede o padrão de rajada que o WhatsApp associa a robô.', bestFor: 'quem publica em muitos grupos e quer preservar o número', href: '/anti-ban-whatsapp', linkLabel: 'O que dá para controlar' },
          { name: 'Publicação em Canal do WhatsApp', text: 'O mesmo espelhamento e as mesmas filas, com o Canal como destino: alcança mais gente e ninguém responde por cima da oferta.', bestFor: 'quem já tem audiência e quer uma vitrine sem conversa cruzada', href: '/bot-canal-whatsapp', linkLabel: 'Publicar em Canal' },
          { name: 'Vendas e comissão no painel', text: 'Pedidos atribuídos, itens e comissão estimada e confirmada, por oferta publicada. É o que diz o que repetir.', bestFor: 'quem quer saber qual oferta vendeu, e não só quantas mensagens enviou', href: '/vendas-e-comissao-afiliado-whatsapp', linkLabel: 'Ver a aba Vendas' },
        ],
      },
      {
        h2: 'Quem faz o quê (ferramentas com ficha datada)',
        paragraphs: ['A tabela diz o que cada ferramenta automatiza para a Shopee segundo a própria página dela. Preço e plano de cada uma estão na ficha, com a data em que foi conferida — mudam com frequência, e citar preço sem data é o jeito mais rápido de publicar informação errada.'],
        table: {
          headers: ['Ferramenta', 'O que automatiza para a Shopee', 'Ficha com preço e data'],
          rows: [
            ['Espelha Grupos', 'As seis: espelhamento, busca automática, conversão de link e cupom, filas com intervalo, Canal e vendas no painel. Grupos ilimitados em qualquer plano; R$ 39 (Basic) ou R$ 69 (Pro) a cada 30 dias.', 'Preços em /precos (19/09/2026)'],
            ['Achadinho Pro', 'Automações por marketplace com foco em Shopee, vários números de WhatsApp por conta, extensão de navegador.', 'Alternativa ao Achadinho Pro'],
            ['Gigi Bot', 'Conversão de link de várias lojas com plano gratuito; espelhamento e envio automático só no plano mais caro.', 'Alternativa ao Gigi Bot'],
            ['Shozap', 'Campanhas e monitoramento de grupos para WhatsApp e Telegram, escalando por número de conexões.', 'Alternativa ao Shozap'],
            ['FluxoPromo', 'Feed de ofertas por nicho para Telegram, com destino de WhatsApp a partir do plano pago.', 'Alternativa ao FluxoPromo'],
            ['Promium', 'Automação por loja com faixas por quantidade de grupos e conexões, vitrine própria e rotador de links.', 'Alternativa ao Promium'],
            ['AchadinhosBot', 'Envio automático para grupos com plano por quantidade de grupos; só Shopee.', 'Alternativa ao AchadinhosBot'],
          ],
          note: 'Descrições resumidas das fichas em /alternativas, cada uma com fonte e data de verificação. Nenhum preço de concorrente é citado aqui de propósito.',
        },
      },
      { h2: 'Melhor para e não é ideal para', bullets: ['Melhor para: afiliada Shopee que publica todo dia, em mais de um grupo ou canal, e quer o robô cuidando do que se repete.', 'Melhor para: quem quer as seis automações no mesmo plano, sem pagar por grupo ou por conexão extra.', 'Não é ideal para: quem só converte link de vez em quando — para isso, o gerador de link do próprio programa Shopee basta.', 'Não é ideal para: quem quer alguém prometendo resultado. Automação não vende; ela publica certo e no ritmo certo.'] },
      { h2: 'Como escolher em 10 minutos', bullets: ['Responda primeiro: você vai espelhar grupos de origem, garimpar por palavra-chave, ou os dois? É isso que decide o plano em cada ferramenta.', 'Conte os grupos e canais que recebem oferta. Se passa de 5, ferramenta que cobra por grupo muda a conta rápido.', 'Confira se a conversão cobre link de cupom, não só de produto — na Shopee, muita oferta é cupom.', 'Teste em paralelo por uma semana antes de cancelar o que usa hoje, olhando o link convertido e o preview no celular.'] },
    ],
    relatedLinks: [
      { href: '/shopee-afiliados-whatsapp', label: 'Divulgar Shopee no WhatsApp com o robô', note: 'espelhamento, garimpo e link curto com a sua chave' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Ainda não é afiliada Shopee?', note: 'cadastro, comissão e regras do programa' },
      { href: '/quanto-ganha-afiliado-shopee', label: 'Quanto ganha um afiliado Shopee', note: 'a tabela de comissão e o prazo de atribuição' },
      { href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', label: 'Como espelhar mensagens entre grupos', note: 'os 4 caminhos e o passo a passo' },
      { href: '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp', label: 'O que uma ferramenta de divulgação precisa ter', note: 'checklist antes de assinar' },
      { href: '/alternativas/bot-para-whatsapp-afiliados', label: 'Comparativo de bots para afiliados', note: 'planilha, automação genérica e ferramentas, lado a lado' },
    ],
    faq: [
      { q: 'Qual é a melhor automação para afiliado Shopee?', a: 'Depende de onde as suas ofertas nascem. Se você já acompanha grupos onde a promoção aparece primeiro, o espelhamento é a que mais economiza tempo. Se não acompanha grupo nenhum, a busca automática por palavra-chave é a que faz as ofertas saírem sozinhas. A conversão de link vale para todo mundo.' },
      { q: 'A Shopee permite automação de afiliados?', a: 'A Shopee oferece uma API oficial de afiliados, e é por ela que a busca de ofertas e a geração de link funcionam. O que o programa proíbe está nas regras dele: spam, tráfego artificial e promessa enganosa. Publicar oferta legítima, com o seu link, para quem quer receber, é o uso normal.' },
      { q: 'Automação garante que o meu número não será banido?', a: 'Não, e nenhuma ferramenta pode garantir isso. O que a automação faz é aplicar intervalo, limite por grupo e variação de texto — os controles que reduzem o padrão que o WhatsApp associa a robô. Publicar só para quem aceitou receber continua sendo decisão sua.' },
      { q: 'Preciso de grupo grande para valer a pena?', a: 'Não. O ganho é de tempo e de comissão que deixa de se perder por link errado, e isso vale desde o primeiro grupo. Tamanho muda a conta, não a lógica.' },
      { q: 'Quanto custa automatizar a divulgação da Shopee?', a: 'No Espelha Grupos, R$ 39 por 30 dias no Basic e R$ 69 no Pro, com grupos ilimitados e 7 dias de teste sem cartão. Os concorrentes cobram de outros jeitos — por grupo, por conexão ou por número — e os preços de cada um estão nas fichas em /alternativas, com data.' },
    ],
  },
  'ferramenta-para-divulgar-ofertas-em-grupos-whatsapp': {
    slug: '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp',
    title: 'Ferramenta para divulgar ofertas em grupos do WhatsApp',
    description: 'O que uma ferramenta para divulgar ofertas em grupos do WhatsApp precisa ter em 2026, quanto custa, para quem serve e como testar antes de assinar.',
    eyebrow: 'Divulgação em grupos · Como escolher',
    origin: 'blog_ferramenta_para_divulgar_ofertas_em_grupos_whatsapp',
    heroImage: { path: '/blog/hero/00-mascote.png', alt: 'Bit, o assistente do Espelha Grupos, que monitora, encaminha e converte links de afiliado', width: 1080, height: 1080 },
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'Uma ferramenta para divulgar ofertas em grupos do WhatsApp é um robô que publica as ofertas nos seus grupos e canais por você: pega a oferta de um grupo de origem ou de uma busca, troca o link pelo seu código de afiliada e envia com intervalo. Serve para afiliadas e admins de grupo de promoções que hoje fazem isso na mão. O Espelha Grupos faz isso a partir de R$ 39 por 30 dias, com grupos ilimitados e 7 dias de teste sem cartão.',
    midBridge: {
      question: 'Quer testar com os seus grupos antes de decidir?',
      body: 'Conecte o número, escolha origem e destinos, cadastre o seu código de afiliada e veja as ofertas saindo — com histórico de tudo. Basic R$ 39 e Pro R$ 69 a cada 30 dias; 7 dias grátis, sem cartão.',
      cta: 'Ver preços e testar 7 dias grátis',
      href: '/precos',
      secondary: { label: 'Como funciona a operação para afiliados', href: '/bot-afiliados-whatsapp' },
    },
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Em 2026, uma ferramenta para divulgar ofertas em grupos do WhatsApp precisa fazer cinco coisas: ler a origem da oferta (grupo, canal ou busca na loja), trocar o link pelo seu código de afiliada, publicar nos seus grupos e canais com intervalo e limite, não repetir a mesma oferta no mesmo destino e guardar o histórico do que saiu. O resto — arte, texto gerado, site próprio — é acessório. Se uma das cinco falta, você continua com trabalho na mão ou com comissão indo para outra pessoa.'] },
      { h2: 'O que ela precisa ter (checklist)', bullets: ['Conversão de link nas lojas que você divulga — produto E cupom. Sem isso, a oferta sai com o link do grupo de origem e a comissão não é sua.', 'Grupos de origem que você escolhe, e não um feed pronto: quem escolhe o que entra é você.', 'Intervalo entre envios, limite por grupo e horário de funcionamento, por destino.', 'Bloqueio de repetição: a mesma oferta não pode sair duas vezes no mesmo grupo no mesmo dia.', 'Histórico do que saiu, do que foi segurado e do que falhou — com o motivo em português.', 'Canal do WhatsApp como destino, além de grupo.', 'Preço que não muda quando você adiciona grupo.'] },
      {
        h2: 'Tipos de ferramenta e para quem serve cada uma',
        table: {
          headers: ['Tipo', 'O que faz', 'Melhor para', 'Fica devendo'],
          rows: [
            ['Agendador de mensagens', 'Envia uma mensagem pronta para vários grupos em horário marcado.', 'Quem cria as próprias ofertas e publica pouco.', 'Não lê grupo de origem nem troca link.'],
            ['Disparador em massa', 'Manda a mesma mensagem para listas e grupos de uma vez.', 'Campanha pontual para quem pediu para receber.', 'É o padrão de rajada que mais derruba número; sem intervalo, sem conversão.'],
            ['Conversor de link', 'Você cola o link, ele devolve com o seu código.', 'Quem divulga de vez em quando.', 'Você continua publicando na mão.'],
            ['Robô de afiliada (espelhador)', 'Lê origem, converte, publica com intervalo, bloqueia repetição e guarda histórico.', 'Quem publica todo dia em mais de um grupo ou canal.', 'Custa assinatura mensal.'],
          ],
        },
      },
      { h2: 'Quanto custa', paragraphs: ['No Espelha Grupos: Basic por R$ 39 e Pro por R$ 69, a cada 30 dias, grupos ilimitados nos dois, seis lojas (Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress) e 7 dias de teste com o Pro completo, sem cartão. Preços verificados em 19/09/2026 na página de preços.', 'Concorrentes cobram por grupo, por conexão de WhatsApp ou por número de usuários — e é isso que muda a conta quando a operação cresce. Os preços de cada um, com a data em que foram conferidos, estão nas fichas em /alternativas.'] },
      { h2: 'Melhor para e não é ideal para', bullets: ['Melhor para: afiliada ou admin de grupo de promoções que publica todo dia, em mais de um grupo ou canal, e quer o robô cuidando do que se repete.', 'Melhor para: quem divulga mais de uma loja e precisa que cada link saia com o código certo.', 'Não é ideal para: quem publica menos de 10 ofertas por semana num grupo só — o custo não se paga em tempo.', 'Não é ideal para: quem quer disparar para lista fria. Isso não é divulgação em grupo, é spam, e nenhuma ferramenta séria deveria fazer.'] },
      { h2: 'Como testar em 7 dias sem se comprometer', bullets: ['Dia 1: chip dedicado conectado, um grupo de origem e um destino de teste (pode ser um grupo só seu).', 'Dia 2: cadastre o código de afiliada de uma loja e confira, no celular, se o link publicado é o seu.', 'Dias 3 a 5: adicione os destinos reais com intervalo e limite; olhe o histórico todo dia.', 'Dias 6 e 7: compare com a semana anterior — tempo gasto, ofertas publicadas, link certo em 100% delas. Aí decida.'] },
    ],
    relatedLinks: [
      { href: '/bot-afiliados-whatsapp', label: 'Como funciona a operação para afiliados', note: 'origens, conversão de link, destinos e histórico' },
      { href: '/blog/como-espelhar-mensagens-entre-grupos-whatsapp', label: 'Como espelhar mensagens entre grupos', note: 'os 4 caminhos e o passo a passo' },
      { href: '/blog/melhores-automacoes-para-afiliado-shopee-2026', label: 'As automações que um afiliado Shopee usa em 2026', note: 'e quem faz cada uma' },
      { href: '/blog/quanto-custa-bot-para-whatsapp-afiliados', label: 'Quanto custa um bot para WhatsApp de afiliados', note: 'o custo real além da mensalidade' },
      { href: '/melhores-bots-para-afiliados-whatsapp', label: 'Critérios para comparar bots', note: 'sem ranking falso nem promessa de ganho' },
      { href: '/alternativas/bot-para-whatsapp-afiliados', label: 'Comparativo de bots para afiliados', note: 'planilha, automação genérica e ferramentas, lado a lado' },
      { href: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', label: 'Ainda não tem grupo?', note: 'os primeiros passos antes de automatizar' },
    ],
    faq: [
      { q: 'Qual a melhor ferramenta para divulgar ofertas em grupos do WhatsApp?', a: 'A que faz as cinco coisas da resposta direta para as lojas que você divulga, sem cobrar por grupo. Para afiliada que publica todo dia, isso é um espelhador com conversão de link; para quem publica pouco, um conversor de link e o próprio WhatsApp bastam.' },
      { q: 'Existe ferramenta grátis para divulgar ofertas em grupos?', a: 'Existem geradores de link gratuitos e agendadores simples. O que costuma ser pago é a parte que economiza tempo de verdade: ler o grupo de origem, converter e publicar sozinho. No Espelha Grupos o teste de 7 dias é gratuito e não pede cartão.' },
      { q: 'Ferramenta de divulgação dá banimento?', a: 'Ninguém pode garantir que um número não será banido. O que aumenta o risco é padrão de rajada, mensagem idêntica repetida e gente que não pediu para receber. Uma ferramenta séria controla os dois primeiros; o terceiro é decisão sua.' },
      { q: 'Preciso de um número só para isso?', a: 'É o mais recomendado. Se o número da operação tiver problema, os seus contatos e conversas pessoais continuam intactos em outro número.' },
      { q: 'Funciona com Canal do WhatsApp?', a: 'Sim. O Canal alcança mais gente e ninguém responde por cima da oferta; grupo continua sendo útil como origem e como comunidade.' },
    ],
  },
}

export function getPreservationBlogMetadata(postKey) {
  const post = PRESERVATION_BLOG_POSTS[postKey]
  if (!post) return {}
  // Imagem de destaque do post (2026-09-21) — quando existe, ela vira o
  // og:image deste post específico em vez do og-default.png genérico do
  // site: prévia de link no WhatsApp/redes/IA fica reconhecível pelo tema do
  // artigo, não só pela marca. Post sem heroImage cai no comportamento
  // histórico via buildOgImageDescriptor() sem argumento.
  const ogImage = post.heroImage
    ? buildOgImageDescriptor({ imagePath: post.heroImage.path, width: post.heroImage.width, height: post.heroImage.height, alt: post.heroImage.alt })
    : buildOgImageDescriptor()
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: post.slug },
    openGraph: { title: post.title, description: post.description, url: `${siteUrl}${post.slug}`, type: 'article', locale: 'pt_BR', images: [ogImage] },
  }
}

/* PONTE DE INTENÇÃO NO MEIO DO ARTIGO (auditoria de funil 2026-08-05, §2.3).
 *
 * Estes dois posts concentram 42% das impressões do site, mas a única oferta
 * vivia na seção "Próximo passo", no fim — depois do ponto em que a maior
 * parte do tráfego mobile já abandonou. Pior: quem lê "como ser afiliado"
 * ainda NÃO tem grupo, então o CTA de diagnóstico anti-ban fala de um problema
 * que essa pessoa ainda não tem.
 *
 * A ponte entra no meio, qualifica em vez de empurrar ("você já tem grupo?")
 * e manda quem está pronto para o preço, sem interromper quem não está.
 * Sem promessa de ganho — só de trabalho a menos (PRODUCT_LIMITATIONS).
 */
function MidArticleBridge({ bridge, slug }) {
  const utm = `utm_source=blog&utm_medium=organic&utm_campaign=mid_article_bridge&utm_content=${encodeURIComponent(slug.replace('/blog/', ''))}`
  return (
    <aside className="my-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
      <p className="text-base font-black text-gray-950">{bridge.question}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{bridge.body}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white no-underline hover:bg-emerald-700"
          href={internalContentHref(bridge.href, `${utm}&utm_term=primary`)}
          data-seo-cta="blog_mid_bridge"
          data-cta-position="article_mid_bridge"
          data-cta-stage="consideration"
        >
          {bridge.cta}
        </Link>
        {bridge.secondary ? (
          <Link
            className="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-700 no-underline hover:border-emerald-300"
            href={internalContentHref(bridge.secondary.href, `${utm}&utm_term=secondary`)}
            data-seo-cta="blog_mid_bridge_secondary"
            data-cta-position="article_mid_bridge"
            data-cta-stage="awareness"
          >
            {bridge.secondary.label}
          </Link>
        ) : null}
      </div>
    </aside>
  )
}

// Schema derivado das próprias seções (fonte única: o que a pessoa lê é o que
// a IA lê). Uma seção com `schema: 'HowTo'` e `steps` vira HowTo; uma com
// `schema: 'ItemList'` e `items` vira ItemList. Sem flag, nada é emitido —
// lista comum não vira ItemList por acidente.
export function buildSectionSchemas(post, baseUrl) {
  const out = []
  for (const section of post.sections ?? []) {
    if (section.schema === 'HowTo' && section.steps?.length) {
      out.push({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: section.h2,
        description: post.description,
        step: section.steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, name: step.name, text: step.text })),
      })
    }
    if (section.schema === 'ItemList' && section.items?.length) {
      out.push({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: section.h2,
        numberOfItems: section.items.length,
        itemListElement: section.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          description: item.text,
          ...(item.href ? { url: `${baseUrl}${item.href}` } : {}),
        })),
      })
    }
  }
  return out
}

export function PreservationBlogPost({ postKey }) {
  const post = PRESERVATION_BLOG_POSTS[postKey]
  const dates = getEditorialDates(post.slug)
  const personAuthor = post.usePersonAuthor
    ? {
        type: 'Person',
        name: EDITORIAL_PERSON_AUTHOR,
        description: EDITORIAL_PERSON_AUTHOR_DESCRIPTION,
        idPath: EDITORIAL_PERSON_AUTHOR_ID_PATH,
        photoPath: EDITORIAL_PERSON_AUTHOR_PHOTO_PATH,
        sameAs: EDITORIAL_PERSON_AUTHOR_SAME_AS,
      }
    : undefined
  const schemas = [
    ...buildArticleJsonLd({ title: post.title, description: post.description, slug: post.slug, siteUrl, faq: post.faq, author: personAuthor, image: post.heroImage }),
    ...buildSectionSchemas(post, siteUrl),
  ]

  return (
    <>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleShell
        eyebrow={post.eyebrow}
        title={post.title}
        description={post.description}
        origin={post.origin}
        publishedAt={dates.publishedAt}
        updatedAt={dates.updatedAt}
        author={post.usePersonAuthor ? EDITORIAL_PERSON_AUTHOR : undefined}
        authorPhotoPath={post.usePersonAuthor ? EDITORIAL_PERSON_AUTHOR_PHOTO_PATH : undefined}
        authorHref={post.usePersonAuthor ? EDITORIAL_PERSON_AUTHOR_LINKEDIN_URL : undefined}
        leadMagnetVariant={post.leadMagnetVariant ?? 'default'}
        heroImage={post.heroImage}
      >
        <section>
          <h2>Resumo prático</h2>
          <p>{post.intro}</p>
        </section>

        {post.sections.map((section, sectionIndex) => (
          <Fragment key={section.h2}>
          {/* FR-027 (US6): midBridge com position:'end' NUNCA renderiza aqui
              no meio — só depois de todas as seções técnicas, logo abaixo. */}
          {post.midBridge && post.midBridge.position !== 'end' && sectionIndex === Math.ceil(post.sections.length / 2) ? (
            <MidArticleBridge bridge={post.midBridge} slug={post.slug} />
          ) : null}
          <section key={section.h2}>
            <h2>{section.h2}</h2>
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            ) : null}
            {section.steps ? (
              <ol>
                {section.steps.map((step) => (
                  <li key={step.name}><strong>{step.name}.</strong> {step.text}</li>
                ))}
              </ol>
            ) : null}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>
                    {item.text ? ` — ${item.text}` : null}
                    {item.bestFor ? <> <em>Melhor para:</em> {item.bestFor}.</> : null}
                    {item.href ? <> <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href={item.href}>{item.linkLabel ?? 'Ver como funciona'}</Link></> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {section.table ? (
              <div className="overflow-x-auto rounded-2xl border border-emerald-100">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead className="bg-emerald-50">
                    <tr>
                      {section.table.headers.map((header) => (
                        <th key={header} className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, i) => (
                      <tr key={row[0]} className={i === section.table.rows.length - 1 ? '' : 'border-b border-emerald-50'}>
                        {row.map((cell, j) => (
                          <td key={j} className={`p-4 align-top ${j === 0 ? 'font-semibold text-gray-950' : 'text-gray-600'}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {section.table.note ? <p className="border-t border-emerald-100 bg-emerald-50/60 p-3 text-xs text-gray-500">{section.table.note}</p> : null}
              </div>
            ) : null}
          </section>
          </Fragment>
        ))}

        {/* FR-027 (US6): a menção ao produto entra AQUI — depois de TODAS as
            seções técnicas (cadastro, comissão, regras, divulgação),
            apresentada como a ferramenta que resolve a parte repetitiva. */}
        {post.midBridge && post.midBridge.position === 'end' ? (
          <MidArticleBridge bridge={post.midBridge} slug={post.slug} />
        ) : null}

        {post.relatedLinks?.length ? (
          <section>
            <h2>{post.relatedTitle ?? 'Continue no cluster de afiliados'}</h2>
            <ul>
              {post.relatedLinks.map((item) => (
                <li key={item.href}>
                  <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href={item.href}>{item.label}</Link>
                  {item.note ? ` — ${item.note}` : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2>Próximo passo</h2>
          <p>
            Se você quer aplicar esse processo na prática, comece pela página de Canais + Preservação e veja como o Espelha Grupos conecta grupos, canais, cadência e monitoramento em uma operação única.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-black text-white no-underline hover:bg-emerald-700"
              href="/diagnostico-antiban-whatsapp"
              data-seo-cta="blog_diagnostic"
              data-cta-position="article_next_step_primary"
              data-cta-stage="diagnostic"
              data-cta-destination="diagnostic"
            >
              Fazer diagnóstico de preservação
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/materiais/checklist-antiban-whatsapp"
              data-seo-cta="blog_checklist"
              data-cta-position="article_next_step_secondary"
              data-cta-stage="lead_magnet"
              data-cta-destination="checklist"
            >
              Ver checklist de preservação
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/ferramentas/calculadora-risco-whatsapp"
              data-seo-cta="blog_risk_calculator"
              data-cta-position="article_next_step_tool"
              data-cta-stage="tool"
              data-cta-destination="calculator"
            >
              Calcular risco operacional
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/bot-canais-whatsapp"
              data-seo-cta="blog_campaign_landing"
              data-cta-position="article_next_step_landing"
              data-cta-stage="consideration"
              data-cta-destination="landing"
            >
              Ver campanha Canais + Preservação
            </Link>
          </div>
        </section>

        <section>
          <h2>FAQ</h2>
          {post.faq.map((item) => (
            <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
              <p className="mt-3 text-gray-700">{item.a}</p>
            </details>
          ))}
        </section>
      </ArticleShell>
    </>
  )
}
