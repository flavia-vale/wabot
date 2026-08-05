# Parceria com influenciadores afiliados — plano de implementação

Data: 2026-08-04
Owner: Growth/Parcerias
Oferta: **robô grátis para o parceiro + 30% de comissão recorrente** sobre todo
usuário que chegar pelo link/código dele.

---

## 0. O que já existe no produto (não precisa construir)

O programa de afiliados **já está implementado e ligado**. Isso muda o plano:
não é um projeto de engenharia, é um projeto de operação + conteúdo.

| Peça | Onde | Estado |
|---|---|---|
| Código/link do afiliado | `AffiliateProfile.code`, link `?ref=<código>` | pronto |
| Comissão 30% inicial **e 30% recorrente** | `AffiliateSettings.commissionPercent` / `commissionRecurringPercent` (default 30, `recurringCommissionEnabled=true`) | pronto |
| Comissão diferente para um parceiro específico | `commissionPercentOverride` / `commissionRecurringPercentOverride` no perfil | pronto |
| Atribuição (cookie 24h, janela 30 dias, last-non-direct) | `AffiliateSettings` | pronto |
| Carência antes de liberar o saque (30 dias) | `commissionHoldDays` | pronto |
| Saque self-service via PIX (mín. R$50) | `AffiliatePayoutRequest`, `minPayoutCents=5000` | pronto |
| Painel do afiliado + painel admin de afiliados | `/painel`, `/admin/afiliados` | pronto |
| Página pública do programa | `/programa-de-afiliados` | pronto |
| Dar robô grátis | admin → alterar plano (`pro`) + `accessExpiresAt` + `reason` | pronto |

**Lacunas reais (o que falta construir):** ver seção 4.

---

## 1. Economia da oferta (números, não achismo)

Preço vigente: Basic **R$39/mês**, Pro **R$69/mês** (`dashboard/lib/marketing-content.js`).

| Item | Basic | Pro |
|---|---:|---:|
| Receita bruta/mês por indicado | R$39,00 | R$69,00 |
| Taxa Mercado Pago (~4,99%) | −R$1,95 | −R$3,44 |
| Comissão do parceiro (30%) | −R$11,70 | −R$20,70 |
| **Sobra por indicado/mês** | **R$25,35** | **R$44,86** |
| Custo de infra por sessão (~0,35 GB) | ~−R$2,00 | ~−R$2,00 |
| **Margem líquida/mês** | **~R$23** | **~R$43** |

**Custo do robô grátis do parceiro:** ~R$2/mês de infra (uma sessão). Ou seja,
**o parceiro se paga com o primeiro indicado**. Isso torna a cortesia barata —
o risco não é financeiro, é de reputação (parceiro que usa o robô grátis e nunca
divulga, e depois reclama publicamente).

**Regra de sustentação da cortesia (obrigatória no acordo):**
- Cortesia inicial: **plano Pro por 90 dias**, sem contrapartida.
- Renovação automática por mais 90 dias enquanto houver **≥ 2 indicados pagantes
  ativos**. Abaixo disso, o parceiro migra para 50% de desconto (não corta seco —
  cortar seco cria detrator).
- A comissão de 30% recorrente **nunca** depende da cortesia: ela é permanente
  enquanto o indicado pagar.

**Limite honesto:** 30% recorrente + taxa MP + infra deixa ~R$43 de margem no Pro.
Não dá para subir para 40-50% recorrente sem mexer no preço.

**Decisão da fundadora (2026-08-05): a oferta é única e não se negocia.** 30%
recorrente para todo mundo, sem percentual diferenciado por parceiro e **sem
bônus por volume**. Se um parceiro grande pedir mais, a resposta é não — dita com
educação e sem contraoferta. Motivo: oferta única é simples de explicar, não cria
parceiro de primeira e de segunda classe, e não abre precedente de negociação que
depois vira régua para todos. **Não reintroduzir bônus nem percentual variável
sem pedido explícito dela.**

---

## 2. Quem é o alvo certo (e quem parece alvo mas não é)

Existem dois públicos parecidos que convertem de forma completamente diferente:

| Perfil | Audiência dele | Converte? |
|---|---|---|
| **Educador de afiliação** (mentoria, curso, "como ser afiliado Shopee") | pessoas que **querem ganhar dinheiro como afiliado** | ✅ **alvo principal** — a audiência é exatamente o nosso ICP |
| **Curador de achadinhos** (posta oferta para consumidor final) | pessoas que **querem comprar barato** | ⚠️ alvo secundário — a audiência não compra ferramenta; mas o curador **em si** é cliente e pode virar afiliado do próprio nicho |

Erro a evitar: gastar a primeira onda nos perfis de achadinhos com 100 mil
seguidores. Seguidor de achadinho não vira usuário de robô. Um educador com 8 mil
seguidores de afiliados vale mais que um curador com 200 mil de consumidor.

O repositório já tem **200 leads de curadores** mapeados
(`docs/marketing/instagram_profiles_leads_lote1/` e
`docs/marketing/dia8_cold_outreach_parceiros/`) — esses entram como **Tier 3**
desta campanha, reaproveitados, não descartados.

Isso também casa com o dado real de keywords (`ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`):
a demanda está em `shopee afiliados` / `mercado livre afiliados` (50.000/mês,
concorrência baixa), não em `bot para grupo whatsapp` (500/mês, concorrência alta).
**Parceria com educador de afiliação é o atalho para exatamente esse público**,
sem esperar 6 meses de SEO.

---

## 3. Estrutura da campanha

### 3.1 Tiers de parceiro

| Tier | Quem | Oferta |
|---|---|---|
| **Embaixador** (até 5 no primeiro ciclo) | educador com audiência engajada de afiliados | Pro grátis 12 meses + 30% recorrente + call de onboarding com a fundadora + material co-branded |
| **Parceiro** | educador/criador menor, curador grande | Pro grátis 90 dias (renovável) + 30% recorrente |
| **Afiliado padrão** | qualquer pessoa | 30% recorrente (programa público, já no ar) |

### 3.2 Funil e metas do primeiro ciclo (90 dias)

| Etapa | Meta |
|---|---|
| Alvos contatados | 60 |
| Respostas | 18 (30%) |
| Reuniões/call | 9 |
| Parceiros ativados (com link gerado) | 6 |
| Embaixadores | 2 |
| Indicados pagantes vindos de parceiro | 25 |
| MRR novo | ~R$1.400 |
| Comissão paga | ~R$420/mês |

Estas metas são **hipótese de trabalho**, não previsão — não existe histórico de
outreach convertido no repo para calibrar. Recalibrar após os 20 primeiros contatos.

### 3.3 Cronograma

| Semana | Entrega |
|---|---|
| **S1** | Lacunas de produto (seção 4): LP `/parceiro-influenciador`, kit de mídia, termos da cortesia, processo de cortesia no admin |
| **S2** | Onda 1 de outreach: 20 alvos Tier 1 (educadores), DM manual, 5/dia |
| **S3** | Follow-up D+3 e D+7 da onda 1 + onda 2 (20 alvos) |
| **S4** | Calls, ativação dos primeiros parceiros, entrega do kit |
| **S5-S8** | Onda 3 (Tier 3, curadores do lote existente) + primeiro conteúdo co-produzido |
| **S9-S12** | Medição, corte dos parceiros inativos, renovação dos ativos |

Cadência de disparo: **máximo 5 DMs/dia por conta**, manual. Instagram bloqueia
conta nova que dispara em volume — e queimar o perfil da marca custa mais do que
o ganho de velocidade.

---

## 4. Lacunas de produto — o que precisa ser construído

Ordem de prioridade. Nada aqui é bloqueante para começar o outreach **exceto o P0**.

### P0 — antes da onda 1 (S1)

1. **LP dedicada `/parceiro-influenciador`** (Next, `dashboard/app/parceiro-influenciador/page.js`)
   Conteúdo: a oferta em 3 linhas, calculadora simples ("10 indicados = R$207/mês
   recorrente"), prova (o que o robô faz), FAQ (quando recebo, como recebo, e se
   o indicado cancelar), CTA para formulário/WhatsApp.
   Registrar em `dashboard/lib/seo-registry.mjs` para entrar no sitemap/IndexNow.
2. **Termos da cortesia** — aditivo em `/programa-de-afiliados` ou página própria:
   o que é a cortesia, por quanto tempo, qual a contrapartida, o que acontece se
   não houver indicados. Sem isso, cortar a cortesia de alguém vira briga pública.
3. **Processo de cortesia no admin** — não precisa de código novo: usar a rota
   existente de alteração de acesso com `plan=pro`, `expiresAt=+90d` e
   `reason="parceiro-influenciador:<código>"`. O `reason` é o que permite auditar
   depois quantas cortesias existem. **Padronizar esse texto é obrigatório.**

### P1 — durante a onda 1 (S2-S3)

4. **Kit de mídia do parceiro** (`docs/marketing/parceria_influenciadores/kit/`):
   3 criativos de story, 1 carrossel, 1 roteiro de vídeo de 60s, 5 legendas
   prontas, logo em PNG/SVG. Parceiro que precisa criar material do zero não posta.
5. **Link com atribuição completa** — o parceiro deve receber pronto:
   `https://espelhagrupos.com.br/?ref=<CÓDIGO>&utm_source=<handle>&utm_medium=influencer&utm_campaign=parceria-influenciador-2026q3`.
   Hoje o painel entrega o `?ref=`; montar as UTMs à mão em cada convite é fonte
   de erro. Vale um gerador simples no painel do afiliado.
6. **Cupom de primeira mensalidade** para a audiência do parceiro (ex.: 20% off
   no 1º mês). Aumenta muito a conversão do público dele e não mexe na recorrência.

### P2 — depois dos primeiros parceiros ativos (S5+)

7. **Dashboard do parceiro com dado de funil** — hoje ele vê comissão; falta ver
   cliques → cadastros → pagantes. Sem isso o parceiro não sabe se o conteúdo dele
   funcionou e para de postar.
8. **Segundo nível de atribuição** (parceiro indica outro parceiro) — só se
   pedirem. Não construir preventivamente.
9. **Relatório mensal automático por e-mail** para o parceiro (usa
   `src/email/mailer.js`, que já existe e é no-op sem SMTP).

### Não fazer

- ❌ Não criar tabela nova de "parceiro". O `AffiliateProfile` + `commissionPercentOverride`
  + `adminNotes` já cobrem. Schema novo = migration = pegadinha #8 sem necessidade.
- ❌ Não automatizar envio de DM no Instagram. Queima o perfil e é contra os termos
  da plataforma. Outreach é manual ou via CRM aprovado — mesma regra já registrada
  nos lotes anteriores de outreach deste repo.
- ❌ Não prometer "não bane" em nenhum material do parceiro. Limite já registrado
  no `AGENTS.md`: entrar pela dor de banimento é permitido, prometer imunidade não.

---

## 5. Riscos e como conter

| Risco | Contenção |
|---|---|
| Parceiro pega o robô grátis e some | Cortesia de 90 dias com renovação condicionada; revisão mensal do `reason=parceiro-influenciador` no admin |
| Parceiro promete o que o robô não faz ("posta sozinho e não bane") | Cláusula nos termos + kit de mídia com copy aprovada; é mais fácil dar a frase pronta do que corrigir depois |
| Auto-indicação (parceiro cria conta com o próprio link) | Já existe antifraude: `pixMatchesReferredUser` compara a chave PIX do afiliado com a do indicado |
| Custo de RAM se muitos parceiros ativarem sessão de cortesia | ~0,35 GB por sessão. 10 cortesias = ~3,5 GB. **Isso estoura o VPS atual.** Antes de passar de ~5 cortesias simultâneas, dimensionar RAM — regra da "Política de memória" do `AGENTS.md` |
| Concorrente copia a oferta | Já existem 8+ ferramentas no nicho (ProAfiliados, FluxoPromo, DivulgaLinks, Hub do Afiliado, DivulgaNinja…). Diferencial defensável não é o percentual, é a preservação de sessão/anti-queda — que é onde o produto tem engenharia real |

⚠️ **Sinalização de memória (regra #1 do `AGENTS.md`):** cada parceiro com robô
grátis é **uma sessão WhatsApp adicional em produção (~0,35 GB)**. 5 parceiros =
~1,75 GB extra. O VPS tem 3,7 GB com base fixa de ~2 GB. **Não ativar mais de 3-4
cortesias simultâneas sem antes decidir sobre RAM adicional.** Alternativa mais
leve: dar a cortesia mas escalonar as ativações (parceiro ativa quando for gravar
o conteúdo), e desligar staging enquanto isso.

---

## 6. Medição

| Métrica | Onde | Frequência |
|---|---|---|
| Cliques por parceiro | `AffiliateAttributionTouch` / `?ref=` | semanal |
| Cadastros por `ref` | `User` + atribuição | semanal |
| Indicados pagantes e MRR por parceiro | painel `/admin/afiliados` | mensal |
| Comissão gerada vs. paga | `AffiliateCommission` | mensal |
| Custo por aquisição via parceiro | comissão + cortesia ÷ pagantes | mensal |
| Parceiros ativos (postaram nos últimos 30d) | manual, planilha de CRM | mensal |

**Critério de sucesso do ciclo (90 dias):** ≥ 15 indicados pagantes vindos de
parceiros e CAC via parceria menor que o CAC de tráfego pago. Se falhar, o
problema quase sempre é o Tier escolhido (curador em vez de educador), não o
percentual da comissão — testar o Tier antes de mexer na oferta.

---

## Arquivos desta campanha

- `docs/marketing/parceria_influenciadores/alvos_lote1.csv` — alvos com canal de contato
- `docs/marketing/parceria_influenciadores/mensagens_outreach.md` — mensagens prontas
