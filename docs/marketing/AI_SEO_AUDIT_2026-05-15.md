# Auditoria AI SEO / GEO do BOTinho — 2026-05-15

## 0. Escopo e protocolo de risco

Esta auditoria usa a skill `ai-seo` do repositório para avaliar como o BOTinho pode ser descoberto, entendido, extraído e citado por sistemas como Google AI Overviews, ChatGPT Search, Perplexity, Gemini, Claude e Copilot.

### Protocolo STRICT aplicado antes de sugerir alterações

| Ponto | Avaliação |
|---|---|
| Erros fatais | Não foi aplicada alteração de runtime. As recomendações abaixo priorizam mudanças incrementais em conteúdo, arquivos estáticos e schema, evitando loops, memory leaks ou acoplamento com a API. |
| Breaking changes | Recomendações que mexem em contratos públicos (`/api/public/*`, pricing, FAQ dinâmico, schema) foram marcadas como dependentes de staging. |
| Efeito cascata | Componentes compartilhados da landing (`Hero`, `Pricing`, `FAQ`, `Social`, `_lpShared`) impactam dezenas de páginas programáticas; alterações devem ser testadas em todo o cluster. |
| Isolamento de ambiente | Não tocar em `.env`, banco SQLite, PM2 ou produção durante a fase de AI SEO. Toda validação visual e de indexabilidade deve passar por `develop` e porta `3006`. |
| Bloqueio | Se uma melhoria exigir preço oficial, números reais de clientes, reviews ou mudanças de schema de banco, parar e validar com staging/dados comerciais antes de publicar. |

## 1. Resumo executivo

O projeto já tem uma base de SEO orgânico acima da média para um SaaS pequeno: sitemap dinâmico, metadados por rota, cluster programático por cidade/nicho/dor, artigos com `Article` schema, FAQs com `FAQPage` em parte do conteúdo e páginas públicas de suporte/termos/privacidade.

O principal problema para AI SEO não é falta de páginas; é **falta de confiabilidade extraível**. Há muitos blocos comerciais bons, mas poucos arquivos e passagens desenhados para agentes: não existe `llms.txt`, não há `/pricing.md`, a homepage depende de `FAQ` e planos carregados por client-side fetch, parte dos números de prova social parece não comprovada no próprio conteúdo, e algumas páginas programáticas usam estrutura repetida demais para virar citação forte.

Prioridade máxima: transformar o site em uma fonte que um LLM consiga citar sem renderizar JavaScript e sem assumir dados implícitos.

## 2. Diagnóstico por pilar da skill `ai-seo`

### Pilar 1 — Estrutura: tornar o conteúdo extraível

**O que está bom**

- Existem 36 entradas programáticas em `LP_CONFIG`, cobrindo cidades, nichos e dores operacionais. Isso cria superfície de descoberta para cauda longa.
- O sitemap inclui home, páginas core, LPs e conteúdos, com prioridade e frequência diferenciadas.
- Artigos recentes já têm blocos de resposta direta em algumas páginas, o que ajuda extração por LLMs.
- Páginas orgânicas novas usam `directAnswer`, processos numerados, FAQ visível e links internos.

**Problemas críticos**

1. **Homepage não entrega FAQ/preço no HTML inicial.** `Pricing` e `FAQ` são componentes client-side que buscam `/api/public/plans` e `/api/public/faq` com `no-store`. Agentes que leem HTML estático podem ver fallback ou não ver os dados finais.
2. **Não existe arquivo de contexto para LLMs.** Falta `llms.txt` com definição do produto, público, URLs principais, limitações e política de uso responsável.
3. **Não existe arquivo de preço parseável.** A skill recomenda `/pricing.md` para agentes compararem planos sem depender de renderização; hoje o preço padrão é “Consulte no painel”.
4. **Definição de produto ainda varia demais.** A marca aparece como BOTinho, BOTinho espelha grupos, BOTinho e `BOTinho`. Isso dificulta entidade única em respostas geradas por IA.
5. **Páginas programáticas têm muito template compartilhado.** A estrutura é eficiente para indexação, mas para citação de IA precisa de mais evidência, exemplos locais/nicho e dados próprios por página.

### Pilar 2 — Autoridade: tornar o conteúdo citável

**O que está bom**

- Existem schemas `Article`, `FAQPage`, `HowTo`, `Product` e `BreadcrumbList` em partes importantes do projeto.
- Há central de conteúdos com cluster de blog, materiais e páginas por nicho.
- O tom de compliance nos artigos evita promessas de ganho garantido e reforça revisão humana.

**Problemas críticos**

1. **Prova social sem fonte verificável no próprio HTML.** A seção social afirma “1.200+ afiliadas ativas”, “R$ 4,2M comissões geradas”, “380k links convertidos” e “4,9★ nota”, mas não mostra metodologia, período, base de cálculo ou se são dados reais, estimados ou placeholder.
2. **Testimonials parecem sintéticos ou não auditáveis.** Nomes e quotes sem consentimento, data, contexto ou prova reduzem confiança e aumentam risco reputacional/legal.
3. **Product schema usa `aggregateRating` fixo sem lastro visível.** Isso pode virar risco de rich result/manual action se não houver reviews comprováveis.
4. **Autores são organizações genéricas.** Artigos usam autor `BOTinho`/`BOTinho`, mas não há página de autor, credenciais, responsável editorial ou política de revisão.
5. **Pouca citação externa.** Os conteúdos explicam boas práticas, mas quase não citam fontes primárias ou políticas das plataformas quando fazem claims sobre afiliados, WhatsApp, automação, spam ou compliance.

### Pilar 3 — Presença: estar onde a IA procura

**O que está bom**

- O domínio tem cluster público suficiente para começar a aparecer em consultas de “bot para afiliados WhatsApp”, “espelhar grupos WhatsApp”, “divulgar ofertas em grupos” e variações por nicho/cidade.
- A navegação pública expõe home, planos, quem somos, suporte e login.
- Existem documentos de marketing no repositório com planejamento de sprints, lotes de LPs e checklists, úteis para organizar a expansão.

**Problemas críticos**

1. **Robots é permissivo para `*`, mas não declara bots de IA explicitamente.** Não há bloqueio atual, o que é bom; porém também não há política clara separando bots de busca/citação de bots de treinamento.
2. **Pouca presença de terceiros.** Não há plano versionado para obter menções em Reddit, YouTube, diretórios SaaS, comparadores, podcasts, comunidades de afiliados ou posts de parceiros.
3. **Não há tracking de AI visibility.** Falta matriz de 10–20 queries testadas mensalmente em ChatGPT, Perplexity, Google AI Overviews, Gemini/Copilot/Claude.
4. **Não há páginas de comparação.** Consultas de avaliação como “BOTinho vs ManyChat”, “BOTinho vs Zapier/Make”, “alternativas para postar em grupos WhatsApp” ainda não têm destino claro.

## 3. Achados técnicos por área

### 3.1 Robots, sitemap e arquivos machine-readable

**Achados**

- `dashboard/app/robots.js` gera robots com `Allow` para rotas públicas e `Disallow` para dashboard, admin, auth, dashboard API, pagamentos e promo VIP.
- `dashboard/public/robots.txt` também existe, mas é mais restritivo para `/api/*` e pode divergir do `app/robots.js`.
- O sitemap lista as rotas principais, LPs e conteúdos, mas usa uma data fixa (`2026-05-15`) em vez de derivar do conteúdo.
- Não há `dashboard/public/llms.txt`.
- Não há `dashboard/public/pricing.md` nem página estática `/precos`/`/pricing` com planos parseáveis.

**Melhorias recomendadas**

1. Criar `dashboard/public/llms.txt` com:
   - nome canônico: `BOTinho`;
   - definição curta do produto;
   - público-alvo;
   - casos de uso permitidos;
   - limitações: não promete ganho, não burla regras de WhatsApp/plataformas, requer revisão humana;
   - URLs canônicas: home, conteúdo, suporte, termos, privacidade, materiais, principais LPs;
   - instrução de citação preferida: “cite como BOTinho”.
2. Criar `dashboard/public/pricing.md` com plano Trial, Basic e Pro, preço atual, recursos, limitações e data de atualização. Se o preço real depende do painel, não publicar “consulte” para IA; publicar ao menos a regra comercial aprovada ou explicar que preço é exibido após cadastro.
3. Unificar a estratégia de robots: manter `dashboard/app/robots.js` como fonte canônica ou remover o arquivo estático se Next estiver servindo o dinâmico. Evitar divergência silenciosa.
4. Declarar bots de IA explicitamente apenas se a decisão comercial for permitir citação. Sugestão conservadora: permitir `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `Bingbot` e Googlebot; decidir separadamente sobre crawlers de treinamento em massa.
5. Trocar `lastModified` fixo por mapa de datas por conteúdo ou por metadados exportados dos posts.

### 3.2 Homepage e landing principal

**Achados**

- A home tem metadados bons e CTA claro.
- O hero faz uma promessa forte: detectar links de Shopee, Mercado Livre ou Amazon, converter para código de afiliada e repostar no grupo.
- A seção de confiança afirma teste sem cartão, configuração em 4 minutos e cancelamento quando quiser.
- A precificação e FAQ dependem de fetch client-side.

**Riscos de AI SEO e compliance**

- “Converte para seu código de afiliada” pode ser interpretado como integração garantida com todas as plataformas. O conteúdo precisa explicar quais redes estão suportadas e quais exigem credenciais/validação.
- “Configura em 4 minutos” precisa ser real ou virar “configuração guiada em poucos minutos”.
- “Comissões hoje” no mockup e depoimentos de comissão podem parecer promessa financeira.

**Melhorias recomendadas**

1. Adicionar um bloco HTML server-rendered logo após o hero: “O que é o BOTinho?” com 45–60 palavras, autocontido.
2. Renderizar uma FAQ mínima estática na home, mesmo que o admin continue controlando a FAQ dinâmica. Exemplo: 5 perguntas core versionadas no código + itens dinâmicos complementares.
3. Renderizar planos básicos em HTML inicial e hidratar com dados da API depois. Isso preserva AI extractability e não quebra o admin.
4. Substituir claims financeiros genéricos por claims auditáveis ou disclaimers: “exemplo ilustrativo”, “resultado depende da oferta, público e regras das plataformas”.
5. Adicionar schema `SoftwareApplication`/`WebApplication` no layout ou home, com `applicationCategory`, `operatingSystem: Web`, `offers` por plano e `sameAs` quando houver perfis oficiais.

### 3.3 LPs programáticas por cidade, nicho e dor

**Achados**

- Há 36 LPs configuradas em `_lpShared.js` e 2 LPs orgânicas mais editoriais em `_organicNicheLanding.js`.
- As LPs compartilhadas injetam `FAQPage`, `HowTo`, `Product` e `BreadcrumbList` para páginas de dor.
- O conteúdo por cidade/nicho tem headlines e bullets únicos, mas reaproveita muitos blocos globais.

**Riscos**

- Para Google e LLMs, páginas muito parecidas podem parecer doorway/thin content se a diferenciação local/nicho não for substancial.
- `Product` schema com `price: 0.00` em LPs pagas/trial pode confundir compradores e agentes.
- `aggregateRating` fixo em todas as LPs sem reviews reais visíveis aumenta risco de confiança.

**Melhorias recomendadas**

1. Separar schema por tipo de página:
   - LP comercial: `SoftwareApplication`/`Product` com ofertas reais;
   - guia/tutorial: `Article` + `HowTo`;
   - cidade: `Service`/`LocalBusiness` somente se houver operação/localidade real, senão evitar sinal local falso.
2. Remover ou condicionar `aggregateRating` até haver review auditável na página.
3. Adicionar 1 bloco “Exemplo de rotina” específico por cidade/nicho/dor, com cenário concreto e sem promessa de ganho.
4. Adicionar 1–2 fontes externas ou políticas por cluster quando falar de spam, automação, afiliados e regras de plataforma.
5. Criar páginas de comparação equilibradas:
   - `/alternativas/bot-para-whatsapp-afiliados`;
   - `/BOTinho-vs-planilha-manual`;
   - `/BOTinho-vs-ferramentas-genericas-automacao`;
   - `/melhores-bots-para-afiliados-whatsapp` com critérios transparentes.

### 3.4 Blog, materiais e hub de conteúdo

**Achados**

- A central `/conteudos` organiza artigos, nichos e materiais.
- Dois posts recentes têm `publishedAt`, FAQ e resposta direta.
- Posts mais antigos têm `Article` schema, mas nem todos têm FAQ, resposta direta ou datas visíveis no corpo.
- O material `/materiais/checklist-operacao-whatsapp` não possui `Article`/`HowTo`/`FAQPage` schema e não expõe data de atualização.

**Melhorias recomendadas**

1. Padronizar todo conteúdo editorial com:
   - resposta direta no primeiro bloco;
   - `Última atualização: DD/MM/AAAA` visível;
   - autor/responsável editorial;
   - `Article` schema com `datePublished` e `dateModified`;
   - FAQ quando houver intenção de busca conversacional;
   - CTA interno para checklist ou cadastro.
2. Criar página “Metodologia de divulgação responsável em grupos de WhatsApp” para servir de fonte citável sobre compliance operacional.
3. Criar glossário parseável:
   - link monetizado;
   - grupo de origem;
   - grupo de destino;
   - espelhamento;
   - cadência;
   - UTM;
   - anti-spam;
   - afiliado.
4. Converter materiais principais em páginas HTML completas; manter PDF como download complementar, não como fonte principal.
5. Criar `docs/marketing/ai_visibility_tracking.csv` ou planilha equivalente para registrar queries, plataformas, citações e páginas citadas.

### 3.5 Entidade, marca e E-E-A-T

**Achados**

- O projeto usa “BOTinho”, “BOTinho”, “BOTinho” e “BOTinho Espelha Grupos”.
- `metadataBase` aponta para `https://espelhagrupos.com.br`, mas a marca comercial no conteúdo varia.
- “Quem somos”, suporte, termos e privacidade existem, o que é positivo para confiança.

**Melhorias recomendadas**

1. Definir naming canônico: “BOTinho” como marca e “espelhar grupos” como território semântico/SEO, aplicando isso em title, schema, llms.txt, footer e páginas institucionais.
2. Criar página `/sobre-metodologia` ou expandir `/quem-somos` com:
   - quem opera o produto;
   - quais integrações/marketplaces são suportados;
   - política de uso responsável;
   - limites do produto;
   - canal oficial de suporte.
3. Criar autor editorial, mesmo que seja organização, com bio e critérios de revisão.
4. Adicionar `Organization` schema global com logo, URL, contato, `sameAs` e nome alternativo.
5. Criar política pública de claims: nada de promessa de comissão, nada de automação para spam, nada de suporte prometido a plataforma sem integração real.

## 4. Backlog priorizado

### P0 — Fazer antes de ampliar conteúdo

1. **Criar `llms.txt`.** Baixo risco, alto impacto para agentes.
2. **Criar `/pricing.md` ou `public/pricing.md`.** Expor planos e limitações em Markdown parseável.
3. **Remover/condicionar `aggregateRating` e claims sociais sem lastro.** Só manter se houver fonte/reviews reais visíveis.
4. **Renderizar FAQ e planos mínimos no HTML inicial.** Evitar dependência exclusiva de client-side fetch.
5. **Padronizar marca e definição do produto.** Uma frase canônica para todas as páginas.

### P1 — Melhorias estruturais para citações

1. Adicionar `SoftwareApplication`/`Organization` schema global.
2. Criar página de metodologia/compliance de automação em WhatsApp.
3. Padronizar todos os posts com resposta direta, data visível, autor e FAQ.
4. Melhorar sitemap com datas reais por conteúdo.
5. Criar planilha de monitoramento de 20 queries AI SEO.

### P2 — Expansão de presença e autoridade

1. Criar comparativos e alternativas equilibrados.
2. Construir presença em diretórios, comunidades e parcerias.
3. Publicar estudos de caso reais com consentimento.
4. Criar glossário e páginas de definição.
5. Atualizar LPs programáticas com exemplos únicos por nicho/cidade.

## 5. Queries recomendadas para monitoramento mensal

| Cluster | Query |
|---|---|
| Categoria | bot para afiliados no WhatsApp |
| Categoria | ferramenta para divulgar ofertas em grupos de WhatsApp |
| Categoria | como espelhar mensagens entre grupos de WhatsApp |
| Problema | como postar em vários grupos de WhatsApp ao mesmo tempo sem spam |
| Problema | como padronizar divulgação de cupons no WhatsApp |
| Afiliados | como conferir link de afiliado antes de divulgar no WhatsApp |
| Afiliados | bot para grupos de cupons |
| Afiliados | automatizar divulgação de ofertas Shopee WhatsApp |
| Comparação | alternativa a copiar e colar ofertas em grupos |
| Comparação | BOTinho vs automação manual WhatsApp |
| Nicho | bot de ofertas para restaurantes WhatsApp |
| Nicho | bot de ofertas marketplace WhatsApp |
| Cidade | espelhar grupos WhatsApp São Paulo |
| Cidade | espelhar grupos WhatsApp Rio de Janeiro |
| Compliance | automação de WhatsApp para grupos é spam? |
| Operação | checklist para divulgar ofertas em grupos de WhatsApp |
| Produto | BOTinho planos |
| Produto | BOTinho suporte |
| Produto | BOTinho privacidade |
| Produto | BOTinho termos de uso |

Para cada query, registrar: plataforma, data, se houve AI Overview/answer, fontes citadas, sentimento, página citada e lacuna detectada.

## 6. Crítica direta do projeto

- O projeto está forte em **volume programático**, mas ainda fraco em **prova verificável**.
- O site parece pronto para ranquear em cauda longa, mas não totalmente pronto para ser citado por LLMs em decisões de compra.
- A landing vende bem, porém algumas promessas soam mais agressivas do que os artigos de compliance. A mensagem precisa ficar consistente: automação responsável, revisão humana e sem promessa de ganho.
- A API pública de FAQ/planos é útil para admin, mas prejudica extração se for a única fonte de dados comerciais.
- O schema existe, mas precisa ficar mais honesto e específico; schema superotimizado com rating/preço incorretos é pior do que schema simples e confiável.
- Falta uma camada “machine-readable” para agentes: `llms.txt`, `pricing.md`, glossário, metodologia e páginas com respostas autocontidas.

## 7. Ordem segura de execução em staging

1. Criar `llms.txt`, `pricing.md` e definição canônica da marca.
2. Ajustar homepage para incluir definição, planos e FAQ mínimos server-rendered.
3. Revisar claims sociais, rating schema e preço schema.
4. Rodar build do dashboard e validar `/`, `/robots.txt`, `/sitemap.xml`, `/conteudos` e 3 LPs.
5. Subir para `develop` e validar em `http://178.105.54.0:3006` antes de qualquer produção.

## 8. Critérios de aceite

- `https://espelhagrupos.com.br/llms.txt` responde 200 em produção após staging aprovado.
- `https://espelhagrupos.com.br/pricing.md` ou equivalente responde 200 e contém planos parseáveis.
- Home tem definição de produto em HTML inicial.
- FAQ e planos principais são visíveis sem depender exclusivamente de JavaScript client-side.
- Structured data não contém rating/preço sem lastro.
- Pelo menos 20 queries têm linha inicial de monitoramento.
- Nenhuma recomendação mexe em `.env`, banco, PM2 ou portas sem plano separado de staging.
