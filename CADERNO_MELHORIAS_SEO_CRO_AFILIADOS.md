# Caderno de Melhorias Recomendadas (SEO + Marketing + CRO)

Contexto: produto focado em afiliados, com nova marca **Bot Conversor para Afiliados**.

## ISSUE 01 — Criar Landing Pública na `/` (substituir redirecionamento puro)

**Problema**
A home atual apenas redireciona para `/dashboard` ou `/login`, sem conteúdo indexável para aquisição orgânica.

**Impacto**
- Perda de tráfego SEO para termos de topo e meio de funil.
- Redução de confiança para visitantes frios (sem narrativa de valor).

**Evidência técnica**
- `dashboard/app/page.js` executa redirecionamento client-side com `localStorage`.

**Objetivo**
Transformar `/` em landing comercial SEO-first, mantendo redirecionamento apenas para usuários autenticados.

**Escopo técnico**
- Criar seção hero com H1, subtítulo e CTAs.
- Seções: benefícios para afiliados, “como funciona”, prova social, FAQ.
- Botões para `/login` e ancoragem para planos.

**Critérios de aceitação**
- Página `/` deve renderizar conteúdo textual sem depender de JS para bots.
- Deve existir H1 único e pelo menos 3 H2 semânticos.
- CTA primário visível acima da dobra.

**Prioridade**: P0

---

## ISSUE 02 — Metadata por rota (Title/Description/OpenGraph)

**Problema**
O metadata está global e genérico para todo o app, sem especialização por intenção de busca por página.

**Impacto**
- CTR orgânica menor por snippets pouco específicos.
- Dificuldade de posicionamento para keywords transacionais.

**Evidência técnica**
- `dashboard/app/layout.js` define metadata genérico global.

**Objetivo**
Criar metadata dedicado nas rotas principais (`/`, `/login`, `/dashboard/planos`), com foco em afiliados.

**Escopo técnico**
- Definir `title` e `description` por página.
- Adicionar OG básico (`og:title`, `og:description`) e canonical.

**Critérios de aceitação**
- Cada rota prioritária deve ter title/description únicos.
- Titles até ~60 caracteres e descriptions entre ~140–160.

**Prioridade**: P0

---

## ISSUE 03 — Reescrever copy do Login/Cadastro para afiliados

**Problema**
A copy de login/cadastro é funcional, mas não comunica promessa de transformação para afiliado.

**Impacto**
- Conversão de visitantes frios menor.
- Menor conexão emocional com ICP de afiliados.

**Evidência técnica**
- `dashboard/app/login/page.js` usa textos genéricos de acesso.

**Objetivo**
Aumentar taxa de cadastro com microcopy orientada a benefício.

**Escopo técnico**
- Ajustar H1/subheadline dinâmicos (login vs cadastro).
- Incluir mensagem de segurança/confiabilidade.
- Adicionar link “esqueci senha” (se endpoint existir; caso contrário, backlog técnico separado).

**Critérios de aceitação**
- Tela de cadastro com proposta clara de valor para afiliado.
- CTA com linguagem de ação e benefício.

**Prioridade**: P1

---

## ISSUE 04 — Otimizar seção de Planos para redução de fricção de compra

**Problema**
A página de planos está boa estruturalmente, mas carece de elementos de redução de risco.

**Impacto**
- Queda de conversão em tráfego pago/orgânico que chega ao checkout.

**Evidência técnica**
- `dashboard/app/dashboard/planos/page.js` contém comparação e preços, porém sem FAQ/garantia/SLA de suporte.

**Objetivo**
Elevar conversão para checkout com mais confiança e clareza de decisão.

**Escopo técnico**
- Adicionar FAQ curto abaixo dos planos.
- Reforçar “para quem é” em cada plano (iniciante vs escala).
- Incluir microcopy de suporte e ativação.

**Critérios de aceitação**
- FAQ com ao menos 3 perguntas-chave.
- Blocos de plano com promessa focada em resultado para afiliado.

**Prioridade**: P1

---

## ISSUE 05 — Implementar Sitemap + Robots + estratégia de indexação

**Problema**
Sem estratégia explícita de indexação das páginas públicas vs privadas.

**Impacto**
- Crawling ineficiente.
- Risco de indexar URLs que não deveriam ranquear (área logada).

**Objetivo**
Garantir que apenas páginas públicas estratégicas recebam atenção de crawler.

**Escopo técnico**
- Criar `sitemap.xml` com rotas públicas.
- Configurar `robots.txt` com disallow para áreas privadas.
- Validar canonical na landing pública.

**Critérios de aceitação**
- `/dashboard/*` bloqueado para indexação.
- `/` e possíveis landings auxiliares permitidas.

**Prioridade**: P1

---

## ISSUE 06 — Inserir tracking de funil (eventos de conversão)

**Problema**
Sem telemetria explícita de microconversões (clique CTA, cadastro iniciado, checkout iniciado).

**Impacto**
- Decisões de copy/design sem base de dados.
- Dificuldade de priorizar backlog de CRO.

**Objetivo**
Instrumentar eventos para medir gargalos reais do funil.

**Escopo técnico**
- Eventos mínimos: `cta_home_click`, `signup_start`, `signup_success`, `checkout_start`, `checkout_success`.
- Padronizar nomenclatura e contexto (plano, origem, referência).

**Critérios de aceitação**
- Eventos disparam uma única vez por ação relevante.
- Dashboard analítico com funil mínimo funcional.

**Prioridade**: P1

---

## ISSUE 07 — Melhorar performance percebida (Core Web Vitals na landing)

**Problema**
Sem otimizações específicas de LCP/CLS para a futura landing.

**Impacto**
- SEO técnico e UX prejudicados em mobile.

**Objetivo**
Garantir boa experiência em redes móveis para afiliados em operação.

**Escopo técnico**
- Evitar dependência excessiva de JS no conteúdo principal.
- Priorizar carregamento do bloco hero.
- Otimizar imagens e usar `next/image` quando aplicável.

**Critérios de aceitação**
- LCP percebido rápido no primeiro paint de conteúdo principal.
- Nenhuma imagem sem `alt` nas páginas públicas.

**Prioridade**: P2

---

## ISSUE 08 — Estruturar testes A/B de copy para ICP afiliados

**Problema**
Sem rotina de experimento para validar mensagens de aquisição e fechamento.

**Impacto**
- Evolução lenta de conversão.
- Decisão por opinião em vez de evidência.

**Objetivo**
Estabelecer ciclo contínuo de otimização de conversão.

**Escopo técnico**
- Hipótese A/B para H1 da home.
- Hipótese A/B para CTA dos planos.
- Janela mínima de coleta e critério estatístico simples.

**Critérios de aceitação**
- Pelo menos 1 experimento ativo por ciclo quinzenal.
- Registro de hipótese, métrica e decisão.

**Prioridade**: P2

---

## ISSUE 09 — Revisar consistência de marca em mensagens operacionais

**Problema**
Mudanças de marca exigem revisão contínua em conteúdos automáticos e integrações.

**Impacto**
- Inconsistência de identidade e confiança.

**Objetivo**
Garantir uniformidade total da marca em frontend, backend e comunicações geradas.

**Escopo técnico**
- Revisão de textos em workers, respostas de pagamento, logs user-facing.
- Definir guia curto de nomenclatura oficial.

**Critérios de aceitação**
- Nenhuma string legacy da marca antiga em superfícies públicas.

**Prioridade**: P2

---

## ISSUE 10 — Roadmap de conteúdo SEO para afiliados (fora produto)

**Problema**
Sem plano de conteúdo para capturar demanda orgânica recorrente.

**Impacto**
- Dependência maior de tráfego direto/referência.

**Objetivo**
Construir aquisição orgânica previsível com tópicos alinhados ao ICP.

**Escopo técnico/marketing**
- Cluster 1: automação de WhatsApp para afiliados.
- Cluster 2: copy para oferta em grupos.
- Cluster 3: produtividade operacional para afiliado.

**Critérios de aceitação**
- Calendário inicial com 8–12 pautas.
- Cada pauta mapeada por intenção de busca e CTA final.

**Prioridade**: P3
