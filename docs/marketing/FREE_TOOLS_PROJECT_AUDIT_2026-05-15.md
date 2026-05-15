# Auditoria profunda do Wabot com a skill `free-tools` — 2026-05-15

## 1. Protocolo STRICT antes de qualquer melhoria

### 1.1 Erros fatais
- **Não implementar ferramentas públicas com scraping síncrono pesado no request da página.** O projeto já depende de conversores, WhatsApp/Baileys e Next; uma ferramenta gratuita que faça download, conversão ou análise em tempo real precisa ter timeout, fila, cache e limite de taxa para não derrubar API ou dashboard.
- **Não criar polling agressivo em páginas públicas ou admin.** O dashboard já possui áreas com WebSocket/polling; novas ferramentas devem preferir cálculo local no navegador, formulários simples ou jobs assíncronos com backoff.
- **Não capturar dados sensíveis em ferramentas de marketing.** Cookies de afiliado, SSID, secrets da Shopee, tokens, telefones e mensagens reais não devem entrar em ferramentas públicas de diagnóstico.
- **Não publicar tool que incentive spam.** O posicionamento deve continuar em “operação responsável”, cadência e revisão humana; qualquer promessa de disparo massivo aumenta risco de bloqueio, reputação e compliance.
- **Não acoplar ferramenta gratuita ao banco transacional crítico sem isolamento.** Leads, eventos e resultados de diagnóstico devem entrar por tabelas/eventos próprios ou endpoint público limitado, nunca alterando estado operacional do bot.

### 1.2 Breaking changes
- Não alterar contratos existentes de `/api/auth`, `/api/public`, `/api/payments`, `/api/session`, `/api/groups` ou `/api/admin` para viabilizar growth; criar endpoints aditivos.
- Não mudar schema de `User`, `Payment`, `AnalyticsEvent`, `MessageLog`, `Group` ou `BotConfig` sem migration incremental, backfill planejado e validação em staging.
- Não mudar portas, proxy ou deploy para acomodar páginas/ferramentas públicas. Staging segue `3006/3004`; produção segue `3000/3001`.

### 1.3 Efeito cascata
- Uma ferramenta pública pode aumentar tráfego orgânico e carga no Next/API. Sem cache, rate limit e observabilidade, o efeito cascata aparece em login, checkout e conexão WhatsApp.
- Leads de ferramentas gratuitas podem poluir métricas de funil se não forem separados por `utm_source`, `tool_id`, `tool_result_tier` e intenção.
- Diagnósticos automáticos podem criar expectativa comercial errada se não explicarem limitações do WhatsApp, plataformas de afiliado e revisão humana.

### 1.4 Isolamento de ambiente
- Toda implementação deve nascer em branch a partir de `develop`, abrir PR para `develop` e validar em staging antes de produção.
- Ferramentas devem ser testadas em `http://178.105.54.0:3006` antes de qualquer promoção.
- Não tocar `.env`, banco de produção, PM2 de produção ou diretórios reais de produção para validar hipóteses de marketing.

### 1.5 Bloqueios
- **Pare antes de implementar** se a ferramenta exigir credenciais reais de afiliado, cookies, leitura de grupos reais do WhatsApp, mudança de schema não aditiva ou alteração de portas/deploy.
- **Pare antes de publicar** se a copy prometer ganho financeiro, comissões, “sem risco de ban”, disparo em massa ou burla de regras das plataformas.

---

## 2. Diagnóstico executivo

O Wabot/BOTinho já saiu do estágio “bot técnico” e tem uma base forte de produto SaaS: landing page, páginas programáticas, blog, materiais ricos, admin, pagamento, analytics, logs, suporte, FAQ editável e documentação de deploy. A maior oportunidade agora não é criar mais páginas genéricas; é criar **ferramentas gratuitas úteis e adjacentes** que capturem demanda de alta intenção antes do cadastro.

A crítica principal: o projeto tem muito conteúdo e muita automação operacional, mas ainda falta um **motor de aquisição interativo**. Hoje a promessa é explicada; falta o visitante experimentar valor antes de criar conta. A skill `free-tools` aponta exatamente esse gap: ferramentas simples, focadas e úteis, com caminho natural para o produto pago.

### Veredito
- **Produto:** forte para nicho de afiliados e admins de grupos, mas precisa reduzir dependência de promessa textual com provas interativas.
- **Growth:** boa base de SEO programático, mas falta “engineering as marketing” para ganhar links, menções e leads qualificados.
- **Analytics:** há eventos úteis, mas faltam eventos de topo de funil e taxonomia própria para ferramentas.
- **UX/comercial:** preço baixo reduz fricção, mas também pode reduzir percepção de valor; ferramentas gratuitas podem educar e ancorar valor operacional antes do plano.
- **Risco:** qualquer ferramenta que pareça “spam em grupos” prejudica posicionamento. O ângulo correto é produtividade, governança, consistência e conformidade.

---

## 3. O que o projeto já faz bem

### 3.1 Clareza de posicionamento responsável
O conteúdo central já afirma que o produto organiza grupos, converte links suportados, ajuda na distribuição com revisão humana, cadência responsável e logs. Isso é uma vantagem defensável porque evita posicionamento perigoso de spam.

### 3.2 Stack de landing pages e SEO programático
O projeto já possui landing pages por dor, nicho e cidade, além de blog e materiais. Isso cria superfície de busca, mas a maioria das páginas ainda é informacional. Ferramentas gratuitas transformariam esse tráfego em interação e lead.

### 3.3 Base de mensuração e admin growth
Já existem eventos analíticos ligados a signup, login, conexão WhatsApp, credenciais, grupos, checkout, pagamento e primeiro envio. Também existe visão administrativa de Marketing & Growth. Isso permite medir o impacto de novas ferramentas com evolução incremental.

### 3.4 Operação de deploy relativamente madura
Há separação entre staging e produção, smoke tests e scripts de deploy. Isso é crucial porque ferramentas públicas podem parecer “simples”, mas afetam tráfego, SEO e estabilidade do app.

### 3.5 Materiais ricos e conteúdo de educação
Existem checklists e conteúdos voltados para operação de WhatsApp. Eles podem ser reciclados como outputs de ferramentas, relatórios e templates.

---

## 4. Críticas profundas por área

### 4.1 Aquisição: conteúdo sem utilidade instantânea suficiente
As LPs explicam dores reais, mas o visitante ainda precisa acreditar no texto. Falta uma experiência em que ele cole informações não sensíveis e receba um diagnóstico prático em 30 segundos.

**Melhoria:** criar uma suíte de ferramentas gratuitas que gere score, checklist personalizado, calendário, estimativa de economia de tempo e recomendação de plano.

### 4.2 Lead capture: oferta ainda genérica
“Começar grátis” é forte para baixa fricção, mas nem todo visitante está pronto para conectar WhatsApp ou criar conta. Falta uma etapa intermediária para leads de topo/meio de funil.

**Melhoria:** lead capture parcialmente gated: resultado básico aberto; relatório completo enviado por email/WhatsApp opt-in, com CTA para teste grátis.

### 4.3 SEO: programático sem hubs de ferramenta
Páginas por cidade/nicho capturam long tail, mas ferramentas tendem a atrair backlinks e menções porque resolvem uma tarefa concreta.

**Melhoria:** criar rotas como `/ferramentas/calculadora-tempo-grupos-whatsapp`, `/ferramentas/auditoria-grupos-whatsapp` e `/ferramentas/gerador-calendario-ofertas` com schema apropriado.

### 4.4 Analytics: eventos bons no produto, fracos no pré-cadastro
Os eventos atuais começam muito próximos do cadastro/ativação. Para growth, faltam eventos como `tool_started`, `tool_completed`, `lead_captured`, `report_requested`, `cta_clicked`, `tool_signup_started` e `tool_signup_completed`.

**Melhoria:** adicionar taxonomia de eventos de tool com metadata sanitizada: `tool_id`, `result_score_band`, `persona`, `niche`, `utm_*`, `landing_page`, `cta_variant`.

### 4.5 Produto: onboarding poderia usar diagnóstico prévio
Se a ferramenta gratuita perguntar volume de grupos, frequência, nicho e plataformas usadas, o cadastro poderia chegar pré-configurado com recomendações.

**Melhoria:** persistir um `tool_report_id` não sensível e carregar sugestões no onboarding depois do signup.

### 4.6 Monetização: preço baixo sem âncora de ROI
Planos a R$1/R$2 removem objeção, mas podem parecer teste/brincadeira e não comunicar valor econômico. Uma calculadora de economia de tempo ajuda a mostrar que a automação vale mais que o preço.

**Melhoria:** usar a calculadora para mostrar horas/mês economizadas, custo operacional evitado e risco reduzido por padronização.

### 4.7 Confiança: faltam provas operacionais quantificadas
O produto fala em logs e cadência, mas páginas públicas poderiam mostrar benchmarks anônimos ou exemplos calculados.

**Melhoria:** criar outputs com “antes/depois” modelado, sempre marcado como estimativa, e depoimentos/casos quando disponíveis.

### 4.8 Segurança/compliance: ferramenta pública não pode pedir credenciais
O produto precisa de credenciais para conversão real, mas uma ferramenta gratuita nunca deve pedir cookies, appId, secretKey, QR Code ou acesso ao WhatsApp.

**Melhoria:** separar claramente “diagnóstico público sem credenciais” de “configuração autenticada dentro do dashboard”.

---

## 5. Suíte de ferramentas gratuitas recomendada

### 5.1 Ferramenta #1 — Calculadora de Tempo Perdido em Grupos de WhatsApp
**Tipo:** calculadora.
**URL sugerida:** `/ferramentas/calculadora-tempo-grupos-whatsapp`.
**Problema resolvido:** o afiliado não sabe quantas horas perde copiando, conferindo e repostando ofertas.
**Inputs seguros:** número de grupos monitorados, número de grupos destino, ofertas/dia, minutos por oferta, dias/semana.
**Output aberto:** horas/mês, custo mensal estimado, gargalos e recomendação de cadência.
**Lead capture:** “Receber plano de redução de tempo por email/WhatsApp”.
**CTA natural:** “Começar teste grátis com estes parâmetros”.

Score `free-tools`:

| Fator | Score | Justificativa |
|---|---:|---|
| Search demand exists | 4 | Busca por automatizar WhatsApp, grupos, afiliados e produtividade. |
| Audience match to buyers | 5 | Quem calcula tempo perdido é exatamente operador/admin de grupos. |
| Uniqueness vs. existing | 4 | Poucas calculadoras específicas para afiliados em grupos WhatsApp. |
| Natural path to product | 5 | O resultado aponta diretamente para automação/cadência/logs. |
| Build feasibility | 5 | Pode ser client-side, sem backend obrigatório. |
| Maintenance burden inverse | 5 | Fórmula simples e estável. |
| Link-building potential | 3 | Boa para conteúdo, moderada para backlinks. |
| Share-worthiness | 4 | Resultado em horas/mês é compartilhável. |
| **Total** | **35/40** | Prioridade máxima. |

### 5.2 Ferramenta #2 — Auditor de Operação de Grupos de Ofertas
**Tipo:** analyzer/quiz.
**URL sugerida:** `/ferramentas/auditoria-grupos-ofertas-whatsapp`.
**Problema resolvido:** o operador não sabe se sua rotina é sustentável, segura e consistente.
**Inputs seguros:** cadência, revisão humana, origem dos grupos, plataformas usadas, política de consentimento, logs, filtros, responsáveis.
**Output aberto:** score 0–100 com níveis “Frágil”, “Operável”, “Escalável responsável”.
**Lead capture:** relatório completo com checklist priorizado.
**CTA natural:** “Configurar fluxo com logs, filtros e cadência no BOTinho”.

Score: **34/40**. Excelente para diferenciação e confiança, desde que a linguagem evite prometer eliminação de bloqueios.

### 5.3 Ferramenta #3 — Gerador de Calendário de Ofertas para WhatsApp
**Tipo:** generator.
**URL sugerida:** `/ferramentas/gerador-calendario-ofertas-whatsapp`.
**Problema resolvido:** admins postam sem planejamento e cansam a audiência.
**Inputs seguros:** nicho, dias ativos, horários preferidos, intensidade, datas sazonais.
**Output aberto:** calendário semanal com sugestões de categorias, frequência e checklist de revisão.
**Lead capture:** exportar CSV/Google Calendar/Notion.
**CTA natural:** “Transformar calendário em rotina de envio com BOTinho”.

Score: **31/40**. Boa ferramenta de topo de funil, com forte potencial de compartilhamento.

### 5.4 Ferramenta #4 — Validador de Copy de Oferta para Grupos
**Tipo:** tester/analyzer.
**URL sugerida:** `/ferramentas/validador-copy-oferta-whatsapp`.
**Problema resolvido:** mensagens mal formatadas reduzem clique e aumentam ruído.
**Inputs seguros:** texto opcional sem links sensíveis, ou campos estruturados de título/preço/benefício/cupom/CTA.
**Output aberto:** checklist de clareza, risco de exagero, CTA, legibilidade, campos ausentes.
**Lead capture:** baixar modelos prontos por nicho.
**CTA natural:** “Padronizar mensagens automaticamente no BOTinho”.

Score: **29/40**. Útil, mas precisa de sanitização e aviso para não colar dados sensíveis.

### 5.5 Ferramenta #5 — Simulador de Cadência Anti-Ruído
**Tipo:** calculator/tester.
**URL sugerida:** `/ferramentas/simulador-cadencia-grupos-whatsapp`.
**Problema resolvido:** o usuário não sabe quantas ofertas postar por hora/dia sem cansar o grupo.
**Inputs seguros:** tamanho do grupo, nicho, horários, número de ofertas, histórico de reclamações, objetivo.
**Output aberto:** janela recomendada, intervalo mínimo, alertas de risco e plano de teste.
**Lead capture:** receber plano de cadência de 7 dias.
**CTA natural:** “Aplicar intervalos e filtros no BOTinho”.

Score: **30/40**. Excelente alinhamento com operação responsável.

### 5.6 Ferramenta #6 — Checklist Interativo de Credenciais de Afiliado
**Tipo:** interactive checklist.
**URL sugerida:** `/ferramentas/checklist-credenciais-afiliado`.
**Problema resolvido:** usuários travam em Mercado Livre, Amazon, Shopee e Magalu antes de ativar valor.
**Inputs seguros:** plataformas que usa e status de cada etapa; nunca pedir cookies ou secrets.
**Output aberto:** passos, links oficiais/operacionais e próximos bloqueios.
**Lead capture:** enviar tutorial personalizado.
**CTA natural:** “Salvar progresso no dashboard”.

Score: **28/40**. Muito bom para ativação e redução de suporte, mas menor poder de SEO.

---

## 6. Priorização recomendada

| Prioridade | Ferramenta | Motivo | MVP sugerido |
|---:|---|---|---|
| P0 | Calculadora de Tempo Perdido | Maior relação valor/esforço e ROI claro | 1 página client-side + captura opcional |
| P0 | Auditor de Operação | Diferencia posicionamento responsável | Quiz + score + relatório |
| P1 | Gerador de Calendário | Ótimo para compartilhamento e lead magnet | Gerador semanal + export CSV |
| P1 | Simulador de Cadência | Protege marca contra “spam” e educa | Fórmula simples + alertas |
| P2 | Checklist de Credenciais | Reduz suporte e melhora ativação | Checklist sem dados sensíveis |
| P2 | Validador de Copy | Útil, mas exige cuidado com input livre | Campos estruturados antes de texto livre |

---

## 7. Arquitetura segura para ferramentas

### 7.1 MVP sem backend para reduzir risco
Para as primeiras ferramentas, preferir cálculo local em React/Next:
- sem banco obrigatório;
- sem credenciais;
- sem chamadas externas;
- sem risco de sobrecarregar API;
- resultado compartilhável via querystring curta ou estado local.

### 7.2 Captura opcional via endpoint dedicado
Quando houver captura:
- criar endpoint público específico com rate limit;
- aceitar apenas email, telefone opt-in opcional, ferramenta, score band e UTMs;
- bloquear payloads longos;
- sanitizar metadata;
- registrar evento analítico sem dados sensíveis.

### 7.3 Modelo de eventos recomendado
Eventos aditivos:
- `tool_viewed`
- `tool_started`
- `tool_completed`
- `tool_report_requested`
- `tool_lead_captured`
- `tool_cta_clicked`
- `tool_signup_started`
- `tool_signup_completed`

Metadata permitida:
- `tool_id`
- `score_band`
- `persona`
- `niche`
- `group_count_band`
- `offers_per_day_band`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `landing_page`
- `cta_variant`

Metadata proibida:
- cookies;
- tokens;
- secrets;
- URLs de afiliado completas;
- telefone de grupos;
- conteúdo real de mensagens;
- QR Code;
- identifiers de WhatsApp.

### 7.4 SEO técnico
Cada ferramenta deve ter:
- title com “grátis” e termo da tarefa;
- description orientada a resultado;
- canonical;
- `SoftwareApplication` ou `WebApplication` JSON-LD;
- FAQPage com limitações;
- breadcrumbs;
- bloco “Como usar o resultado no BOTinho”;
- links internos para LPs por dor, blog e cadastro.

---

## 8. Melhorias de produto derivadas das ferramentas

### 8.1 Onboarding orientado por diagnóstico
Depois do cadastro, o BOTinho deveria perguntar se o usuário veio de uma ferramenta e usar o score para sugerir:
- delays iniciais;
- filtros;
- número máximo de grupos no começo;
- checklist de credenciais;
- primeira meta de ativação.

### 8.2 “Plano de operação” dentro do dashboard
Transformar outputs das ferramentas em plano salvo:
- objetivo da operação;
- grupos origem/destino previstos;
- cadência recomendada;
- plataformas suportadas;
- checklist de revisão;
- próximo passo.

### 8.3 Biblioteca pública de templates
Conectar gerador de calendário, copy e checklist a uma biblioteca de templates:
- oferta relâmpago;
- cupom limitado;
- comparativo de preço;
- aviso de estoque;
- disclaimer responsável.

### 8.4 Relatórios compartilháveis
Gerar cards compartilháveis sem dados sensíveis:
- “Economia estimada: 18h/mês”;
- “Score de operação: 72/100”;
- “Cadência recomendada: 1 oferta a cada X minutos”.

---

## 9. Melhorias de conteúdo e IA SEO

### 9.1 Criar hub `/ferramentas`
Um hub público deveria listar ferramentas por problema:
- reduzir tempo operacional;
- melhorar cadência;
- organizar calendário;
- revisar copy;
- preparar credenciais;
- auditar rotina.

### 9.2 Atualizar CTAs das LPs existentes
Em páginas de dor, trocar parte dos CTAs diretos para ferramenta contextual:
- página de “reduzir tempo” → calculadora;
- página de “consistência” → gerador de calendário;
- página de “alcance” → simulador de cadência;
- página de “rastrear resultados” → auditor de operação.

### 9.3 Criar artigos de suporte para cada ferramenta
Cada ferramenta precisa de 2–3 conteúdos satélite:
- “Como calcular tempo perdido em grupos de WhatsApp”;
- “Qual cadência usar em grupo de ofertas?”;
- “Checklist para operar grupos de afiliados sem improviso”.

### 9.4 Otimizar para respostas de IA
Cada ferramenta deve ter seção objetiva:
- “O que esta ferramenta faz?”;
- “Para quem é?”;
- “Quais dados ela não pede?”;
- “Limitações”;
- “Como interpretar o resultado”.

---

## 10. Melhorias de conversão

### 10.1 Fricção progressiva
Fluxo recomendado:
1. visitante usa ferramenta sem cadastro;
2. vê resultado parcial;
3. informa email/WhatsApp opt-in para relatório completo;
4. recebe CTA para iniciar teste com dados pré-preenchidos;
5. dashboard mostra checklist de ativação.

### 10.2 CTA por maturidade
- Score baixo: “Receber checklist para organizar minha operação”.
- Score médio: “Configurar BOTinho com cadência recomendada”.
- Score alto: “Escalar com logs e automação responsável”.

### 10.3 Provas no resultado
Adicionar:
- estimativa de horas poupadas;
- lista de riscos evitáveis;
- comparação entre operação manual e organizada;
- link para material de boas práticas.

---

## 11. Melhorias de engenharia e operação

### 11.1 Criar contrato de ferramenta
Antes de codar cada tool, definir:
- `tool_id` estável;
- inputs permitidos;
- fórmula/versionamento;
- eventos analíticos;
- copy de limitações;
- CTA primário;
- plano de testes em staging.

### 11.2 Testes mínimos por tool
- Render sem JavaScript crítico quebrado.
- Mobile 360px.
- Resultado com inputs vazios/limites.
- Sem envio de payload sensível.
- Eventos analíticos não gravam email/telefone em metadata.
- CTA mantém UTMs.
- Build Next passa.

### 11.3 Observabilidade
No admin growth, adicionar seção específica de ferramentas:
- visitas por tool;
- taxa de início;
- taxa de conclusão;
- taxa de captura;
- signup assistido;
- pagamento assistido;
- top score bands;
- tool com maior conversão para ativação.

---

## 12. Roadmap de 30 dias

### Semana 1 — Fundamento e primeira tool
- Definir schema lógico de eventos de ferramentas.
- Criar hub `/ferramentas`.
- Implementar Calculadora de Tempo Perdido client-side.
- Adicionar CTAs de LPs relacionadas para a calculadora.
- Validar em staging.

### Semana 2 — Auditor de operação
- Implementar quiz com score 0–100.
- Criar relatório parcial aberto e relatório completo com captura opcional.
- Adicionar eventos de completion e CTA.
- Criar 2 artigos satélite.

### Semana 3 — Calendário e cadência
- Implementar Gerador de Calendário.
- Implementar Simulador de Cadência.
- Adicionar export CSV simples.
- Conectar outputs a CTAs do dashboard.

### Semana 4 — Medição e otimização
- Adicionar painel de ferramentas no Admin Marketing & Growth.
- Comparar conversão de LP → cadastro vs Tool → cadastro.
- Rodar 2 experimentos de CTA.
- Ajustar copy por score band.

---

## 13. Roadmap de 90 dias

### Fase 1 — Aquisição interativa
- 4 ferramentas públicas ativas.
- Hub de ferramentas indexável.
- Eventos de ferramentas no funil.
- Relatórios compartilháveis.

### Fase 2 — Ativação personalizada
- Onboarding usa diagnóstico da ferramenta.
- Checklist de credenciais personalizado.
- Plano de operação salvo no dashboard.
- Emails/WhatsApp opt-in com próximos passos por score.

### Fase 3 — Motor de crescimento
- Admin mostra ROI por ferramenta.
- Experimentos por ferramenta/CTA.
- Conteúdos satélite ranqueando.
- Parcerias com comunidades de afiliados usando ferramentas como ativo gratuito.

---

## 14. Métricas de sucesso

### Topo de funil
- visitas no hub `/ferramentas`;
- visitas por ferramenta;
- CTR de LPs para ferramentas;
- conclusão da ferramenta;
- compartilhamentos/links.

### Lead e ativação
- taxa de captura por ferramenta;
- lead → signup;
- signup → WhatsApp conectado;
- signup → credencial salva;
- signup → primeiro envio bem-sucedido.

### Receita
- trial/tool → pagamento;
- receita assistida por ferramenta;
- retenção D7/D30 por origem de ferramenta;
- cancelamento por score inicial.

### Qualidade
- % eventos com UTM/tool_id;
- payloads rejeitados por rate limit/sanitização;
- tempo de carregamento das tools;
- erros por ferramenta.

---

## 15. Backlog ICE sugerido

| Item | Impacto | Confiança | Facilidade | ICE | Observação |
|---|---:|---:|---:|---:|---|
| Calculadora de Tempo Perdido | 5 | 5 | 5 | 5.0 | Primeiro MVP. |
| Hub `/ferramentas` | 4 | 5 | 4 | 4.3 | Estrutura SEO e navegação. |
| Auditor de Operação | 5 | 4 | 4 | 4.3 | Diferenciação forte. |
| Eventos `tool_*` | 5 | 4 | 3 | 4.0 | Necessário para provar ROI. |
| CTA contextual nas LPs | 4 | 4 | 4 | 4.0 | Aproveita tráfego existente. |
| Gerador de Calendário | 4 | 4 | 3 | 3.7 | Bom para compartilhamento. |
| Simulador de Cadência | 4 | 4 | 3 | 3.7 | Reforça operação responsável. |
| Painel de tools no admin | 4 | 3 | 3 | 3.3 | Depois de eventos reais. |
| Checklist de Credenciais | 3 | 4 | 4 | 3.7 | Mais ativação do que aquisição. |
| Validador de Copy | 3 | 3 | 3 | 3.0 | Cuidar de dados sensíveis. |

---

## 16. Recomendações finais

1. **Não comece por ferramenta complexa.** Comece por calculadora client-side, porque tem baixo risco técnico e alto valor percebido.
2. **Não gatear tudo.** Resultado básico deve ser livre para SEO, confiança e compartilhamento.
3. **Não pedir dados sensíveis.** A vantagem competitiva é ser seguro e responsável.
4. **Não medir só lead.** Medir ativação e pagamento assistido por ferramenta.
5. **Não abandonar as LPs atuais.** Usá-las como distribuição para as tools.
6. **Não vender “automação de spam”.** Vender rotina, cadência, logs, revisão e produtividade.
7. **Transformar ferramenta em onboarding.** O diagnóstico pré-cadastro deve reduzir tempo até o primeiro valor dentro do dashboard.

## 17. Próxima PR recomendada

Implementar **P0 — Calculadora de Tempo Perdido em Grupos de WhatsApp** com:
- rota pública `/ferramentas/calculadora-tempo-grupos-whatsapp`;
- hub `/ferramentas` simples;
- cálculo local;
- resultado parcial aberto;
- CTA para `/login?mode=register&source=tool_time_calculator`;
- metadata/JSON-LD;
- testes de build e lint;
- validação em staging na porta `3006`.

## 18. Base do repositório usada nesta auditoria

Esta auditoria foi feita a partir da leitura local do repositório, com foco nos seguintes pontos:

- `AGENTS.md`: regras canônicas de staging, produção, deploy, portas, banco, smoke tests e cuidados com image scrapers.
- `.codex/skills/free-tools/SKILL.md`: framework de ferramentas gratuitas, scorecard, princípios de lead capture, SEO e MVP.
- `package.json` e `dashboard/package.json`: scripts, stack da API, Prisma, Fastify, Next, React e testes disponíveis.
- `dashboard/app/page.js`, `dashboard/app/_lpShared.js` e `dashboard/app/_organicNicheLanding.js`: landing principal e estrutura de LPs programáticas.
- `dashboard/lib/marketing-content.js`: posicionamento, limitações, planos e FAQs centrais do produto.
- `dashboard/app/admin/marketing-growth/page.js`: maturidade atual do painel de Marketing & Growth e linguagem de confiabilidade de dados.
- `src/analytics.js`: eventos existentes e sanitização de metadata.
- `src/api/routes/public.js`, `src/api/routes/auth.js`, `src/api/routes/admin.js` e `src/api/routes/payments.js`: contratos públicos, autenticação, admin e monetização.
- `prisma/schema.prisma`: entidades principais que não devem sofrer breaking changes sem plano de migration.
- `docs/marketing/*` e `docs/analytics-funil-mvp.md`: histórico de SEO, IA/LLM optimization, growth, funil e planejamento de marketing.

Comandos principais usados para inspeção:

```bash
rg --files -g 'AGENTS.md' -g '!node_modules' -g '!dashboard/node_modules' -g '!**/.next/**' | sort
sed -n '1,240p' /workspace/wabot/.codex/skills/free-tools/SKILL.md
sed -n '1,220p' dashboard/AGENTS.md
rg --files dashboard/app -g '!**/.next/**' | sort
cat package.json
cat dashboard/package.json
sed -n '1,240p' dashboard/app/page.js
sed -n '1,260p' dashboard/lib/marketing-content.js
sed -n '1,260p' src/analytics.js
rg -n "register\(|app\.(get|post|put|delete|patch)\(" src/api src -g '!**/node_modules/**'
```
