# Auditoria profunda de popups, overlays e conversão — BOTinho

Data: 2026-05-15
Escopo: WABOT (`dashboard/`, `src/api/`, `prisma/`, `docs/marketing/`)
Skill aplicada: `popups` — foco em timing, valor, respeito ao usuário, segmentação, acessibilidade, frequência e mensuração.

## Protocolo STRICT de risco antes de qualquer implementação

1. **Erros fatais** — qualquer popup precisa ser client-side isolado, sem bloquear render server do Next, sem timers órfãos e sem listeners globais sem cleanup.
2. **Breaking changes** — não alterar contrato de `/api/auth/register`, `/api/admin/marketing/*`, schema de banco ou props de componentes públicos sem migração e validação em staging.
3. **Efeito cascata** — popups devem coexistir com `PublicShell`, landing principal, LPs programáticas, blog, materiais e login, sem encobrir fluxos críticos.
4. **Isolamento de ambiente** — toda validação deve passar por `develop` e staging `http://178.105.54.0:3006`; não tocar em `.env`, banco real ou produção.
5. **Bloqueio** — mudanças que adicionem eventos persistidos, cookies/localStorage de tracking, migrations ou fluxos de cadastro são P1+ e devem ser liberadas por feature flag.

## Sumário executivo

O BOTinho já tem boa base de aquisição orgânica: homepage, LPs por cidade/nicho/dor, blog, materiais e uma página promocional VIP. O gargalo é que a captura de intenção ainda está espalhada em CTAs e formulários estáticos, sem uma camada central de overlays/banners/slide-ins, sem regras de frequência, sem eventos persistidos de impressão/fechamento/conversão e com pouca diferenciação por contexto da página.

A recomendação não é “colocar popup em tudo”. O melhor caminho é criar um **sistema de prompts comportamentais respeitosos**:

- **Banners e slide-ins leves** para conteúdo e LPs orgânicas.
- **Modais apenas por clique** para materiais/checklists.
- **Exit intent só no desktop** e nunca em login, checkout, dashboard ou fluxos autenticados.
- **Bottom sheet mobile** com limite rígido de frequência, nunca interstitial full-screen antes do conteúdo.
- **Medição de funil** desde impressão até cadastro/ativação, com segmentação por campanha.

## Diagnóstico do estado atual

### 1. Aquisição pública existe, mas a captura está fragmentada

A homepage é uma landing completa com hero, definição do produto, funcionamento, recursos, prova social, preços, FAQ e CTA final. As LPs programáticas usam `PublicShell`, blocos de resposta direta, CTAs para lista VIP e links internos. O blog e os materiais ampliam o cluster SEO. Porém, o projeto não tem um componente central de popup/slide-in/banner para padronizar regras, copy, frequência, acessibilidade e tracking.

**Impacto:** cada nova captura tende a ser implementada de forma ad hoc, aumentando risco de inconsistência visual, irritação no mobile e dados incomparáveis.

**Melhoria proposta:** criar `dashboard/components/marketing/ConversionPrompt.jsx` e `dashboard/lib/conversion-prompts.js` como camada única de prompts, com props explícitas: `type`, `placement`, `trigger`, `audience`, `frequencyKey`, `cooldownDays`, `campaign`, `content`, `onImpression`, `onDismiss`, `onConvert`.

### 2. A isca digital já existe, mas se comporta como formulário estático

`LeadMagnetCard` oferece checklist, pede email e perfil de operação e envia para `/login?mode=register`. Isso é bom para intenção explícita, mas não mede impressão, foco, abandono, clique em PDF ou submissão por evento persistido.

**Impacto:** o admin marketing mede cadastro, checkout e pagamento, mas não sabe quantas pessoas viram a isca, quantas interagiram, quantas fecharam um prompt e quantas abandonaram antes do cadastro.

**Melhoria proposta:** transformar o card em fonte de dados padronizada:

- `lead_magnet_viewed`
- `lead_magnet_form_focused`
- `lead_magnet_submitted`
- `lead_magnet_pdf_clicked`
- `lead_magnet_online_clicked`

Esses eventos não precisam capturar email/telefone; bastam `origin`, `page_path`, `offer_id`, `variant`, `utm_campaign` e `segmento` sanitizado.

### 3. Analytics client-side não fecha o funil com o backend

`dashboard/lib/analytics.js` empurra eventos para `window.dataLayer` e dispara `CustomEvent`, mas não persiste eventos anônimos no backend. Já o backend registra eventos autenticados em `AnalyticsEvent`, mas a whitelist atual só cobre signup, login, WhatsApp conectado, credenciais, grupos, checkout, pagamento e envio.

**Impacto:** existe um buraco entre visita pública e cadastro. As recomendações de popups dependem de métricas de impressão, fechamento, interação e conversão por página; sem isso, qualquer melhoria vira opinião.

**Melhoria proposta P1:** adicionar endpoint público com baixa sensibilidade e rate limit para eventos anônimos:

- `POST /api/public/analytics` ou `POST /api/analytics/public`
- whitelist estrita: `popup_viewed`, `popup_dismissed`, `popup_cta_clicked`, `lead_magnet_submitted`, `banner_viewed`, `banner_dismissed`
- sanitização semelhante a `sanitizeAnalyticsMetadata`
- sem email, telefone, URL completa com query sensível, texto de mensagem ou cookies de autenticação.

### 4. Campanhas estão subaproveitadas no backend

No cadastro, o backend registra `source`, `ref` e `promo`, mas a maioria dos CTAs públicos usa UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) que podem se perder se não forem mapeados para metadata persistida. A listagem de campanhas no admin agrupa por `source` e `ref`, não por campanha/conteúdo.

**Impacto:** uma estratégia de popups por contexto não conseguirá provar quais páginas, variantes e ofertas geraram usuários ativados/pagantes.

**Melhoria proposta:** preservar UTMs no registro e no funil:

- No client, capturar UTMs em `sessionStorage` com expiração curta.
- No cadastro, enviar `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `landing_path`, `conversion_prompt_id`.
- No backend, salvar apenas valores sanitizados e curtos em `AnalyticsEvent.metadata`.
- No admin, agrupar campanhas por `utm_campaign` + `utm_content`, mantendo `source/ref` como fallback.

### 5. Não há regras de exclusão para usuários convertidos

Como não existe camada central de prompt, também não há regra única para esconder popups de usuários logados, recém-cadastrados, visitantes que recusaram ou usuários que já passaram por pagamento.

**Impacto:** risco de experiência irritante: mostrar “entrar na lista VIP” para quem acabou de criar conta, ou prompt de checklist em página de login/pagamento.

**Melhoria proposta:** política global:

- Nunca mostrar prompts em `/login`, `/dashboard/*`, `/admin/*`, `/dashboard/pagamento/*`, `/termos`, `/privacidade`.
- Se existe cookie/session/localStorage de `wb_prompt_converted=true`, ocultar prompts por 90 dias.
- Após dismiss, cooldown de 7 dias para banner e 14–30 dias para modal/slide-in.
- Uma única impressão de prompt por sessão.

### 6. Mobile precisa de proteção SEO/UX

As LPs orgânicas são importantes para SEO. Popups intrusivos no mobile podem degradar a experiência e violar boas práticas de interstitial. A skill `popups` recomenda bottom slide-ups e formatos pequenos no mobile.

**Impacto:** um modal central ou full-screen antes do conteúdo pode prejudicar conversão, rejeição e potencialmente SEO.

**Melhoria proposta:** no mobile, usar apenas:

- banner estático após primeiro bloco de conteúdo;
- bottom sheet pequeno após 50% de scroll;
- click-triggered modal para “baixar checklist”.

Nunca abrir prompt automático antes de 30s ou antes de interação/scroll.

### 7. Acessibilidade precisa ser requisito de PR

O projeto tem componentes de diálogo como `ConfirmDialog`, mas prompts de marketing ainda não existem como componente acessível. Qualquer modal deve ter foco gerenciado, `role="dialog"`, `aria-modal`, Escape, clique fora, botão fechar visível, touch target grande e retorno de foco ao elemento que abriu.

**Impacto:** popups sem acessibilidade criam regressão para teclado/leitor de tela e aumentam bounce.

**Melhoria proposta:** antes de qualquer prompt automático, criar testes manuais/automatizáveis de:

- Tab não sai do modal.
- Escape fecha.
- Fechar retorna foco.
- Botão de fechar tem label claro.
- Conteúdo continua acessível quando prompt não aparece.

### 8. O admin de marketing já aponta para growth, mas precisa medir prompts

Existe uma página admin de marketing growth que consome overview, campanhas, funil, data trust, cohorts e alerts. Ela é o lugar natural para incluir performance de prompts: impressões, taxa de interação, taxa de fechamento, conversão em cadastro, ativação e pagamento por variante.

**Impacto:** sem painel próprio, a equipe não saberá quando um popup incomoda mais do que converte.

**Melhoria proposta:** adicionar seção “Prompts de conversão” com:

- impressões por prompt;
- CTA clicks;
- dismiss rate;
- conversão signup/impression;
- ativação em 7 dias por prompt;
- ranking de páginas onde o prompt ajuda vs atrapalha.

Observação de qualidade: há duplicidade de `setUsers(...)` no carregamento inicial do admin marketing. Não é fatal, mas é sinal de dívida técnica e deve entrar em limpeza antes de expandir a página.

## Estratégia recomendada de prompts

### Prompt 1 — Banner de prova/segurança na homepage

- **Tipo:** announcement banner não-intrusivo.
- **Trigger:** renderizar após o hero, sem overlay.
- **Targeting:** visitantes novos da homepage.
- **Frequência:** uma vez por sessão; se fechado, 7 dias.
- **Copy sugerida:**
  - Headline: `Teste o BOTinho com uma rotina segura antes de escalar grupos.`
  - Subhead: `Configure poucos grupos, valide links e acompanhe os primeiros envios.`
  - CTA: `Ver planos de teste`
  - Decline: `Agora não`
- **Métrica principal:** clique para planos/cadastro sem aumento de bounce.

### Prompt 2 — Slide-in de checklist nas LPs de dor/nicho

- **Tipo:** slide-in desktop; bottom sheet mobile.
- **Trigger:** 50% de scroll ou 45s de permanência, o que ocorrer primeiro.
- **Targeting:** LPs programáticas e artigos, exceto visitantes que já clicaram em cadastro.
- **Frequência:** uma vez por 14 dias por oferta.
- **Copy sugerida:**
  - Headline: `Quer padronizar sua operação antes de automatizar?`
  - Subhead: `Baixe o checklist de 1 página para revisar copy, link, horário, grupos e métrica.`
  - CTA: `Receber checklist`
  - Decline: `Continuar lendo`
- **Métrica principal:** `lead_magnet_submitted / popup_viewed` e signup em 7 dias.

### Prompt 3 — Modal click-triggered para materiais

- **Tipo:** modal aberto apenas quando o usuário clica em “baixar PDF”.
- **Trigger:** clique do usuário; zero popup automático.
- **Targeting:** páginas `/materiais/*` e cards de lead magnet.
- **Frequência:** sem limitação se acionado por clique, mas lembrar email/segmento preenchido só se houver consentimento claro.
- **Copy sugerida:**
  - Headline: `Enviar o checklist e liberar o PDF`
  - Subhead: `Você recebe o material e entra na lista VIP de testes do BOTinho.`
  - CTA: `Liberar meu checklist`
  - Decline: `Ver versão online`
- **Métrica principal:** conclusão do formulário.

### Prompt 4 — Exit intent desktop em páginas de preço/home

- **Tipo:** exit intent leve no desktop.
- **Trigger:** cursor em direção ao topo/fechar após pelo menos 30s e uma rolagem.
- **Targeting:** homepage, pricing section, LPs de alta intenção; nunca mobile.
- **Frequência:** uma vez a cada 30 dias.
- **Copy sugerida:**
  - Headline: `Antes de sair: teste com poucos grupos primeiro.`
  - Subhead: `Entre na lista VIP e valide se sua operação ganha tempo antes de contratar.`
  - CTA: `Entrar na lista VIP`
  - Decline: `Sair sem testar`
- **Métrica principal:** signup incremental sem aumento relevante de close imediato.

### Prompt 5 — Prompt pós-login orientado à ativação, não marketing

- **Tipo:** checklist in-app/slide-in no dashboard.
- **Trigger:** usuário novo sem WhatsApp conectado ou sem credenciais.
- **Targeting:** autenticados em trial.
- **Frequência:** até concluir tarefa; minimizar em vez de bloquear.
- **Copy sugerida:**
  - Headline: `Falta pouco para o primeiro envio funcionar.`
  - Subhead: `Conecte WhatsApp, escolha grupos e salve credenciais para validar sua rotina.`
  - CTA: `Continuar configuração`
  - Decline: `Lembrar depois`
- **Métrica principal:** `whatsapp_connected`, `credential_saved`, `first_send_success`.

## Backlog priorizado

### P0 — Sem migration, baixo risco, alto aprendizado

1. **Documento de política de prompts**
   Criar guidelines internas: páginas permitidas, cooldown, acessibilidade, mobile, copy e eventos. Este documento já inicia essa política.

2. **Auditoria de CTAs públicos**
   Mapear todos os CTAs para `/login?mode=register` e garantir UTMs consistentes. Hoje há variação de `source`, `utm_campaign`, `utm_content` e ref.

3. **Limpar duplicidade no admin marketing**
   Remover o `setUsers` duplicado no carregamento inicial para reduzir ruído antes de adicionar novas métricas.

4. **Adicionar eventos client-side não persistidos para prompts futuros**
   Expandir `TRACKING_EVENTS` com nomes padronizados, ainda sem backend, para permitir testes via `dataLayer` e `wabot:track`.

### P1 — Com backend/analytics, exige staging completo

1. **Endpoint público de analytics anônimo**
   Persistir eventos de prompt sem dados pessoais. Adicionar rate limit e whitelist.

2. **Componente central de prompt**
   Implementar `ConversionPrompt` com acessibilidade, timers com cleanup, scroll listener passivo, Escape, focus trap, outside click e frequency capping.

3. **Persistência de UTMs no cadastro**
   Enviar UTMs/session attribution para `/register`, sem quebrar o contrato atual. O backend deve aceitar campos opcionais.

4. **Admin “Prompts de conversão”**
   Criar endpoints e cards para performance por prompt/variant.

### P2 — Otimização e experimentos

1. **A/B testing por variante**
   Randomização client-side estável por `localStorage`, com variantes `control`, `slidein_checklist`, `exit_intent_vip`.

2. **Personalização por página**
   LP de cidade: promessa de rotina local; LP de nicho: promessa específica do segmento; blog: checklist educacional.

3. **Sequência pós-captura**
   Após `lead_magnet_submitted`, redirecionar para cadastro com campos pré-preenchidos e contexto do material.

4. **Alertas de dano**
   Alertar quando dismiss rate > 70%, time-to-close < 2s ou signup/impression cair abaixo de benchmark.

## Hipóteses de teste

1. **Slide-in no conteúdo vs CTA estático**
   Hipótese: slide-in após 50% de scroll aumenta leads em 20–40% sem reduzir signup rate.

2. **Checklist operacional vs lista VIP genérica**
   Hipótese: oferta concreta de checklist converte melhor em blog/LPs informativas que “Entrar na lista VIP”.

3. **Exit intent em desktop vs nenhum exit intent**
   Hipótese: exit intent recupera 2–5% dos visitantes de alta intenção sem afetar mobile.

4. **CTA em primeira pessoa**
   Testar `Receber meu checklist` contra `Receber checklist e entrar na lista VIP`.

5. **Segmento obrigatório vs opcional**
   Hipótese: deixar `segmento` opcional aumenta submissão, mas reduz qualificação. Medir MQL/lead, não só volume.

## Métricas mínimas por prompt

- `prompt_id`
- `variant`
- `page_path`
- `placement`
- `trigger`
- `device_class`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `viewed_at`
- `dismissed_at`
- `cta_clicked_at`
- `converted_signup_user_id` quando houver cadastro

Não registrar: email, telefone, mensagens de WhatsApp, URL final com parâmetros sensíveis, cookies, token, senha, credenciais de afiliado.

## Critérios de aceite para primeira implementação real

1. Build do dashboard passa em staging.
2. Prompt não aparece em `/login`, `/dashboard/*`, `/admin/*`, `/termos`, `/privacidade`.
3. Mobile não recebe modal automático central/full-screen.
4. Escape fecha modal/slide-in; foco retorna corretamente.
5. Fechamento fica salvo em localStorage com cooldown.
6. Eventos não incluem PII.
7. Admin mostra pelo menos impressões, CTA clicks e dismiss rate.
8. Smoke test de login continua retornando JSON no proxy correto.

## Plano de implantação seguro

1. Abrir branch `codex/conversion-prompts-audit` a partir de `develop`.
2. Entregar primeiro apenas instrumentação client-side e componente desativado por feature flag.
3. Validar em staging na porta `3006` com flag ligada só localmente/staging.
4. Medir por 7 dias com baixo tráfego ou tráfego interno.
5. Ativar em uma família de páginas: blog + materiais.
6. Só depois expandir para LPs programáticas e homepage.
7. Produção somente após confirmar que signup, login, pagamento e dashboard não tiveram regressão.

## Crítica final

O projeto está forte em SEO e oferta, mas ainda fraco em **orquestração de conversão**. O maior ganho virá de tratar popups como produto — com regras, acessibilidade, segmentação e métrica — e não como “caixinhas” visuais. A abordagem correta para o BOTinho é conservadora: prompts úteis, atrasados, contextuais, fáceis de fechar e mensurados de ponta a ponta até ativação real (`first_send_success`), não apenas cadastro.
