# Auditoria de SEO programático do Wabot / BOTinho

Data da análise: 2026-05-15

## Escopo e protocolo de risco

Esta auditoria aplica a skill `programmatic-seo` ao projeto Wabot/BOTinho, com foco em páginas criadas em escala, conteúdo orgânico, arquitetura de indexação, dados proprietários, conversão e riscos de thin content.

Protocolo STRICT antes de qualquer implementação futura:

1. **Erros fatais:** qualquer geração de páginas deve passar por build, lint e validação de schema/rotas para evitar quebra de Next.js, JSON-LD inválido e loops de geração.
2. **Breaking changes:** mudanças em URLs, canonicals, sitemap, schema de banco, API pública ou props dos templates devem ser tratadas como breaking changes de aquisição orgânica.
3. **Efeito cascata:** `LP_CONFIG`, wrappers físicos de rotas, sitemap e scripts de validação precisam evoluir juntos; hoje eles já têm acoplamento manual.
4. **Isolamento de ambiente:** novas páginas e migrations devem ir primeiro para `develop`/staging; não alterar `.env`, bancos ou portas de produção durante experimentos SEO.
5. **Bloqueio:** se uma mudança puder remover URLs indexadas, trocar canonical em massa, mudar schema de banco ou tocar deploy/porta, bloquear execução e validar em staging antes.

## Resumo executivo

O projeto já tem uma base incomum para SEO programático: produto claro, páginas por cidade, páginas por dor, páginas por nicho, blog, materiais ricos, FAQ, schema e sitemap. Isso coloca o BOTinho acima de um site institucional simples.

A crítica central: o projeto já criou volume, mas ainda não tem uma **máquina de SEO programático governada por dados**. A configuração de páginas está espalhada em listas manuais, templates repetem blocos genéricos demais, faltam hubs fortes por cluster, falta validação consistente para todas as URLs, e quase nenhum dado operacional proprietário vira vantagem de busca.

Prioridade máxima: transformar as páginas atuais em um sistema com fonte única de verdade, conteúdo mais único por intenção, interligação por hub-and-spoke, métricas orgânicas rastreáveis e validação automática antes de cada deploy.

## Inventário observado

### Páginas e templates

- O template programático principal vive em `dashboard/app/_lpShared.js` e concentra `LP_CONFIG` com 36 landing pages: 15 de localização, 11 de nicho e 10 de dores operacionais.
- Cada landing page programática também tem um wrapper físico em `dashboard/app/<slug>/page.js`, apesar de existir uma rota dinâmica `dashboard/app/[slug]/page.js` que renderiza qualquer slug de `LP_CONFIG`.
- Há páginas orgânicas adicionais para blog, materiais e central de conteúdos.
- O sitemap lista home, rotas core, landing pages e conteúdos editoriais.

### Dados e conversão

- A aplicação tem dados transacionais e operacionais valiosos: usuários, grupos, credenciais por plataforma, mensagens agendadas e logs de mensagens.
- O tracking de analytics cobre eventos de produto e funil, mas ainda não cobre granularmente origem orgânica, slug, intenção, cluster ou CTA de cada página.
- A captura de lead via materiais existe e usa `source`, `utm_campaign` e atributos CRM no formulário, mas a arquitetura ainda não fecha o ciclo SEO → lead → trial → ativação por página.

## Pontos fortes atuais

1. **Produto com definição explícita:** a copy central evita promessas agressivas e define o BOTinho como software web para afiliados, curadores e admins de grupos.
2. **Arquitetura de App Router:** Next.js facilita metadata, static params, sitemap e páginas por template.
3. **Programmatic SEO já iniciado:** há clusters de localização, nicho e problema; isso é melhor do que depender só da home.
4. **Schema já presente:** home, landing pages e artigos usam JSON-LD de Organization, SoftwareApplication, FAQPage, HowTo ou Article.
5. **Conteúdo de meio de funil:** blog e checklists reduzem dependência de páginas puramente comerciais.
6. **Narrativa responsável:** várias páginas reconhecem limites do WhatsApp, revisão humana, permissão e cadência; isso reduz risco de claims frágeis.

## Problemas críticos

### P0 — Fonte única de verdade inexistente para rotas SEO

Hoje existem ao menos quatro lugares que precisam ser mantidos em sincronia: `LP_CONFIG`, wrappers físicos de rota, sitemap e script de validação. Isso aumenta risco de URL fora do sitemap, URL sem teste ou teste desatualizado.

Evidência: `LP_CONFIG` possui 36 slugs, mas `validate-lp-schema.mjs` valida apenas 30. Ficam fora da validação: `bot-ofertas-afiliados-whatsapp`, `bot-ofertas-autopecas-whatsapp`, `bot-ofertas-cursos-whatsapp`, `bot-ofertas-infoprodutos-whatsapp`, `bot-ofertas-pet-shop-whatsapp` e `bot-ofertas-turismo-whatsapp`.

Recomendação:

- Exportar um registry único com `slug`, `type`, `cluster`, `intent`, `priority`, `lastModified`, `indexable`, `template` e `schemaTypes`.
- Gerar `generateStaticParams`, wrappers opcionais, sitemap e validação a partir desse registry.
- Remover listas duplicadas sempre que possível.

### P0 — Validação de schema aparentemente desalinhada

O template programático emite `SoftwareApplication`, mas o script de validação procura `Product`. Isso cria falso negativo se o script for executado contra páginas atuais, ou falso senso de segurança se o script não fizer parte do CI.

Recomendação:

- Decidir o schema canônico: `SoftwareApplication` para software SaaS, com `offers`, `applicationCategory` e `operatingSystem`.
- Atualizar o validador para exigir `SoftwareApplication`, `FAQPage`, `HowTo` e, quando aplicável, `BreadcrumbList`.
- Validar que o JSON-LD renderizado contém `url`, `mainEntityOfPage`, `offers.priceCurrency` e canonical coerente.

### P0 — Conteúdo programático ainda depende demais de blocos genéricos

As páginas têm introdução, bullets e FAQ únicos, mas reutilizam o mesmo Hero, How, Features, Social, Pricing e FAQ global. Para Google e usuários, muitas páginas podem parecer variações leves de uma landing genérica.

Recomendação:

- Cada página deve ter no mínimo 3 blocos realmente únicos por tipo:
  - localização: mapa operacional por cidade, bairros/regiões sugeridos, horários de publicação, exemplos de campanhas regionais e riscos locais.
  - nicho: calendário comercial do nicho, plataformas comuns, copy por categoria, checklist de validação e objeções específicas.
  - dor: diagnóstico, sintomas, métrica de controle, playbook de correção, exemplo antes/depois.
- Mover o template de “landing comercial” para um template editorial-comercial híbrido: resposta direta, diagnóstico, framework, checklist, erros comuns, mini-casos, FAQ e CTA.

### P1 — Falta hub-and-spoke forte

Existem muitas páginas spoke, mas os hubs ainda não parecem suficientes para consolidar autoridade por cluster.

Recomendação de hubs:

- `/espelhar-grupos-whatsapp/` — hub de localizações e operação regional.
- `/bot-ofertas-whatsapp/` — hub de nichos.
- `/automacao-whatsapp-afiliados/` — hub de dores operacionais e afiliados.
- `/conteudos/` deve virar central editorial com filtros por estágio: diagnóstico, checklist, tutorial, comparação, material.

Cada hub deve linkar para spokes, e cada spoke deve linkar de volta para hub, páginas irmãs e próximo passo de conversão.

### P1 — Ausência de dados proprietários como moat de SEO

A skill programmatic-seo prioriza dados proprietários. O BOTinho tem potencial de dados reais: volume de mensagens, plataformas convertidas, falhas, horários, grupos, tipos de operação, eventos de funil. Hoje esses dados não viram páginas, benchmarks ou calculadoras.

Recomendação:

- Criar páginas com dados agregados e anônimos, sem expor usuário, grupo, telefone, texto de mensagem ou URL:
  - “benchmark de rotina de grupos de ofertas no WhatsApp”.
  - “tempo economizado ao espelhar grupos”.
  - “checklist de cadência por nicho”.
  - “erros comuns em links de afiliado por plataforma”.
- Começar manualmente com dados editoriais; evoluir para agregação real quando houver volume e governança.

### P1 — Mensuração orgânica incompleta

O tracking atual mede eventos de produto, mas não fecha a origem SEO por slug/cluster. Sem isso, o time pode publicar páginas sem saber quais geram trial, ativação, pagamento ou retenção.

Recomendação:

- Adicionar eventos seguros e sem PII: `organic_page_view`, `organic_cta_click`, `lead_magnet_started`, `lead_magnet_submitted`, `signup_started_from_seo`.
- Metadados permitidos: `slug`, `cluster`, `intent`, `template`, `cta`, `utm_campaign` e `landing_page_type`.
- Painel admin: leads/trials por slug, taxa de conversão por cluster, receita por cluster, páginas órfãs, páginas com zero leads.

### P2 — Sitemap e robots funcionam, mas precisam de governança editorial

O sitemap lista rotas importantes e define prioridade, mas usa arrays manuais e `DEFAULT_LAST_MODIFIED` global. Isso pode inflar recência artificial e esconder páginas antigas.

Recomendação:

- `lastModified` por página no registry.
- Não atualizar todas as páginas para a data corrente sem alteração real relevante.
- Separar sitemaps por tipo se a escala crescer: `sitemap-lp.xml`, `sitemap-blog.xml`, `sitemap-materials.xml`.
- Marcar como `noindex` páginas promocionais temporárias se não forem estratégia orgânica.

### P2 — Blog e materiais ainda são poucos para sustentar autoridade

O conteúdo editorial existe, mas o volume ainda é baixo para atacar todo o funil de afiliados, grupos, WhatsApp e links.

Recomendação:

- Criar 4 trilhas editoriais:
  1. afiliados e links: Shopee, Amazon, Mercado Livre, Magalu, tags, UTMs, conferência.
  2. operação em grupos: cadência, calendário, horários, segmentação, regras.
  3. monetização e conversão: cupom, copy, CTR, tracking, oferta vencida.
  4. risco e compliance: consentimento, anti-spam, bloqueios, revisão humana.
- Cada artigo deve alimentar uma landing page e um material capturável.

## Playbooks recomendados

### 1. Localizações — manter, mas enriquecer

Padrão atual: `espelhar-grupos-whatsapp-[cidade]`.

Melhorias:

- Criar hub nacional e páginas por cidade só onde houver intenção, população e capacidade de conteúdo único.
- Enriquecer cada cidade com:
  - setores fortes da cidade.
  - exemplos de grupos por região sem citar grupos reais.
  - melhores janelas de publicação como hipótese editorial.
  - riscos e boas práticas locais.
  - links para nichos relevantes.

Critério de expansão: não criar mais cidades até as 15 atuais terem conteúdo substancial e interlinking completo.

### 2. Nichos — maior potencial comercial

Padrão atual: `bot-ofertas-[nicho]-whatsapp`.

Melhorias:

- Priorizar nichos com compra recorrente e afiliados ativos: supermercado, farmácia, beleza, moda, pet, eletrônicos, cursos/infoprodutos.
- Criar campos por nicho: sazonalidade, plataformas comuns, prova de validação, copy segura, checklist de oferta, erro fatal e CTA contextual.
- Criar comparativos internos: “bot de ofertas para farmácia vs planilha/manual”.

### 3. Dores operacionais — melhor para intenção BOFU/MOFU

Padrão atual: automatizar, escalar, padronizar, rastrear, reduzir tempo.

Melhorias:

- Transformar cada página em diagnóstico prático com calculadora leve ou checklist.
- Adicionar tabelas de sintomas → causa → correção → recurso BOTinho.
- Capturar lead com material específico para a dor, não apenas checklist genérico.

### 4. Glossário e perguntas “o que é”

Criar páginas leves, mas úteis:

- `/glossario/espelhamento-de-grupos-whatsapp/`
- `/glossario/link-de-afiliado-para-whatsapp/`
- `/glossario/cadencia-de-postagem-whatsapp/`
- `/glossario/grupo-de-origem-e-destino/`

Essas páginas devem responder rápido, linkar para landing pages e reduzir dependência de keywords comerciais difíceis.

### 5. Ferramentas/conversões

O produto permite “engineering as marketing” sem mexer em produção sensível:

- Calculadora de tempo economizado em grupos.
- Gerador de checklist de campanha por nicho.
- Validador manual de copy de oferta com checklist de campos obrigatórios.
- Planejador de calendário semanal de ofertas.

Essas ferramentas podem gerar leads com alta intenção e páginas naturalmente linkáveis.

## Plano de implementação seguro

### Sprint 1 — Governança e correções sem mudar URLs

1. Criar registry único para páginas SEO.
2. Fazer sitemap e validador consumirem o registry.
3. Corrigir validação `Product` versus `SoftwareApplication`.
4. Incluir todos os 36 slugs atuais no validador.
5. Adicionar testes para: página no registry existe, está no sitemap, tem metadata, tem schema esperado e não está órfã.

Risco: baixo, desde que não remova rotas antigas.

### Sprint 2 — Arquitetura de hubs

1. Criar hubs `/espelhar-grupos-whatsapp/`, `/bot-ofertas-whatsapp/` e `/automacao-whatsapp-afiliados/`.
2. Atualizar header/footer e spokes com links contextuais.
3. Atualizar sitemap com hubs.
4. Adicionar BreadcrumbList em todas as landing pages, não só páginas de dor.

Risco: baixo/médio; validar canonicals e interlinking em staging.

### Sprint 3 — Diferenciação de conteúdo

1. Definir schema de conteúdo por tipo de página.
2. Enriquecer 5 páginas prioritárias antes de expandir volume.
3. Criar CTA/material específico por cluster.
4. Medir conversão por slug.

Risco: baixo; mudanças editoriais, sem banco obrigatório.

### Sprint 4 — Dados proprietários e ferramentas

1. Criar agregações anônimas apenas em staging.
2. Validar que não há PII em logs, slugs, APIs ou páginas.
3. Publicar benchmark editorial inicial.
4. Evoluir para ferramenta/calculadora pública.

Risco: médio/alto se tocar dados reais; precisa revisão de privacidade e staging.

## Backlog priorizado

### Alta prioridade

- Corrigir script de validação de LPs.
- Centralizar lista de slugs.
- Criar hubs por cluster.
- Enriquecer páginas com blocos únicos.
- Medir CTA e signup por slug.
- Adicionar breadcrumbs em todas as LPs.

### Média prioridade

- Criar glossário.
- Criar materiais específicos por cluster.
- Separar sitemap por tipo quando passar de 100 URLs.
- Adicionar tabela editorial de `lastModified` real.
- Criar dashboard de SEO no admin.

### Baixa prioridade

- Expandir cidades além das 15 atuais.
- Criar páginas de comparação contra concorrentes.
- Criar páginas por integração/plataforma apenas depois de ter conteúdo forte e regras de afiliado bem explicadas.

## Métricas de sucesso

### Indexação

- 95% das páginas indexáveis no sitemap retornando 200.
- 0 páginas órfãs.
- 0 canonicals conflitantes.
- 0 JSON-LD inválido.

### Conteúdo

- Cada página programática com pelo menos 600–900 palavras úteis ou recurso interativo equivalente.
- Cada página com 3 blocos únicos além do template global.
- Cada cluster com um hub e pelo menos 5 links internos contextuais.

### Negócio

- Leads por slug.
- Trial por slug.
- Ativação por slug: WhatsApp conectado, credencial salva, grupo criado, primeiro envio.
- Pagamento por cluster.
- Páginas com tráfego mas baixa conversão para revisão de CTA.

## Crítica final

O Wabot/BOTinho não precisa de “mais páginas” agora; precisa de **mais sistema**. A base já existe, mas o próximo salto vem de governança, diferenciação e dados proprietários. Se o projeto simplesmente gerar mais centenas de URLs com a estrutura atual, o risco é diluir qualidade e criar páginas finas. Se primeiro criar registry, hubs, validação, conteúdo único e mensuração por slug, o mesmo motor pode virar um canal de aquisição defensável.
