# Plano revisado — Campanha Canais + Preservação Avançada

Revisão feita após o primeiro pacote de implementação da campanha. O objetivo deste documento é separar o que já está entregue, o que ficou parcial e o que ainda precisa ser implementado antes de escalar tráfego, conteúdo e produção audiovisual.

## Classificação da demanda

- **Tipo:** Marketing/SEO com impacto técnico leve.
- **Skills aplicadas:** `ai-seo`, `seo-audit` e `cro`.
- **Escopo desta revisão:** planejamento, priorização, riscos e checklist de próximas entregas. Não altera portas, banco, autenticação, APIs ou ambiente de produção.

## Análise de risco STRICT

| Ponto | Avaliação | Decisão |
|---|---|---|
| Erros fatais | Baixo risco nesta etapa porque a mudança é documental. O risco futuro está em criar rotas sem build/testes ou CTAs para páginas inexistentes. | Toda nova página deve passar por `npm run lint` e `npm run build` no dashboard antes de staging. |
| Breaking changes | Não há mudança de API, schema de DB, contratos de props ou autenticação nesta revisão. | Não mexer em schema, `.env`, portas ou banco para a campanha. |
| Efeito cascata | O maior efeito cascata é SEO/UX: links internos, sitemap e hub podem apontar para ativos que ainda não existem. | Só promover tráfego quando páginas P0/P1 tiverem destino real para lead capture. |
| Isolamento de ambiente | Nenhuma ação em produção. Validação deve ocorrer primeiro em `develop` e staging `http://178.105.54.0:3006`. | Manter PR contra `develop` e validar na porta 3006. |
| Bloqueio | Não há bloqueio técnico para revisar o plano. Há bloqueio comercial para escalar campanha paga/orgânica sem diagnóstico/lead magnet. | Priorizar captura e medição antes de ampliar distribuição. |

## O que já foi implementado

### Entregue — base de indexação e conversão inicial

1. **Landing principal P0**
   - `/bot-canais-whatsapp` foi criada como página comercial da campanha.
   - Inclui promessa, dores, pilares do Módulo de Preservação Avançada, comparativo, FAQ, JSON-LD e CTAs para cadastro/login.

2. **Páginas SEO comerciais P1**
   - `/bot-afiliados-whatsapp`
   - `/bot-achadinhos-whatsapp`
   - `/anti-ban-whatsapp`
   - `/grupo-para-canal-whatsapp`
   - `/bot-canal-whatsapp`

3. **Blog educativo Sprint 3**
   - `/blog/grupo-ou-canal-whatsapp-achadinhos`
   - `/blog/como-evitar-banimento-whatsapp-afiliados`
   - `/blog/shadowban-whatsapp-canais`
   - `/blog/migrar-grupo-achadinhos-para-canal`
   - `/blog/chip-dedicado-bot-whatsapp`
   - `/blog/bot-whatsapp-antiban-existe`

4. **Fundação técnica de SEO**
   - Rotas adicionadas ao registry de SEO/sitemap.
   - Metadata e JSON-LD para páginas comerciais e artigos.
   - Inserção dos posts no hub de conteúdos.
   - Documentos-base de keywords, mapa de páginas e posicionamento.

## O que está parcial

### Parcial 1 — Conversão ainda depende de cadastro genérico

Os CTAs principais levam para `/login?mode=register...`. Isso funciona para cadastro, mas ainda não captura a intenção específica de quem veio por “anti-ban”, preservação, canais ou migração.

**Risco:** o visitante com dor urgente pode não estar pronto para criar conta e pode abandonar antes de deixar contato.

**Correção recomendada:** criar um diagnóstico simples antes do cadastro completo, com resultado e CTA para falar/testar.

### Parcial 2 — Hub-and-spoke existe, mas ainda não está completo

As páginas e artigos já formam a primeira malha de links, porém o plano original previa páginas de decisão, objeção e ferramentas que ainda não existem.

**Risco:** a campanha responde bem a buscas iniciais, mas perde usuários em estágio de comparação, objeção e diagnóstico.

**Correção recomendada:** implementar páginas P1.5/P2 com links claros a partir da landing, páginas comerciais e blog posts.

### Parcial 3 — Mensuração orgânica existe, mas falta plano de evento por intenção

As páginas usam tracking orgânico, mas ainda falta uma matriz explícita de eventos por CTA, origem e estágio do funil.

**Risco:** depois do deploy, será difícil saber se a busca “anti-ban” converte diferente de “bot para canais” ou “migrar grupo para canal”.

**Correção recomendada:** padronizar eventos de clique, origem de CTA, rota e intenção antes da divulgação pesada.

### Parcial 4 — Promessa visual do painel é conceitual

A landing mostra um painel de saúde como narrativa de produto. Se o recurso ainda não estiver totalmente disponível no dashboard real, a comunicação precisa manter o caráter de “módulo/fluxo” e não de tela exata já entregue.

**Risco:** desalinhamento entre expectativa comercial e produto percebido no onboarding.

**Correção recomendada:** validar texto e screenshots com o estado real do produto em staging antes de impulsionar.

## O que ainda não foi implementado

### Não implementado — P0 comercial antes de tráfego

1. **Diagnóstico de Preservação Avançada**
   - URL planejada: `/diagnostico-antiban-whatsapp`
   - Função: transformar tráfego de dor urgente em lead qualificado.
   - Deve entregar uma pontuação simples de risco e recomendar próximo passo.

2. **Checklist de Preservação Avançada**
   - URL planejada: `/materiais/checklist-antiban-whatsapp`
   - Função: captura leve para quem ainda não quer cadastro completo.
   - Pode ser formulário simples + checklist na própria página.

3. **Calculadora de risco**
   - URL planejada: `/ferramentas/calculadora-risco-whatsapp`
   - Função: ferramenta compartilhável para SEO, conversão e educação.
   - Deve evitar linguagem de garantia e usar “estimativa de exposição operacional”.

4. **Matriz de eventos/UTMs da campanha**
   - Cliques em CTA principal, CTA secundário, diagnóstico, checklist e cadastro.
   - Dimensões mínimas: rota, cluster, intenção, posição do CTA e destino.

### Não implementado — P1/P2 páginas de decisão

1. **Página comparativa contra bot comum**
   - URL planejada: `/bot-comum-vs-botinho`
   - Função: diferenciar BOTinho de ferramentas que só repostam.

2. **FAQ de preservação/“anti-ban”**
   - URL planejada: `/faq-antiban-whatsapp`
   - Função: responder objeções e capturar long tails sensíveis.

3. **Página “como funciona”**
   - URL planejada: `/como-funciona-botinho-canais`
   - Função: explicar fluxo operacional de fontes, destinos, cadência, variações e monitoramento.

4. **Página de aprofundamento do módulo**
   - URL planejada: `/protecao-antiban-botinho`
   - Função: ranquear para buscas de limite, variação, pausa, horário de silêncio e monitoramento.

### Não implementado — validação externa e distribuição

1. **Checklist de QA em staging na porta 3006**
   - Validar todas as rotas, metadata, links internos, mobile e CTAs.

2. **Search Console pós-deploy**
   - Enviar sitemap, pedir indexação das rotas P0/P1 e monitorar cobertura.

3. **Pacote social/audiovisual**
   - Reels, carrosséis e scripts ainda não foram criados.
   - Devem usar a mesma promessa honesta: preservação, não “anti-ban 100%”.

4. **Provas e ativos comerciais**
   - Prints reais de fluxo, mini-demo, depoimentos ou estudo de caso ainda precisam ser levantados.

## Prioridades revisadas

### P0 — Corrigir captura e medição antes de divulgar

**Objetivo:** não desperdiçar tráfego orgânico ou social com CTA genérico demais.

1. Criar `/diagnostico-antiban-whatsapp` com resultado simples e CTA para cadastro/contato.
2. Criar matriz de eventos/UTMs para todos os CTAs da campanha.
3. Revisar CTAs da landing e das páginas comerciais para apontarem também para diagnóstico/checklist quando o usuário ainda estiver em fase de dor.
4. Rodar QA completo em staging `http://178.105.54.0:3006` antes de qualquer tráfego pago ou divulgação forte.

**Critério de pronto:** usuário consegue sair de uma busca de dor, fazer diagnóstico, entender risco e ter próximo passo claro sem depender apenas de cadastro genérico.

### P1 — Completar ativos de lead magnet e ferramentas

**Objetivo:** capturar usuários que pesquisam problema, mas ainda não estão prontos para comprar.

1. Criar `/materiais/checklist-antiban-whatsapp`.
2. Criar `/ferramentas/calculadora-risco-whatsapp`.
3. Inserir chamadas contextuais para esses ativos em artigos e páginas comerciais.
4. Registrar essas rotas no SEO registry/sitemap quando implementadas.

**Critério de pronto:** cada artigo educativo tem pelo menos um CTA para ativo intermediário e um CTA para página comercial.

### P2 — Fechar lacunas de decisão e objeção

**Objetivo:** aumentar autoridade e conversão para visitantes comparando opções.

1. Criar `/bot-comum-vs-botinho`.
2. Criar `/faq-antiban-whatsapp`.
3. Criar `/como-funciona-botinho-canais`.
4. Criar `/protecao-antiban-botinho`.

**Critério de pronto:** visitante consegue entender diferença entre BOTinho, bot comum, automação manual, preservação avançada e riscos sem depender de conversa humana.

### P3 — Distribuição e autoridade

**Objetivo:** transformar o hub em campanha de aquisição.

1. Produzir 5 a 8 posts sociais a partir dos artigos já publicados.
2. Criar 3 roteiros curtos de vídeo: medo do grupo cair, chip dedicado, “anti-ban” honesto.
3. Levantar provas reais permitidas: prints, depoimentos, microcases e métricas agregadas.
4. Monitorar Search Console e ajustar titles/metas de páginas com impressão sem clique.

**Critério de pronto:** campanha tem conteúdo para distribuição recorrente e sinais reais para melhorar confiança.

## Ordem recomendada de execução

1. **Sprint A — Conversão mínima viável**
   - Diagnóstico + eventos + ajuste de CTAs.

2. **Sprint B — Lead magnets**
   - Checklist + calculadora + links internos.

3. **Sprint C — Decisão**
   - Bot comum vs BOTinho + FAQ + como funciona + proteção avançada.

4. **Sprint D — Distribuição**
   - Social, vídeo, provas, Search Console e otimização por dados.

## Checklist de aceite para qualquer próxima implementação

- A página existe e responde no build do Next.
- A rota está no SEO registry quando for indexável.
- Metadata, canonical e OG estão definidos.
- JSON-LD é compatível com o tipo de página.
- CTAs têm UTM ou origem rastreável.
- Links internos não apontam para página inexistente.
- Copy não promete “anti-ban 100%”.
- Staging é validado em `http://178.105.54.0:3006` antes de produção.
