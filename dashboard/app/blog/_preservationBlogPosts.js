import Link from 'next/link'
import { ArticleShell } from '@/components/marketing/ArticleShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'

const siteUrl = getSiteUrl()

export const PRESERVATION_BLOG_POSTS = {
  'grupo-ou-canal-whatsapp-achadinhos': {
    slug: '/blog/grupo-ou-canal-whatsapp-achadinhos',
    title: 'Grupo ou Canal do WhatsApp: qual é melhor para achadinhos?',
    description: 'Entenda quando usar grupo, quando usar Canal do WhatsApp e como combinar os dois para divulgar achadinhos com mais organização e preservação operacional.',
    eyebrow: 'Canais · Estratégia de migração',
    origin: 'blog_grupo_ou_canal_whatsapp_achadinhos',
    usePersonAuthor: true,
    intro: 'A resposta curta: grupo é melhor para conversa e comunidade; canal é melhor para vitrine organizada. Para afiliados de achadinhos, a operação mais madura costuma combinar os dois com papéis diferentes.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use grupos quando você precisa de conversa, feedback e senso de comunidade. Use Canais do WhatsApp quando a prioridade é publicar ofertas em formato de vitrine, com menos ruído e mais previsibilidade de leitura.', 'O erro é tratar grupo e canal como concorrentes. Em uma operação de achadinhos, o grupo pode continuar como fonte ou comunidade, enquanto o canal vira destino principal das ofertas selecionadas.'] },
      { h2: 'Quando o grupo faz sentido', bullets: ['Comunidade que comenta e pede indicação.', 'Curadoria colaborativa de achadinhos.', 'Relacionamento com seguidores mais próximos.', 'Testes rápidos de oferta e feedback.'] },
      { h2: 'Quando o canal faz sentido', bullets: ['Publicação de ofertas em vitrine limpa.', 'Menos ruído de conversa entre membros.', 'Organização por nicho, frequência e calendário.', 'Distribuição mais clara para quem quer só receber oportunidades.'] },
      { h2: 'O modelo recomendado', paragraphs: ['Comece mapeando quais grupos geram boas ofertas, quais grupos têm audiência engajada e quais canais podem funcionar como vitrine. Depois, defina regras de espelhamento para que cada destino receba a oferta no ritmo certo.', 'O BOTinho entra como camada operacional: espelha de grupo para canal, de canal para grupo e entre canais, mantendo cadência, variações e monitoramento dentro do Módulo de Preservação Avançada.'] },
    ],
    relatedTitle: 'Continue: o que divulgar nos seus achadinhos',
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual programa escolher', note: 'comissão e prazo de atribuição dos três, lado a lado' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'o programa mais buscado no Brasil' },
      { href: '/bot-achadinhos-whatsapp', label: 'Automatizar um grupo de achadinhos', note: 'conversão de link e cadência controlada' },
    ],
    faq: [
      { q: 'Canal vende mais que grupo?', a: 'Depende do público. Canal tende a ser melhor como vitrine organizada; grupo tende a ser melhor para conversa e comunidade. O ideal é testar os dois com papéis diferentes.' },
      { q: 'Preciso abandonar meus grupos?', a: 'Não. A migração mais segura mantém grupos úteis e adiciona canais como camada de distribuição organizada.' },
      { q: 'Como o BOTinho ajuda nessa escolha?', a: 'Ele permite espelhar entre grupos e canais, configurar cadência e aplicar o Módulo de Preservação Avançada para reduzir comportamento robótico.' },
    ],
  },
  'como-evitar-banimento-whatsapp-afiliados': {
    slug: '/blog/como-evitar-banimento-whatsapp-afiliados',
    title: 'Como reduzir o risco de banimento no WhatsApp para afiliados',
    description: 'Guia honesto para afiliados reduzirem risco no WhatsApp com chip dedicado, cadência, variações, canais e Módulo de Preservação Avançada.',
    eyebrow: 'Preservação avançada · Risco operacional',
    origin: 'blog_como_evitar_banimento_whatsapp_afiliados',
    usePersonAuthor: true,
    intro: 'Não existe garantia contra banimento. O que existe é uma operação menos robótica, com chip dedicado, volume controlado, variações, monitoramento e plano de recuperação.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Para reduzir risco, pare de operar como disparo: use chip dedicado, limite frequência, evite madrugada, varie texto, distribua ofertas em horários diferentes e monitore sinais de saúde por canal.', 'O Módulo de Preservação Avançada do BOTinho existe para organizar essas camadas. O termo “anti-ban” aparece em buscas, mas não deve ser tratado como promessa absoluta.'] },
      { h2: 'Checklist mínimo de preservação', bullets: ['Usar chip dedicado, nunca número pessoal.', 'Definir limite por hora e por dia.', 'Ativar horário de silêncio.', 'Evitar mensagens idênticas em todos os destinos.', 'Ter plano de recuperação para canal e chip.'] },
      { h2: 'O que aumenta risco', paragraphs: ['Publicar muitas ofertas em sequência, repetir o mesmo texto em vários destinos e depender de um único grupo ou chip aumenta a fragilidade da operação.', 'Outro ponto crítico é não perceber queda de entrega. Quando os cliques caem e ninguém monitora, o afiliado só descobre tarde demais que o canal perdeu força.'] },
      { h2: 'Como o BOTinho organiza o processo', paragraphs: ['O BOTinho combina cadência, variações, espelhamento entre grupos e canais, monitoramento e pausas preventivas. A ferramenta não controla decisões da plataforma, mas ajuda o afiliado a evitar comportamento de operação improvisada.'] },
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
      { q: 'Canal é mais seguro que grupo?', a: 'Canal ajuda a organizar a vitrine, mas ainda precisa de cadência, variações e monitoramento. Formato sozinho não resolve operação mal configurada.' },
    ],
  },
  'shadowban-whatsapp-canais': {
    slug: '/blog/shadowban-whatsapp-canais',
    title: 'Shadowban em Canais do WhatsApp: sinais silenciosos para monitorar',
    description: 'Veja sinais de queda silenciosa em Canais do WhatsApp e como afiliados podem monitorar entrega, cliques e saúde antes do prejuízo.',
    eyebrow: 'Monitoramento · Canais do WhatsApp',
    origin: 'blog_shadowban_whatsapp_canais',
    usePersonAuthor: true,
    intro: 'O problema do shadowban é que ele raramente aparece como um aviso claro. O afiliado percebe quando os cliques somem, as ofertas param de performar e o canal já perdeu força.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Você deve monitorar queda brusca de cliques, atraso de entrega, erros recorrentes, sumiço de visualizações e divergência entre publicação e recebimento por uma conta-sentinela.', 'Nenhum sinal isolado prova shadowban. Mas um conjunto de sinais deve acionar redução de cadência e revisão da operação.'] },
      { h2: 'Sinais que merecem atenção', bullets: ['Cliques caem sem mudança de oferta ou horário.', 'Seguidores relatam que não viram publicações.', 'Mensagens demoram mais para aparecer.', 'Canais parecidos performam bem, mas um canal específico despenca.', 'Erros técnicos começam a se repetir.'] },
      { h2: 'Conta-sentinela: por que ela importa', paragraphs: ['Uma conta-sentinela é um número secundário que segue seus canais e confirma se as mensagens aparecem como deveriam. Ela ajuda a detectar diferença entre “post publicado” e “post realmente visto”.'] },
      { h2: 'O que fazer quando o risco sobe', paragraphs: ['Reduza frequência, pause publicações no canal afetado, revise variações e confira se houve mudança de comportamento recente. Se o canal continuar em risco, prepare plano de recuperação antes que a audiência fique inacessível.'] },
    ],
    relatedTitle: 'Continue: risco de bloqueio no WhatsApp',
    relatedLinks: [
      { href: '/anti-ban-whatsapp', label: 'WhatsApp banido: o que aumenta e o que reduz o risco', note: 'sem promessa de imunidade' },
      { href: '/blog/bot-whatsapp-antiban-existe', label: 'Bot antiban existe mesmo?', note: 'o que nenhuma ferramenta pode garantir' },
      { href: '/faq-antiban-whatsapp', label: 'Perguntas frequentes sobre banimento', note: 'respostas diretas' },
    ],
    faq: [
      { q: 'Shadowban no WhatsApp é sempre comprovável?', a: 'Não. Normalmente você trabalha com sinais indiretos: cliques, entrega, relatos, conta-sentinela e comparação entre canais.' },
      { q: 'O BOTinho detecta todos os casos?', a: 'Não existe detecção perfeita. O BOTinho ajuda a monitorar sinais e agir preventivamente quando a operação sai do padrão esperado.' },
      { q: 'O que fazer primeiro diante de queda brusca?', a: 'Pause ou reduza cadência, compare canais semelhantes e valide recebimento com conta-sentinela.' },
    ],
  },
  'migrar-grupo-achadinhos-para-canal': {
    slug: '/blog/migrar-grupo-achadinhos-para-canal',
    title: 'Como migrar um grupo de achadinhos para Canal do WhatsApp',
    description: 'Passo a passo para migrar grupos de achadinhos para Canais do WhatsApp sem interromper a operação e preservando audiência.',
    eyebrow: 'Migração · Grupo para canal',
    origin: 'blog_migrar_grupo_achadinhos_para_canal',
    usePersonAuthor: true,
    intro: 'A migração não deve ser um corte brusco. O caminho mais seguro é transformar o canal em vitrine, manter o grupo como apoio e usar espelhamento com cadência controlada.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Crie o canal, anuncie a mudança no grupo, publique ofertas em paralelo por alguns dias, acompanhe cliques e só depois reduza a dependência do grupo.', 'Com o BOTinho, você pode espelhar ofertas entre grupo e canal enquanto testa cadência, formato e aceitação da audiência.'] },
      { h2: 'Passo a passo recomendado', bullets: ['Faça inventário dos grupos, canais e fontes atuais.', 'Crie o canal com nome claro e descrição fiel ao conteúdo.', 'Avise o grupo com CTA simples para seguir o canal.', 'Publique em paralelo antes de cortar qualquer fluxo.', 'Monitore cliques, visualizações e reclamações.'] },
      { h2: 'Como evitar uma migração confusa', paragraphs: ['Não mude tudo de uma vez. Se você troca formato, frequência e copy no mesmo dia, fica impossível saber o que afetou o resultado. Preserve um padrão por vez e compare dados.'] },
      { h2: 'Onde entra o Módulo de Preservação Avançada', paragraphs: ['Ele organiza limites, variações, pausa e monitoramento para que o novo canal não nasça com comportamento mecânico. O canal deve parecer administrado por uma pessoa, não por um disparador.'] },
    ],
    relatedTitle: 'Continue: grupos, canais e achadinhos',
    relatedLinks: [
      { href: '/blog/grupo-ou-canal-whatsapp-achadinhos', label: 'Grupo ou canal para achadinhos?', note: 'o que muda em alcance e em risco' },
      { href: '/bot-achadinhos-whatsapp', label: 'Automatizar um grupo de achadinhos', note: 'da conversão do link ao envio' },
      { href: '/bot-canal-whatsapp', label: 'Publicar em Canais do WhatsApp', note: 'como o BOTinho envia para canal' },
    ],
    faq: [
      { q: 'Quanto tempo dura a migração?', a: 'Depende do tamanho da audiência, mas uma janela de paralelismo entre grupo e canal costuma ser mais segura que migração imediata.' },
      { q: 'Posso manter grupo e canal para sempre?', a: 'Sim. Muitos afiliados usam grupo como comunidade e canal como vitrine de ofertas.' },
      { q: 'O BOTinho espelha grupo para canal?', a: 'Sim. O BOTinho foi posicionado para operar grupo para canal, canal para grupo, canal para canal e grupo para grupo.' },
    ],
  },
  'chip-dedicado-bot-whatsapp': {
    slug: '/blog/chip-dedicado-bot-whatsapp',
    title: 'Por que afiliados devem usar chip dedicado no bot do WhatsApp',
    description: 'Entenda por que chip dedicado protege sua operação de afiliados no WhatsApp e evita misturar número pessoal com canais e grupos de ofertas.',
    eyebrow: 'Operação responsável · Chip dedicado',
    origin: 'blog_chip_dedicado_bot_whatsapp',
    usePersonAuthor: true,
    intro: 'Se o WhatsApp gera receita, o chip virou ativo operacional. Usar o número pessoal para rodar bot, grupos e canais mistura risco comercial com vida pessoal.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Afiliados devem usar chip dedicado porque o número que publica, segue canais e administra rotina de ofertas é parte da infraestrutura do negócio.', 'Se esse número cair, travar ou precisar ser substituído, o impacto deve ficar isolado da sua vida pessoal e do seu atendimento principal.'] },
      { h2: 'Riscos de usar número pessoal', bullets: ['Perder acesso a conversas pessoais em caso de bloqueio.', 'Misturar rotina comercial e vida privada.', 'Dificultar recuperação da operação.', 'Não conseguir separar testes, canais e alertas.', 'Aumentar ansiedade operacional a cada instabilidade.'] },
      { h2: 'Como tratar chip como ativo', paragraphs: ['Registre quem usa o chip, onde ele está conectado, quais canais administra e quais rotinas dependem dele. Tenha backup de configurações, lista de canais e processo de substituição.'] },
      { h2: 'Papel do BOTinho', paragraphs: ['O BOTinho não elimina risco do chip, mas ajuda a operar com cadência, monitoramento, pausas e plano de recuperação. Isso torna o chip parte de um processo, não um ponto único de improviso.'] },
    ],
    relatedTitle: 'Continue: proteger o número da operação',
    relatedLinks: [
      { href: '/anti-ban-whatsapp', label: 'WhatsApp banido: o que aumenta e o que reduz o risco', note: 'os fatores que realmente pesam' },
      { href: '/blog/como-evitar-banimento-whatsapp-afiliados', label: 'Reduzir risco de banimento como afiliado', note: 'cadência e variação de texto' },
      { href: '/protecao-antiban-botinho', label: 'Como o BOTinho preserva a sessão', note: 'limites por destino e monitoramento' },
    ],
    faq: [
      { q: 'Posso começar com meu número pessoal?', a: 'Não é recomendado. Mesmo operações pequenas deveriam separar número pessoal e número operacional desde o início.' },
      { q: 'Preciso de mais de um chip?', a: 'Para começar, um chip dedicado já reduz bastante a mistura de risco. Operações maiores podem estruturar chips por função.' },
      { q: 'Chip dedicado evita banimento?', a: 'Não. Ele reduz impacto e melhora organização, mas precisa vir junto de cadência, variações, monitoramento e uso responsável.' },
    ],
  },
  'bot-whatsapp-antiban-existe': {
    slug: '/blog/bot-whatsapp-antiban-existe',
    title: 'Bot “anti-ban” para WhatsApp existe? A resposta honesta',
    description: 'Entenda por que “anti-ban” absoluto não existe e como o Módulo de Preservação Avançada do BOTinho reduz risco com camadas operacionais.',
    eyebrow: 'Busca “anti-ban” · Resposta honesta',
    origin: 'blog_bot_whatsapp_antiban_existe',
    usePersonAuthor: true,
    intro: 'A resposta honesta é: bot “anti-ban” absoluto não existe. O que existe é preservação avançada, uma combinação de decisões operacionais para reduzir risco e recuperar mais rápido.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Nenhum bot controla decisões da plataforma. Portanto, qualquer promessa de “anti-ban 100%” deve ser tratada como exagero comercial.', 'O BOTinho usa Módulo de Preservação Avançada: ritmo humano, variações, monitoramento, pausa preventiva, chip dedicado e plano de recuperação.'] },
      { h2: 'Por que o termo “anti-ban” aparece', paragraphs: ['Afiliados pesquisam por “anti-ban” porque sentem medo real de perder chip, canal e audiência. Usar o termo ajuda a responder a busca, mas a comunicação precisa deixar claro que não é garantia absoluta.'] },
      { h2: 'O que é preservação avançada', bullets: ['Cadência por destino.', 'Limites por hora e dia.', 'Horário de silêncio.', 'Variações de copy e ordem da oferta.', 'Monitoramento de saúde e cliques.', 'Pausa preventiva quando o risco aumenta.', 'Plano de recuperação para canal e chip.'] },
      { h2: 'Como avaliar uma ferramenta', paragraphs: ['Desconfie de ferramenta que só promete “não banir”. Prefira produto que explica limites, recomenda chip dedicado, fala de uso responsável e mostra quais camadas realmente controla.'] },
    ],
    relatedTitle: 'Continue: o que dá e o que não dá para prometer',
    relatedLinks: [
      { href: '/anti-ban-whatsapp', label: 'WhatsApp banido: o que aumenta e o que reduz o risco', note: 'redução de risco, não imunidade' },
      { href: '/faq-antiban-whatsapp', label: 'Perguntas frequentes sobre banimento', note: 'as dúvidas mais comuns' },
      { href: '/protecao-antiban-botinho', label: 'Como o BOTinho preserva a sessão', note: 'o que a ferramenta faz de fato' },
    ],
    faq: [
      { q: 'Então o BOTinho é “anti-ban”?', a: 'Não como promessa absoluta. O BOTinho oferece Módulo de Preservação Avançada para reduzir risco, monitorar sinais e preparar recuperação.' },
      { q: 'Por que não prometer 100%?', a: 'Porque nenhuma ferramenta externa controla todas as decisões da plataforma. Prometer 100% seria desonesto.' },
      { q: 'O que devo ativar primeiro?', a: 'Chip dedicado, limites por destino, horário de silêncio, variações e monitoramento básico de cliques e entrega.' },
    ],
  },
  'comecar-afiliado-whatsapp-sem-grupo-grande': {
    slug: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande',
    title: 'Como começar como afiliado no WhatsApp sem ter grupo grande',
    description: 'Guia para afiliado iniciante começar a divulgar ofertas no WhatsApp mesmo sem audiência grande: chip dedicado, primeiros grupos, conversão de link e cadência responsável.',
    eyebrow: 'Para quem está começando · Passo a passo',
    origin: 'blog_comecar_afiliado_whatsapp_sem_grupo_grande',
    usePersonAuthor: true,
    intro: 'Você não precisa de um grupo gigante para começar a ganhar comissão no WhatsApp. Precisa de um chip dedicado, links de afiliado convertidos certo e uma rotina de envio que não pareça spam. O resto cresce com consistência.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Comece pequeno e organizado: separe um chip só para a operação, cadastre seus IDs de afiliada (Mercado Livre, Amazon, Shopee), monte 1 ou 2 grupos/canais de destino e publique poucas ofertas boas por dia com texto que pareça você falando.', 'Grupo grande é consequência, não pré-requisito. Quem começa focando em volume costuma queimar o número antes de ter audiência.'] },
      { h2: 'O que você precisa no dia 1', bullets: ['Um chip dedicado (nunca o número pessoal).', 'Contas de afiliado nas plataformas que você vai divulgar.', 'Um grupo ou canal de destino, mesmo que pequeno.', 'Uma fonte de ofertas (grupos que você acompanha, sites, encartes).', 'Uma ferramenta que converte o link e mantém cadência.'] },
      { h2: 'O erro mais comum de quem começa', paragraphs: ['O iniciante cola o link cru, sem converter para afiliado — e perde a comissão da venda que ele mesmo gerou. O segundo erro é despejar 30 ofertas seguidas no mesmo dia, o que parece spam e arrisca o número.', 'A correção é simples: converta todo link antes de enviar e limite a frequência. Poucas ofertas boas convertem mais do que muitas ofertas repetidas.'] },
      { h2: 'Como o BOTinho ajuda quem está começando', paragraphs: ['O BOTinho converte automaticamente os links de Mercado Livre, Amazon e Shopee para o seu código de afiliada antes de enviar, espelha as ofertas dos grupos que você acompanha para os seus destinos e mantém uma cadência responsável para reduzir risco no número.', 'Para quem está começando, isso elimina a parte chata (copiar, converter, reescrever, reenviar) e deixa você focar em escolher boas ofertas.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'cadastro gratuito, comissão a partir de 3%' },
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'Shopee, Amazon e Mercado Livre comparados' },
      { href: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', label: 'Montar um grupo de ofertas do zero', note: 'os primeiros passos' },
    ],
    faq: [
      { q: 'Preciso de muitos seguidores para começar?', a: 'Não. Dá para começar com um grupo ou canal pequeno. O que importa no início é converter os links corretamente e manter consistência, não o tamanho da audiência.' },
      { q: 'Posso usar meu WhatsApp pessoal?', a: 'Não é recomendado. Use um chip dedicado para a operação, separando do seu número pessoal e reduzindo o risco de perder seus contatos se algo der errado.' },
      { q: 'O BOTinho converte os links sozinho?', a: 'Sim. Ele converte links suportados (Mercado Livre, Amazon, Shopee) para o seu código de afiliada antes do envio, então você não esquece de marcar a comissão.' },
    ],
  },
  'como-ser-afiliado-shopee-whatsapp': {
    slug: '/blog/como-ser-afiliado-shopee-whatsapp',
    title: 'Shopee Afiliados: como se cadastrar e divulgar no WhatsApp (guia 2026)',
    description: 'Guia completo de Shopee Afiliados: como se cadastrar, quanto paga de comissão por tipo de venda, prazo de atribuição e como divulgar no WhatsApp sem perder comissão.',
    eyebrow: 'Shopee Afiliados · Guia completo',
    origin: 'blog_como_ser_afiliado_shopee_whatsapp',
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'Shopee Afiliados é o programa que paga comissão sobre vendas geradas pelo seu link. O cadastro é gratuito, a comissão parte de 3% e a atribuição vale por até 7 dias após o clique. Divulgar no WhatsApp funciona bem quando o link sai sempre com o seu código e a frequência de envio é controlada.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Cadastre-se no Programa de Afiliados Shopee, pegue suas credenciais de afiliado, gere o link de cada produto com o seu código e divulgue no WhatsApp com texto próprio e frequência controlada.', 'O ponto crítico é garantir que TODO link enviado já esteja convertido para o seu código — senão a venda acontece, mas a comissão não cai para você.'] },
      { h2: 'Quanto paga a comissão da Shopee', paragraphs: ['A comissão-base é de 3% sobre o valor líquido da venda (sem impostos, cupons ou frete), tanto para vendas via redes sociais/WhatsApp quanto para vendas geradas em lives e Shopee Vídeo.', 'Existe também o programa de Comissão Extra: ao divulgar produtos de parceiros selecionados, a comissão pode chegar a até 30% — a comissão padrão da Shopee soma com uma comissão extra paga pelo próprio vendedor.'], table: { headers: ['Tipo de venda', 'Comissão'], rows: [['Venda padrão (redes sociais e WhatsApp)', '3%'], ['Vendas em lives', '3%'], ['Vendas via Shopee Vídeo', '3%'], ['Produtos do programa de Comissão Extra', 'até 30% (padrão + extra do vendedor)']], note: 'Fonte: Shopee Affiliate Program, "Entenda o Comissionamento da Shopee" (consultado em 30/07/2026). Comissão calculada sobre o valor líquido da venda; sujeita às condições especiais e a alterações sem aviso prévio da Shopee.' } },
      { h2: 'Prazo para a comissão ser atribuída a você', paragraphs: ['Quando alguém clica no seu link e adiciona o produto ao carrinho, a Shopee guarda essa atribuição por até 7 dias — mesmo que a pessoa não compre na hora, você ainda ganha a comissão se ela finalizar a compra dentro desse prazo.', 'Sites e apps especializados em cupom, cashback ou tecnologia têm taxa de comissão sob consulta — as regras padrão valem para o afiliado comum divulgando em grupos e canais.'] },
      { h2: 'Como se tornar afiliado Shopee: passo a passo', paragraphs: ['Tornar-se afiliado Shopee leva poucos minutos e não tem custo. O cadastro é feito no site do Programa de Afiliados Shopee, e depois da aprovação você já consegue gerar links com o seu código.'], bullets: ['Acesse o site do Programa de Afiliados Shopee e crie sua conta.', 'Confirme seus dados cadastrais e aguarde a aprovação.', 'Ao entrar na sua conta de afiliado, localize suas credenciais (appId / secret).', 'Gere links com o seu código para os produtos que vai divulgar.', 'Organize seus grupos e canais de destino no WhatsApp antes de começar a publicar.'] },
      { h2: 'Como divulgar sem queimar o número', paragraphs: ['Use um chip dedicado, publique poucas ofertas boas por vez, varie o texto e evite mandar a mesma mensagem idêntica para todos os destinos ao mesmo tempo.', 'Quem dispara dezenas de links iguais em sequência arrisca o número e ainda cansa a audiência. Cadência responsável vende mais no médio prazo.'] },
      { h2: 'Como o BOTinho automatiza a Shopee', paragraphs: ['Com as credenciais de afiliada Shopee cadastradas, o BOTinho converte os links para o seu código automaticamente antes de enviar, monta a oferta com título e preço e distribui para os seus grupos e canais com cadência controlada.', 'Assim você não precisa gerar link a link na mão nem corre o risco de enviar um link sem comissão.'] },
    ],
    relatedLinks: [
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
      { q: 'Preciso gerar cada link na mão?', a: 'Não, se usar uma ferramenta de conversão. Com as credenciais Shopee no BOTinho, os links são convertidos automaticamente para o seu código antes do envio.' },
      { q: 'Posso divulgar Shopee e outras lojas juntas?', a: 'Sim. É comum divulgar Shopee, Mercado Livre e Amazon na mesma operação. O importante é manter cada link com o código de afiliado correto.' },
    ],
  },
  'como-divulgar-ofertas-amazon-whatsapp': {
    slug: '/blog/como-divulgar-ofertas-amazon-whatsapp',
    title: 'Afiliado Amazon: como divulgar ofertas no WhatsApp (comissão por categoria)',
    description: 'Guia de afiliado Amazon (Amazon Associados): quanto paga de comissão por categoria de produto, como divulgar no WhatsApp com a tag correta e cadência que protege o número.',
    eyebrow: 'Afiliado Amazon · Divulgação',
    origin: 'blog_como_divulgar_ofertas_amazon_whatsapp',
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'Divulgar Amazon no WhatsApp como associado dá certo quando o link sai com a sua tag, o preview mostra a imagem do produto e o envio respeita uma cadência que não queima o número. A comissão varia por categoria — de 0% a 13% — e errar a tag é o jeito mais rápido de trabalhar de graça.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Entre no Amazon Associados, pegue sua tag de afiliado, gere o link do produto com essa tag e divulgue no WhatsApp com imagem, preço e texto próprio — controlando a frequência de envio.', 'A regra de ouro: confira sempre se a sua tag está no link antes de enviar. Sem a tag, a venda não gera comissão para você.'] },
      { h2: 'Quanto a Amazon paga de comissão por categoria', paragraphs: ['A comissão da Amazon Associados não é fixa — varia por categoria de produto, de 0% (categoria Coach) a 13% (bebê, beleza, saúde e alimentos).'], table: { headers: ['Categoria', 'Comissão'], rows: [['Bebê, Beleza, Beleza de Luxo, Saúde e Cuidados Pessoais, Bebidas Alcoólicas, Alimentos e Bebidas, Audiolivros', '13%'], ['Roupas, Pet Shop', '11%'], ['Livros, Livros Digitais', '10%'], ['Dispositivos Amazon (Echo, Fire TV, Kindle)', '9,5%'], ['Aventura e Lazer, Esportes, Brinquedos e Jogos, Móveis, Casa, Construção, Ferramentas, Cozinha, Jardim e Piscina, Eletrodomésticos', '8%'], ['Câmeras e Foto, Eletrônicos, Informática, Instrumentos Musicais, Papelaria, Celulares, Games e Consoles, TV e Áudio', '8%'], ['Bolsas, Malas e Mochilas, Calçados, Jóias, Relógios', '7%'], ['CD e Vinil, DVD e Blu-ray, Automotivo, Produtos Industriais e Científicos', '7%'], ['Outras categorias', '7%'], ['Coach', '0%']], note: 'Fonte: programa Amazon Associados, tabela de comissão padrão fixa (consultado em 30/07/2026). A Amazon também paga recompensas fixas por assinatura de Prime, Prime Video, Kindle Unlimited e Amazon Music — valores sujeitos a alteração sem aviso prévio.' } },
      { h2: 'O que cuidar nos links da Amazon', bullets: ['Garantir que a tag de associado está presente no link.', 'Usar link curto quando possível, sem perder a tag.', 'Conferir se o preview mostra imagem em boa resolução.', 'Evitar links com parâmetros que quebram o rastreamento.', 'Atualizar a oferta se o preço mudar.'] },
      { h2: 'Cadência e preservação do número', paragraphs: ['A Amazon costuma ter muitas ofertas, e a tentação é mandar tudo de uma vez. Resista: poucas ofertas selecionadas por vez, com variação de texto, performam melhor e protegem o número.', 'Use chip dedicado e horário de silêncio para a operação não parecer um robô disparando.'] },
      { h2: 'Como o BOTinho cuida da Amazon', paragraphs: ['Com a sua tag de associado cadastrada, o BOTinho converte os links da Amazon automaticamente, busca a imagem em alta resolução para o preview do WhatsApp e distribui a oferta para seus grupos e canais com cadência responsável.', 'Isso evita o erro clássico de enviar um link sem tag e garante que a oferta chegue com cara profissional.'] },
    ],
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Shopee, Amazon ou Mercado Livre: qual programa escolher', note: 'comparativo de comissão e prazo de atribuição dos três' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: '3% na venda padrão, até 30% na Comissão Extra' },
      { href: '/bot-afiliados-whatsapp', label: 'Converter os links de afiliado automaticamente', note: 'para a tag nunca cair no caminho' },
    ],
    faq: [
      { q: 'Como sei se o link tem minha tag?', a: 'O link de afiliado da Amazon inclui um parâmetro de tag (tag=seucodigo). Sem ela, a venda não é atribuída a você. Uma ferramenta de conversão garante isso automaticamente.' },
      { q: 'Qual categoria da Amazon paga mais comissão?', a: 'Bebê, Beleza, Saúde e Cuidados Pessoais, Bebidas Alcoólicas e Alimentos pagam 13%, a maior faixa da tabela padrão. A categoria Coach não paga comissão (0%).' },
      { q: 'Por que a imagem do produto importa?', a: 'O preview com imagem em boa resolução aumenta o clique. O BOTinho busca a imagem em alta para o link preview do WhatsApp.' },
      { q: 'Posso agendar as ofertas da Amazon?', a: 'Sim. Distribuir ao longo do dia, com cadência controlada, costuma converter melhor do que despejar tudo de uma vez e ainda protege o número.' },
    ],
  },
  'como-divulgar-ofertas-mercado-livre-whatsapp': {
    slug: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp',
    title: 'Afiliado Mercado Livre: comissão por categoria e como divulgar no WhatsApp',
    description: 'Quanto o Mercado Livre paga de comissão de afiliado por categoria (venda direta e indireta), o prazo de pagamento e como divulgar as ofertas no WhatsApp sem perder a atribuição do link.',
    eyebrow: 'Afiliado Mercado Livre · Guia completo',
    usePersonAuthor: true,
    origin: 'blog_como_divulgar_ofertas_mercado_livre_whatsapp',
    leadMagnetVariant: 'afiliados',
    intro: 'O Mercado Livre Afiliados paga de 0% a 16% de comissão, dependendo da categoria do produto e de a venda ser direta ou indireta. A entrada é gratuita. Para divulgar no WhatsApp você precisa do link com o seu identificador, um preview com imagem e cadência que não pareça disparo — encaminhar o link do grupo de origem credita a comissão para o concorrente.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Gere seu link de afiliado no programa do Mercado Livre (Mercado Livre Afiliados), confirme que o link carrega o seu identificador, monte a oferta com título, preço e imagem e distribua nos grupos e canais com intervalo entre envios.', 'O ponto crítico é a atribuição: o link precisa ser o SEU, não o do grupo de onde a oferta veio. Quando o BOTinho espelha, ele converte o link para o seu código automaticamente antes de enviar.'] },
      { h2: 'Quanto o Mercado Livre paga de comissão por categoria', paragraphs: ['A tabela abaixo é a do Percentual de Pagamentos dos Resultados aplicável a Afiliados generalistas. O Mercado Livre separa venda direta (o produto que você divulgou) de venda indireta, com percentual menor.'], table: { headers: ['Categoria', 'Venda direta', 'Venda indireta'], rows: [['Beleza e Cuidado Pessoal; Calçados, Roupas e Bolsas; Esportes e Fitness', '16%', '8%'], ['Acessórios para Veículos; Bebês; Brinquedos e Hobbies; Casa, Móveis e Decoração; Construção; Ferramentas; Games; Joias e Relógios; Livros, Revistas e Comics; demais categorias', '12%', '6%'], ['Câmeras e Acessórios; Celulares e Telefones; Eletrodomésticos; Eletrônicos, Áudio e Vídeo; Informática', '5%', '2,5%'], ['Alimentos e Bebidas', '0%', '0%']], note: 'Fonte: Mercado Livre, Central de Ajuda do Programa de Afiliados (consultado em 31/07/2026). Percentuais sujeitos a alteração pelo Mercado Livre — confirme na sua conta antes de decidir.' } },
      { h2: 'Atenção: quem divulga ofertas tem tabela própria', paragraphs: ['A tabela acima vale para Afiliados generalistas. O próprio Mercado Livre avisa que os afiliados enquadrados na categoria de Afiliados Divulgadores de Ofertas, conforme definição nos termos e condições do programa, recebem uma tabela de percentuais diferente — enviada para o e-mail cadastrado no Programa, e não publicada na Central de Ajuda.', 'Isso importa muito para quem opera grupo de achadinhos ou de promoções: é provável que você se enquadre nessa categoria. Antes de planejar receita em cima dos 16%, confirme no e-mail cadastrado qual é a sua tabela.'] },
      { h2: 'Comissão de cupom personalizado', paragraphs: ['Para cupons personalizados, o percentual é calculado sobre o valor final da transação válida e segue uma tabela separada, bem menor que a de produto.'], table: { headers: ['Tipo de produto', 'Percentual'], rows: [['Todas as categorias, exceto as da linha abaixo', '3%'], ['Roupas e calçados; Bolsas e acessórios; Esportes e fitness', '5%']], note: 'Fonte: Mercado Livre, Central de Ajuda do Programa de Afiliados (consultado em 31/07/2026).' } },
      { h2: 'Quando a comissão cai na conta', paragraphs: ['O pagamento só é efetuado após a confirmação de uma Transação Válida, o que pode levar até 60 dias contados a partir da data de entrega do produto.', 'Na prática, isso significa que a venda de hoje pode demorar cerca de dois meses para virar dinheiro disponível. Planeje o caixa da operação considerando esse intervalo, principalmente se você divulga muito produto de entrega longa.'] },
      { h2: 'Como funciona a conversão de link do Mercado Livre', bullets: ['Links de produto (com MLB) são convertidos para o seu código de afiliado.', 'Links de recomendação e landing (/up/, /social/) são resolvidos para a URL canônica do produto.', 'Short links são resolvidos antes da conversão para não perder o produto no meio da cadeia.', 'Se a conversão falhar, o link original de terceiro nunca é encaminhado — a comissão do concorrente não vaza.'] },
      { h2: 'Por que o preview com imagem importa', paragraphs: ['No WhatsApp, o card clicável com foto do produto em boa resolução converte muito mais que um link seco. O BOTinho monta o preview com a imagem em alta e o nome da loja acima do domínio, mantendo o card sempre renderizado.', 'Sem imagem, a oferta compete em desvantagem com todos os outros links do grupo. Com imagem, ela ocupa espaço visual e chama o olho.'] },
      { h2: 'Cadência que protege o número', paragraphs: ['Despejar 20 ofertas em sequência é o caminho mais rápido para o número entrar em risco. Distribua ao longo do dia, varie o texto e respeite horário de silêncio.', 'O Módulo de Preservação Avançada organiza essas camadas: limite por hora, variações de copy e pausas preventivas, para que a operação não pareça robótica.'] },
    ],
    relatedLinks: [
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
      { q: 'O BOTinho converte qualquer link do Mercado Livre?', a: 'Links de produto são convertidos para o seu código. Links de recomendação e landing são resolvidos para o produto canônico. Se não for possível converter com segurança, o link original não é encaminhado.' },
      { q: 'Cupom do Mercado Livre credita comissão?', a: 'Sim, com tabela própria: 3% na maioria das categorias e 5% em roupas e calçados, bolsas e acessórios, esportes e fitness — percentual calculado sobre o valor final da transação válida. Ainda assim, valide clicando no link em um celular antes de confiar na atribuição.' },
    ],
  },
  'quanto-custa-bot-para-whatsapp-afiliados': {
    slug: '/blog/quanto-custa-bot-para-whatsapp-afiliados',
    title: 'Quanto custa um bot para WhatsApp de afiliados? Preços e o que avaliar',
    description: 'Entenda quanto custa um bot para WhatsApp de afiliados, o que muda entre plano básico e avançado e como avaliar custo real além do preço da mensalidade.',
    eyebrow: 'Custo · Decisão de compra',
    origin: 'blog_quanto_custa_bot_para_whatsapp_afiliados',
    usePersonAuthor: true,
    intro: 'Um bot para WhatsApp de afiliados custa, na prática, entre R$39 e R$69 por mês nos planos do BOTinho, com 7 dias grátis para testar. Mas o preço da mensalidade é só parte da conta: o custo real inclui o tempo que você economiza no copia-e-cola e o risco que você reduz na operação.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['No BOTinho, o plano Basic é R$39 por 30 dias (operação manual de ofertas em grupos) e o plano Pro é R$69 por 30 dias (canais, ofertas automáticas da Shopee, filas de envio e Módulo de Preservação Avançada). O teste grátis de 7 dias libera o fluxo Pro completo.', 'Não há promessa de faturamento, comissão ou entrega — a ferramenta organiza a distribuição, mas a revisão humana e o resultado dependem da sua operação.'] },
      { h2: 'O que muda entre básico e avançado', bullets: ['Basic: espelhamento de grupos, conversão de link (Mercado Livre, Amazon, Shopee, Magalu), conversão de cupom, criação de oferta por link, envio imediato e agendado, relatórios.', 'Pro: tudo do Basic + monitoramento e envio em Canais, ofertas automáticas da Shopee, filas com limite por hora e por dia, e Módulo de Preservação Avançada (cadência, horário de silêncio, variações e limites).'] },
      { h2: 'Custo real além da mensalidade', paragraphs: ['Some o tempo que você gasta hoje copiando e colando oferta por oferta em cada grupo. Se são duas horas por dia, o custo escondido da operação manual costuma superar em muito o valor de uma mensalidade.', 'Há também o custo de risco: mensagens idênticas em vários destinos e volume sem cadência aumentam a chance de perder o número. Reduzir esse risco tem valor mesmo que não apareça na fatura.'] },
      { h2: 'Como avaliar antes de pagar', paragraphs: ['Use o teste grátis para medir três coisas: quanto tempo você economiza, se a conversão de link mantém sua comissão e se a cadência deixa a operação mais estável. Só depois disso escolha o plano.'] },
    ],
    relatedTitle: 'Continue: quanto custa e quanto rende',
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Quanto cada programa de afiliados paga', note: 'o outro lado da conta: a comissão real' },
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
    title: 'Melhores horários para postar ofertas no WhatsApp (guia prático)',
    description: 'Descubra os melhores horários para postar ofertas no WhatsApp, por que a cadência importa mais que o horário exato e como distribuir envios sem parecer disparo.',
    eyebrow: 'Cadência · Rotina de postagem',
    origin: 'blog_melhores_horarios_para_postar_ofertas_no_whatsapp',
    usePersonAuthor: true,
    intro: 'Os melhores horários para postar ofertas no WhatsApp costumam ser início da manhã (7h–9h), horário de almoço (11h30–13h30) e início da noite (18h–21h), quando as pessoas checam o celular. Mas o horário exato importa menos do que a consistência e a distribuição: postar tudo de uma vez, mesmo no melhor horário, converte pior e expõe o número.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Concentre as ofertas mais fortes em três janelas: manhã (7h–9h), almoço (11h30–13h30) e noite (18h–21h). Evite a madrugada. Distribua as ofertas ao longo dessas janelas em vez de despejar tudo de uma vez.', 'O comportamento do seu público específico manda mais que qualquer regra geral — por isso vale acompanhar cliques por horário e ajustar.'] },
      { h2: 'Janelas que costumam funcionar', bullets: ['Manhã (7h–9h): quem checa o celular antes do trabalho.', 'Almoço (11h30–13h30): pausa e navegação livre.', 'Noite (18h–21h): maior tempo de tela e decisão de compra.', 'Fins de semana: manhãs e fim de tarde tendem a render bem para achadinhos.'] },
      { h2: 'Por que cadência importa mais que horário', paragraphs: ['Acertar o horário e mandar 15 ofertas seguidas anula o ganho: o público satura e o número fica exposto a padrão de disparo. O que sustenta resultado é frequência distribuída com intervalo entre envios.', 'Postar de forma consistente todos os dias, em horários parecidos, também treina o público a esperar suas ofertas — isso vale mais que um único horário mágico.'] },
      { h2: 'Como o BOTinho ajuda a manter o ritmo', paragraphs: ['Com agendamento e filas com limite por hora e por dia, você programa as ofertas nas janelas certas sem ficar preso ao celular. O Módulo de Preservação Avançada acrescenta horário de silêncio e variações de texto para evitar comportamento robótico.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
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
    title: 'Como converter link de afiliado automaticamente no WhatsApp',
    description: 'Entenda como converter link de afiliado automaticamente no WhatsApp para Shopee, Amazon, Mercado Livre e Magalu, sem perder comissão nem encaminhar link de terceiro.',
    eyebrow: 'Conversão de link · Automação',
    origin: 'blog_como_converter_link_de_afiliado_automaticamente_whatsapp',
    usePersonAuthor: true,
    intro: 'Converter link de afiliado automaticamente significa trocar, na hora do envio, qualquer link de produto ou cupom pelo seu próprio link de afiliado — sem copiar, colar e gerar link manualmente para cada oferta. É isso que impede que a comissão do concorrente vaze quando você espelha ofertas de outros grupos.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Uma ferramenta de conversão automática recebe o link original, identifica a loja, resolve short links e páginas de recomendação, e gera o link com o SEU código de afiliado antes de a mensagem sair. Se não conseguir converter com segurança, ela não encaminha o link de terceiro.', 'O BOTinho faz isso para Mercado Livre, Amazon, Shopee e Magalu, incluindo links de cupom e voucher, não só de produto.'] },
      { h2: 'O que acontece com cada loja', bullets: ['Amazon: adiciona a sua tag de associado na URL da loja.', 'Shopee: resolve o short link, preserva o cupom e devolve o link de afiliado que abre direto o app.', 'Mercado Livre: converte links de produto (MLB) e resolve landings de recomendação para o produto canônico.', 'Magalu: aplica o seu partner_id em qualquer URL, inclusive campanhas.'] },
      { h2: 'Por que cupom também precisa ser convertido', paragraphs: ['Muitas ofertas só fecham o preço anunciado com o cupom. Encaminhar o cupom original credita a comissão para o afiliado de origem; removê-lo quebra a oferta. A conversão de cupom resolve isso mantendo a identidade do cupom e trocando a atribuição para você.', 'A regra de ouro é: o link original de terceiro nunca é encaminhado. Se a conversão falhar, o sistema cai em um tratamento seguro em vez de vazar comissão.'] },
      { h2: 'Conferir antes de confiar', paragraphs: ['Automatizar não elimina a revisão. Antes de escalar, clique no link convertido em um celular e confirme que ele carrega o seu código e leva ao produto certo. Depois disso, a conversão automática economiza horas por dia.'] },
    ],
    relatedTitle: 'Continue no cluster de afiliados',
    relatedLinks: [
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'onde ficam suas credenciais de afiliada' },
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
    title: 'Como combinar Amazon, Shopee e Mercado Livre no mesmo grupo de ofertas',
    description: 'Estratégia para operar os três programas de afiliados ao mesmo tempo no WhatsApp: qual loja usar para cada tipo de oferta, como não misturar os códigos e como medir qual rende mais no seu público.',
    eyebrow: 'Estratégia · Operar os três programas',
    origin: 'blog_amazon_shopee_ou_mercado_livre_para_afiliados_whatsapp',
    leadMagnetVariant: 'afiliados',
    usePersonAuthor: true,
    intro: 'Não existe um único programa vencedor: Amazon é forte em variedade e confiança, Shopee é forte em achadinhos baratos e cupom, e Mercado Livre é forte em ticket médio e frete. Para quem divulga no WhatsApp, a estratégia madura combina os três, escolhendo o programa por tipo de oferta. Se você ainda está decidindo por onde começar, veja antes o comparativo de comissão dos três programas.',
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Comparativo de comissão dos três programas', note: 'quanto cada um paga e prazo de atribuição' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: guia de cadastro', note: 'o programa com maior volume de busca' },
      { href: '/blog/como-divulgar-ofertas-amazon-whatsapp', label: 'Afiliado Amazon: comissão por categoria', note: 'de 0% a 13% conforme o produto' },
    ],
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use Shopee para achadinhos de baixo preço e campanhas de cupom, Amazon para variedade e produtos de marca com boa taxa de clique, e Mercado Livre para ticket médio maior e itens com frete competitivo.', 'O que decide a comissão real é a atribuição correta do link e a taxa de conversão do seu público, não só o percentual do programa.'] },
      { h2: 'Como cada programa se comporta no WhatsApp', bullets: ['Shopee: cupom e voucher fazem parte da oferta; a conversão precisa preservar o cupom e usar short link que abre o app.', 'Amazon: a tag de associado precisa estar na URL da loja; preview com imagem em alta ajuda muito no clique.', 'Mercado Livre: links de produto (MLB) convertem direto; landings de recomendação precisam ser resolvidas para o produto.'] },
      { h2: 'Por que combinar os três', paragraphs: ['Depender de um só programa limita seu catálogo de ofertas e te deixa refém de mudanças de regra de um único parceiro. Rodar os três amplia a variedade e deixa você escolher sempre a melhor oferta do dia por categoria.', 'O desafio operacional de rodar três programas é justamente a conversão de link — cada loja tem um mecanismo diferente. Uma ferramenta que converte todos automaticamente elimina esse atrito.'] },
      { h2: 'O papel do BOTinho', paragraphs: ['O BOTinho converte links de Amazon, Shopee, Mercado Livre e Magalu (incluindo cupons) para o seu código, monta o preview com imagem e distribui com cadência. Assim você opera os três programas no mesmo fluxo, sem gerar link manualmente para cada oferta.'] },
    ],
    faq: [
      { q: 'Qual paga mais comissão?', a: 'O percentual varia por categoria e por programa e muda com o tempo. Na prática, a comissão real depende mais da atribuição correta do link e da conversão do seu público do que do percentual nominal.' },
      { q: 'Posso divulgar os três ao mesmo tempo?', a: 'Sim, e é o mais recomendado. Cada programa é forte em um tipo de oferta. O desafio é converter o link de cada loja corretamente — o que uma ferramenta de conversão automática resolve.' },
      { q: 'Preciso de contas separadas?', a: 'Sim. Você se inscreve em cada programa de afiliados separadamente e gera um link com o seu identificador em cada um deles.' },
    ],
  },
  'como-montar-grupo-de-ofertas-no-whatsapp-do-zero': {
    slug: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero',
    title: 'Como montar um grupo de ofertas no WhatsApp do zero',
    description: 'Guia para montar um grupo de ofertas no WhatsApp do zero: chip dedicado, primeiras fontes de oferta, conversão de link, cadência e quando migrar para canal.',
    eyebrow: 'Começando · Grupo de ofertas',
    origin: 'blog_como_montar_grupo_de_ofertas_no_whatsapp_do_zero',
    intro: 'Montar um grupo de ofertas no WhatsApp do zero é menos sobre audiência grande e mais sobre processo: chip dedicado, boas fontes de oferta, link com a sua comissão e uma rotina de postagem consistente. Quem começa com processo cresce com estabilidade; quem começa no improviso perde o número.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use um chip dedicado (nunca o número pessoal), defina o nicho do grupo, encontre boas fontes de oferta, converta cada link para o seu código de afiliado e poste com cadência consistente. Só depois pense em escalar para mais grupos ou canais.', 'Não precisa de audiência grande para começar — precisa de constância e de ofertas realmente boas para o seu público.'] },
      { h2: 'Passo a passo inicial', bullets: ['Ative um chip dedicado para a operação de ofertas.', 'Escolha um nicho claro (achadinhos, eletrônicos, casa, moda, etc.).', 'Inscreva-se nos programas de afiliados (Amazon, Shopee, Mercado Livre, Magalu).', 'Defina 2 a 3 janelas de postagem por dia.', 'Converta todo link para o seu código antes de divulgar.'] },
      { h2: 'Erros que travam quem começa', paragraphs: ['Os mais comuns: usar o número pessoal, encaminhar link de terceiro (perdendo comissão), postar em rajada e abandonar o grupo por falta de rotina. Todos são de processo, não de audiência.', 'Outro erro é não medir. Sem acompanhar cliques e envios, você não sabe qual oferta e qual horário funcionam.'] },
      { h2: 'Quando escalar e migrar para canal', paragraphs: ['Quando a rotina estiver estável e o grupo engajado, o próximo passo costuma ser adicionar um Canal do WhatsApp como vitrine e espelhar as ofertas selecionadas do grupo para o canal.', 'É aqui que o BOTinho entra: espelha entre grupos e canais, converte os links, mantém cadência e monitora a saúde da operação — para você crescer sem multiplicar o copia-e-cola.'] },
    ],
    relatedTitle: 'Continue: o que publicar no grupo novo',
    relatedLinks: [
      { href: '/programa-de-afiliados', label: 'Qual programa de afiliados escolher', note: 'comissão de Shopee, Amazon e Mercado Livre' },
      { href: '/blog/como-ser-afiliado-shopee-whatsapp', label: 'Shopee Afiliados: como se cadastrar e quanto paga', note: 'cadastro gratuito, sem exigir audiência grande' },
      { href: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', label: 'Melhores horários para postar ofertas', note: 'quando o grupo responde mais' },
    ],
    faq: [
      { q: 'Preciso de muita gente para começar?', a: 'Não. Constância e ofertas boas importam mais que tamanho no início. Audiência cresce com rotina consistente e curadoria.' },
      { q: 'Posso usar meu número pessoal?', a: 'Não é recomendado. Use um chip dedicado para separar a operação comercial do número pessoal e reduzir o risco de perder contatos importantes.' },
      { q: 'Quando devo criar um canal?', a: 'Quando a rotina estiver estável e o grupo engajado. O canal funciona como vitrine organizada; o grupo continua útil para comunidade e feedback.' },
    ],
  },
}

export function getPreservationBlogMetadata(postKey) {
  const post = PRESERVATION_BLOG_POSTS[postKey]
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: post.slug },
    openGraph: { title: post.title, description: post.description, url: `${siteUrl}${post.slug}`, type: 'article', locale: 'pt_BR' },
  }
}

export function PreservationBlogPost({ postKey }) {
  const post = PRESERVATION_BLOG_POSTS[postKey]
  const dates = getEditorialDates(post.slug)
  const personAuthor = post.usePersonAuthor ? { type: 'Person', name: EDITORIAL_PERSON_AUTHOR, description: EDITORIAL_PERSON_AUTHOR_DESCRIPTION } : undefined
  const schemas = buildArticleJsonLd({ title: post.title, description: post.description, slug: post.slug, siteUrl, faq: post.faq, author: personAuthor })

  return (
    <>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleShell eyebrow={post.eyebrow} title={post.title} description={post.description} origin={post.origin} publishedAt={dates.publishedAt} updatedAt={dates.updatedAt} author={post.usePersonAuthor ? EDITORIAL_PERSON_AUTHOR : undefined} leadMagnetVariant={post.leadMagnetVariant ?? 'default'}>
        <section>
          <h2>Resumo prático</h2>
          <p>{post.intro}</p>
        </section>

        {post.sections.map((section) => (
          <section key={section.h2}>
            <h2>{section.h2}</h2>
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
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
        ))}

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
            Se você quer aplicar esse processo na prática, comece pela página de Canais + Preservação e veja como o BOTinho conecta grupos, canais, cadência e monitoramento em uma operação única.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-black text-white no-underline hover:bg-emerald-700"
              href="/diagnostico-antiban-whatsapp?utm_source=blog&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=article_diagnostic_cta"
              data-seo-cta="blog_diagnostic"
              data-cta-position="article_next_step_primary"
              data-cta-stage="diagnostic"
              data-cta-destination="diagnostic"
            >
              Fazer diagnóstico de preservação
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/materiais/checklist-antiban-whatsapp?utm_source=blog&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=article_checklist_cta"
              data-seo-cta="blog_checklist"
              data-cta-position="article_next_step_secondary"
              data-cta-stage="lead_magnet"
              data-cta-destination="checklist"
            >
              Ver checklist de preservação
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/ferramentas/calculadora-risco-whatsapp?utm_source=blog&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=article_risk_calculator_cta"
              data-seo-cta="blog_risk_calculator"
              data-cta-position="article_next_step_tool"
              data-cta-stage="tool"
              data-cta-destination="calculator"
            >
              Calcular risco operacional
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/bot-canais-whatsapp?utm_source=blog&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=article_landing_cta"
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
