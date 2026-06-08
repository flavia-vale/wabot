import Link from 'next/link'
import { ArticleShell } from '@/components/marketing/ArticleShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates } from '@/lib/editorial-content'

const siteUrl = getSiteUrl()

export const PRESERVATION_BLOG_POSTS = {
  'grupo-ou-canal-whatsapp-achadinhos': {
    slug: '/blog/grupo-ou-canal-whatsapp-achadinhos',
    title: 'Grupo ou Canal do WhatsApp: qual é melhor para achadinhos?',
    description: 'Entenda quando usar grupo, quando usar Canal do WhatsApp e como combinar os dois para divulgar achadinhos com mais organização e preservação operacional.',
    eyebrow: 'Canais · Estratégia de migração',
    origin: 'blog_grupo_ou_canal_whatsapp_achadinhos',
    intro: 'A resposta curta: grupo é melhor para conversa e comunidade; canal é melhor para vitrine organizada. Para afiliados de achadinhos, a operação mais madura costuma combinar os dois com papéis diferentes.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Use grupos quando você precisa de conversa, feedback e senso de comunidade. Use Canais do WhatsApp quando a prioridade é publicar ofertas em formato de vitrine, com menos ruído e mais previsibilidade de leitura.', 'O erro é tratar grupo e canal como concorrentes. Em uma operação de achadinhos, o grupo pode continuar como fonte ou comunidade, enquanto o canal vira destino principal das ofertas selecionadas.'] },
      { h2: 'Quando o grupo faz sentido', bullets: ['Comunidade que comenta e pede indicação.', 'Curadoria colaborativa de achadinhos.', 'Relacionamento com seguidores mais próximos.', 'Testes rápidos de oferta e feedback.'] },
      { h2: 'Quando o canal faz sentido', bullets: ['Publicação de ofertas em vitrine limpa.', 'Menos ruído de conversa entre membros.', 'Organização por nicho, frequência e calendário.', 'Distribuição mais clara para quem quer só receber oportunidades.'] },
      { h2: 'O modelo recomendado', paragraphs: ['Comece mapeando quais grupos geram boas ofertas, quais grupos têm audiência engajada e quais canais podem funcionar como vitrine. Depois, defina regras de espelhamento para que cada destino receba a oferta no ritmo certo.', 'O BOTinho entra como camada operacional: espelha de grupo para canal, de canal para grupo e entre canais, mantendo cadência, variações e monitoramento dentro do Módulo de Preservação Avançada.'] },
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
    intro: 'Não existe garantia contra banimento. O que existe é uma operação menos robótica, com chip dedicado, volume controlado, variações, monitoramento e plano de recuperação.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Para reduzir risco, pare de operar como disparo: use chip dedicado, limite frequência, evite madrugada, varie texto, distribua ofertas em horários diferentes e monitore sinais de saúde por canal.', 'O Módulo de Preservação Avançada do BOTinho existe para organizar essas camadas. O termo “anti-ban” aparece em buscas, mas não deve ser tratado como promessa absoluta.'] },
      { h2: 'Checklist mínimo de preservação', bullets: ['Usar chip dedicado, nunca número pessoal.', 'Definir limite por hora e por dia.', 'Ativar horário de silêncio.', 'Evitar mensagens idênticas em todos os destinos.', 'Ter plano de recuperação para canal e chip.'] },
      { h2: 'O que aumenta risco', paragraphs: ['Publicar muitas ofertas em sequência, repetir o mesmo texto em vários destinos e depender de um único grupo ou chip aumenta a fragilidade da operação.', 'Outro ponto crítico é não perceber queda de entrega. Quando os cliques caem e ninguém monitora, o afiliado só descobre tarde demais que o canal perdeu força.'] },
      { h2: 'Como o BOTinho organiza o processo', paragraphs: ['O BOTinho combina cadência, variações, espelhamento entre grupos e canais, monitoramento e pausas preventivas. A ferramenta não controla decisões da plataforma, mas ajuda o afiliado a evitar comportamento de operação improvisada.'] },
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
    intro: 'O problema do shadowban é que ele raramente aparece como um aviso claro. O afiliado percebe quando os cliques somem, as ofertas param de performar e o canal já perdeu força.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Você deve monitorar queda brusca de cliques, atraso de entrega, erros recorrentes, sumiço de visualizações e divergência entre publicação e recebimento por uma conta-sentinela.', 'Nenhum sinal isolado prova shadowban. Mas um conjunto de sinais deve acionar redução de cadência e revisão da operação.'] },
      { h2: 'Sinais que merecem atenção', bullets: ['Cliques caem sem mudança de oferta ou horário.', 'Seguidores relatam que não viram publicações.', 'Mensagens demoram mais para aparecer.', 'Canais parecidos performam bem, mas um canal específico despenca.', 'Erros técnicos começam a se repetir.'] },
      { h2: 'Conta-sentinela: por que ela importa', paragraphs: ['Uma conta-sentinela é um número secundário que segue seus canais e confirma se as mensagens aparecem como deveriam. Ela ajuda a detectar diferença entre “post publicado” e “post realmente visto”.'] },
      { h2: 'O que fazer quando o risco sobe', paragraphs: ['Reduza frequência, pause publicações no canal afetado, revise variações e confira se houve mudança de comportamento recente. Se o canal continuar em risco, prepare plano de recuperação antes que a audiência fique inacessível.'] },
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
    intro: 'A migração não deve ser um corte brusco. O caminho mais seguro é transformar o canal em vitrine, manter o grupo como apoio e usar espelhamento com cadência controlada.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Crie o canal, anuncie a mudança no grupo, publique ofertas em paralelo por alguns dias, acompanhe cliques e só depois reduza a dependência do grupo.', 'Com o BOTinho, você pode espelhar ofertas entre grupo e canal enquanto testa cadência, formato e aceitação da audiência.'] },
      { h2: 'Passo a passo recomendado', bullets: ['Faça inventário dos grupos, canais e fontes atuais.', 'Crie o canal com nome claro e descrição fiel ao conteúdo.', 'Avise o grupo com CTA simples para seguir o canal.', 'Publique em paralelo antes de cortar qualquer fluxo.', 'Monitore cliques, visualizações e reclamações.'] },
      { h2: 'Como evitar uma migração confusa', paragraphs: ['Não mude tudo de uma vez. Se você troca formato, frequência e copy no mesmo dia, fica impossível saber o que afetou o resultado. Preserve um padrão por vez e compare dados.'] },
      { h2: 'Onde entra o Módulo de Preservação Avançada', paragraphs: ['Ele organiza limites, variações, pausa e monitoramento para que o novo canal não nasça com comportamento mecânico. O canal deve parecer administrado por uma pessoa, não por um disparador.'] },
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
    intro: 'Se o WhatsApp gera receita, o chip virou ativo operacional. Usar o número pessoal para rodar bot, grupos e canais mistura risco comercial com vida pessoal.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Afiliados devem usar chip dedicado porque o número que publica, segue canais e administra rotina de ofertas é parte da infraestrutura do negócio.', 'Se esse número cair, travar ou precisar ser substituído, o impacto deve ficar isolado da sua vida pessoal e do seu atendimento principal.'] },
      { h2: 'Riscos de usar número pessoal', bullets: ['Perder acesso a conversas pessoais em caso de bloqueio.', 'Misturar rotina comercial e vida privada.', 'Dificultar recuperação da operação.', 'Não conseguir separar testes, canais e alertas.', 'Aumentar ansiedade operacional a cada instabilidade.'] },
      { h2: 'Como tratar chip como ativo', paragraphs: ['Registre quem usa o chip, onde ele está conectado, quais canais administra e quais rotinas dependem dele. Tenha backup de configurações, lista de canais e processo de substituição.'] },
      { h2: 'Papel do BOTinho', paragraphs: ['O BOTinho não elimina risco do chip, mas ajuda a operar com cadência, monitoramento, pausas e plano de recuperação. Isso torna o chip parte de um processo, não um ponto único de improviso.'] },
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
    intro: 'A resposta honesta é: bot “anti-ban” absoluto não existe. O que existe é preservação avançada, uma combinação de decisões operacionais para reduzir risco e recuperar mais rápido.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Nenhum bot controla decisões da plataforma. Portanto, qualquer promessa de “anti-ban 100%” deve ser tratada como exagero comercial.', 'O BOTinho usa Módulo de Preservação Avançada: ritmo humano, variações, monitoramento, pausa preventiva, chip dedicado e plano de recuperação.'] },
      { h2: 'Por que o termo “anti-ban” aparece', paragraphs: ['Afiliados pesquisam por “anti-ban” porque sentem medo real de perder chip, canal e audiência. Usar o termo ajuda a responder a busca, mas a comunicação precisa deixar claro que não é garantia absoluta.'] },
      { h2: 'O que é preservação avançada', bullets: ['Cadência por destino.', 'Limites por hora e dia.', 'Horário de silêncio.', 'Variações de copy e ordem da oferta.', 'Monitoramento de saúde e cliques.', 'Pausa preventiva quando o risco aumenta.', 'Plano de recuperação para canal e chip.'] },
      { h2: 'Como avaliar uma ferramenta', paragraphs: ['Desconfie de ferramenta que só promete “não banir”. Prefira produto que explica limites, recomenda chip dedicado, fala de uso responsável e mostra quais camadas realmente controla.'] },
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
    intro: 'Você não precisa de um grupo gigante para começar a ganhar comissão no WhatsApp. Precisa de um chip dedicado, links de afiliado convertidos certo e uma rotina de envio que não pareça spam. O resto cresce com consistência.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Comece pequeno e organizado: separe um chip só para a operação, cadastre seus IDs de afiliada (Mercado Livre, Amazon, Shopee), monte 1 ou 2 grupos/canais de destino e publique poucas ofertas boas por dia com texto que pareça você falando.', 'Grupo grande é consequência, não pré-requisito. Quem começa focando em volume costuma queimar o número antes de ter audiência.'] },
      { h2: 'O que você precisa no dia 1', bullets: ['Um chip dedicado (nunca o número pessoal).', 'Contas de afiliado nas plataformas que você vai divulgar.', 'Um grupo ou canal de destino, mesmo que pequeno.', 'Uma fonte de ofertas (grupos que você acompanha, sites, encartes).', 'Uma ferramenta que converte o link e mantém cadência.'] },
      { h2: 'O erro mais comum de quem começa', paragraphs: ['O iniciante cola o link cru, sem converter para afiliado — e perde a comissão da venda que ele mesmo gerou. O segundo erro é despejar 30 ofertas seguidas no mesmo dia, o que parece spam e arrisca o número.', 'A correção é simples: converta todo link antes de enviar e limite a frequência. Poucas ofertas boas convertem mais do que muitas ofertas repetidas.'] },
      { h2: 'Como o BOTinho ajuda quem está começando', paragraphs: ['O BOTinho converte automaticamente os links de Mercado Livre, Amazon e Shopee para o seu código de afiliada antes de enviar, espelha as ofertas dos grupos que você acompanha para os seus destinos e mantém uma cadência responsável para reduzir risco no número.', 'Para quem está começando, isso elimina a parte chata (copiar, converter, reescrever, reenviar) e deixa você focar em escolher boas ofertas.'] },
    ],
    faq: [
      { q: 'Preciso de muitos seguidores para começar?', a: 'Não. Dá para começar com um grupo ou canal pequeno. O que importa no início é converter os links corretamente e manter consistência, não o tamanho da audiência.' },
      { q: 'Posso usar meu WhatsApp pessoal?', a: 'Não é recomendado. Use um chip dedicado para a operação, separando do seu número pessoal e reduzindo o risco de perder seus contatos se algo der errado.' },
      { q: 'O BOTinho converte os links sozinho?', a: 'Sim. Ele converte links suportados (Mercado Livre, Amazon, Shopee) para o seu código de afiliada antes do envio, então você não esquece de marcar a comissão.' },
    ],
  },
  'como-ser-afiliado-shopee-whatsapp': {
    slug: '/blog/como-ser-afiliado-shopee-whatsapp',
    title: 'Como ser afiliado Shopee e divulgar ofertas no WhatsApp',
    description: 'Passo a passo para se tornar afiliado Shopee, gerar seu link de afiliado e divulgar ofertas no WhatsApp com conversão automática e cadência responsável.',
    eyebrow: 'Afiliado Shopee · Primeiros passos',
    origin: 'blog_como_ser_afiliado_shopee_whatsapp',
    intro: 'Ser afiliado Shopee e divulgar no WhatsApp tem três etapas: entrar no programa de afiliados, gerar o link com o seu código e enviar as ofertas para grupos e canais sem parecer spam. A parte que mais trava o iniciante é manter o link sempre convertido.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Cadastre-se no Programa de Afiliados Shopee, pegue suas credenciais de afiliado, gere o link de cada produto com o seu código e divulgue no WhatsApp com texto próprio e frequência controlada.', 'O ponto crítico é garantir que TODO link enviado já esteja convertido para o seu código — senão a venda acontece, mas a comissão não cai para você.'] },
      { h2: 'Passo a passo para entrar', bullets: ['Cadastre-se no Programa de Afiliados Shopee.', 'Confirme seus dados e aguarde a aprovação.', 'Localize suas credenciais de afiliado (appId / secret).', 'Gere links com o seu código para os produtos que vai divulgar.', 'Organize seus grupos e canais de destino no WhatsApp.'] },
      { h2: 'Como divulgar sem queimar o número', paragraphs: ['Use um chip dedicado, publique poucas ofertas boas por vez, varie o texto e evite mandar a mesma mensagem idêntica para todos os destinos ao mesmo tempo.', 'Quem dispara dezenas de links iguais em sequência arrisca o número e ainda cansa a audiência. Cadência responsável vende mais no médio prazo.'] },
      { h2: 'Como o BOTinho automatiza a Shopee', paragraphs: ['Com as credenciais de afiliada Shopee cadastradas, o BOTinho converte os links para o seu código automaticamente antes de enviar, monta a oferta com título e preço e distribui para os seus grupos e canais com cadência controlada.', 'Assim você não precisa gerar link a link na mão nem corre o risco de enviar um link sem comissão.'] },
    ],
    faq: [
      { q: 'Ser afiliado Shopee é gratuito?', a: 'Sim, a entrada no programa de afiliados não tem custo. Você ganha comissão sobre as vendas geradas pelos seus links.' },
      { q: 'Preciso gerar cada link na mão?', a: 'Não, se usar uma ferramenta de conversão. Com as credenciais Shopee no BOTinho, os links são convertidos automaticamente para o seu código antes do envio.' },
      { q: 'Posso divulgar Shopee e outras lojas juntas?', a: 'Sim. É comum divulgar Shopee, Mercado Livre e Amazon na mesma operação. O importante é manter cada link com o código de afiliado correto.' },
    ],
  },
  'como-divulgar-ofertas-amazon-whatsapp': {
    slug: '/blog/como-divulgar-ofertas-amazon-whatsapp',
    title: 'Como divulgar ofertas da Amazon no WhatsApp como afiliado',
    description: 'Aprenda a divulgar ofertas da Amazon no WhatsApp como afiliado: tag de associado, link convertido, preview com imagem e cadência que protege seu número.',
    eyebrow: 'Afiliado Amazon · Divulgação',
    origin: 'blog_como_divulgar_ofertas_amazon_whatsapp',
    intro: 'Divulgar Amazon no WhatsApp dá certo quando o link sai com a sua tag de associado, o preview mostra a imagem do produto e o envio respeita uma cadência que não queima o número. Errar a tag é o jeito mais rápido de trabalhar de graça.',
    sections: [
      { h2: 'Resposta direta', paragraphs: ['Entre no Amazon Associados, pegue sua tag de afiliado, gere o link do produto com essa tag e divulgue no WhatsApp com imagem, preço e texto próprio — controlando a frequência de envio.', 'A regra de ouro: confira sempre se a sua tag está no link antes de enviar. Sem a tag, a venda não gera comissão para você.'] },
      { h2: 'O que cuidar nos links da Amazon', bullets: ['Garantir que a tag de associado está presente no link.', 'Usar link curto quando possível, sem perder a tag.', 'Conferir se o preview mostra imagem em boa resolução.', 'Evitar links com parâmetros que quebram o rastreamento.', 'Atualizar a oferta se o preço mudar.'] },
      { h2: 'Cadência e preservação do número', paragraphs: ['A Amazon costuma ter muitas ofertas, e a tentação é mandar tudo de uma vez. Resista: poucas ofertas selecionadas por vez, com variação de texto, performam melhor e protegem o número.', 'Use chip dedicado e horário de silêncio para a operação não parecer um robô disparando.'] },
      { h2: 'Como o BOTinho cuida da Amazon', paragraphs: ['Com a sua tag de associado cadastrada, o BOTinho converte os links da Amazon automaticamente, busca a imagem em alta resolução para o preview do WhatsApp e distribui a oferta para seus grupos e canais com cadência responsável.', 'Isso evita o erro clássico de enviar um link sem tag e garante que a oferta chegue com cara profissional.'] },
    ],
    faq: [
      { q: 'Como sei se o link tem minha tag?', a: 'O link de afiliado da Amazon inclui um parâmetro de tag (tag=seucodigo). Sem ela, a venda não é atribuída a você. Uma ferramenta de conversão garante isso automaticamente.' },
      { q: 'Por que a imagem do produto importa?', a: 'O preview com imagem em boa resolução aumenta o clique. O BOTinho busca a imagem em alta para o link preview do WhatsApp.' },
      { q: 'Posso agendar as ofertas da Amazon?', a: 'Sim. Distribuir ao longo do dia, com cadência controlada, costuma converter melhor do que despejar tudo de uma vez e ainda protege o número.' },
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
  const schemas = buildArticleJsonLd({ title: post.title, description: post.description, slug: post.slug, siteUrl, faq: post.faq })

  return (
    <>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleShell eyebrow={post.eyebrow} title={post.title} description={post.description} origin={post.origin} publishedAt={dates.publishedAt} updatedAt={dates.updatedAt}>
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
          </section>
        ))}

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
