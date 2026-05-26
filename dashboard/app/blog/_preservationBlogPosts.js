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
