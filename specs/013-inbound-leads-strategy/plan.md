# Implementation Plan: Estratégia de leads inbound — clique, indexação e ativação

**Branch**: `claude/inbound-leads-strategy-yqtajg` (branch já existente — **não criar nem trocar**; PR contra `develop`, nunca `main`)

**Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-inbound-leads-strategy/spec.md`

---

## Summary

Converter impressões já conquistadas em cliques (P1), destravar o racionamento de rastreamento
antes de publicar qualquer coisa nova (P2), avisar no painel quem parou na etapa da credencial
(P3), e só então reforçar autoridade e abrir conteúdo novo (P4, P5, P6).

A investigação de código mudou três coisas em relação ao que a spec supunha:

1. **O `noindex` não existe em lugar nenhum, e ligar a ponta quebra um portão hoje verde.**
   `guard-seo-registry-coverage.mjs` exige que toda rota pública esteja em
   `getIndexableSeoRoutes()` — a primeira rota marcada `indexable: false` reprova o guard.
   O ajuste desse guard é **pré-requisito** de P2, não consequência.
2. **A regra dos 55 caracteres, como escrita, é impossível e se contradiz.** O sufixo do
   template tem 17 caracteres; 55 "contando o sufixo" deixa 38 para o texto, e a própria
   página-modelo que FR-005 proíbe reescrever entrega 73. O plano redefine o que é medido
   (R2 do `research.md`) — **revisão de Assumption que precisa do seu aval**.
3. **Título e descrição já moram em dois lugares e já divergiram** — o registry serve o título
   antigo de `/bot-achadinhos-whatsapp` (66 chars) enquanto o ar serve o novo (56). FR-001
   deixa de ser "manter organizado" e vira conserto de bug silencioso.

Nada disso exige processo novo, dependência nova ou cache novo: **consumo de memória
inalterado** (detalhe em [Política de memória](#política-de-memória)).

---

## Technical Context

**Language/Version**: Node.js (ESM) na raiz; React 19 + Next.js 16.2.4 (App Router) em `dashboard/`

**Primary Dependencies**: Fastify (API), Prisma + SQLite (WAL), Next.js. **Nenhuma dependência nova.**

**Storage**: SQLite existente. **Nenhuma migration, nenhuma coluna nova, nenhuma tabela nova.**
A feature só lê `MessageLog` e `Credential`.

**Testing**: `node:test` na raiz (`npm test`) + seis validadores em `dashboard/scripts/`

**Target Platform**: VPS Linux, PM2 (`api`/`dashboard` em prod, `api-staging`/`visual-staging` em staging)

**Project Type**: aplicação web (API Fastify + dashboard Next.js), monorepo com raiz + `dashboard/`

**Performance Goals**: nenhuma meta nova de latência. A única rota nova faz **uma** consulta
indexada por chamada (`@@index([userId, status, sentAt])`), sem poll e sem cache.

**Constraints**:
- `FR-035` — nenhuma alteração de `.env` ou banco de produção
- `FR-036` — nenhuma mudança que aumente memória sem aviso e OK prévio
- Nenhuma frente de SEO congelada por dado pode ser reaberta (`AGENTS.md`)
- Linguagem leiga obrigatória em toda superfície da cliente

**Scale/Scope**: ~11 títulos reescritos, ~36 rotas de grade sob triagem de indexação, 1 rota de
API nova, 1 componente de painel, 2 páginas de conteúdo novas, 4 arquivos de teste novos.

---

## Constitution Check

*GATE: antes da Fase 0 e de novo depois da Fase 1.*

`.specify/memory/constitution.md` está **em branco** (template não preenchido: `[PRINCIPLE_1_NAME]`
etc.). A constituição de fato deste repositório é o **`AGENTS.md` da raiz**, que a própria spec
cita como fonte canônica. Portões avaliados contra ele:

| Portão do `AGENTS.md` | Situação | Evidência |
|---|---|---|
| Fluxo `feature → develop → main`, sem branch nova | **PASSA** | trabalho na branch existente; PR contra `develop` |
| Nunca `main` direto, nunca amend em commit mergeado | **PASSA** | — |
| **Política de memória (regra #1: super sinalizar)** | **PASSA** | nenhum processo, dependência, cache ou concorrência novos — ver seção própria |
| Política de memória (regra #2: alternativa mais leve) | **PASSA** | rota sem cache e sem poll escolhida no lugar de pendurar agregação no poll de 10 s |
| Não trocar portas | **PASSA** | não se aplica |
| Não mexer em `.env`/banco de produção | **PASSA** | FR-035; sem migration |
| Linguagem leiga na tela da cliente | **PASSA com guard novo** | `test/painel-aviso-credencial.test.js` |
| Texto da Shopee é o **oposto** do de ML/Amazon | **PASSA com guard novo** | constantes separadas + teste que reprova a fusão |
| Linhas de SEO congeladas por dado | **PASSA com guard novo** | `test/marketing-limites-que-nao-se-cruzam.test.js` |
| Nunca prometer que não banem | **PASSA com guard novo** | idem |
| Preço de concorrente só com fonte e data | **PASSA com guard novo** | casado contra `competitors-data.js` |
| Migration DDL exige parar PM2 (pegadinha #8) | **N/A** | sem migration |

**Nenhuma violação.** A tabela de Complexity Tracking fica vazia de propósito.

**Recheck pós-Fase 1**: os artefatos de design (`research.md`, `data-model.md`, `contracts/`,
`quickstart.md`) não introduziram processo, dependência, cache, migration nem alteração de
ambiente. **Portões seguem passando.**

---

## Decisões que revisam a spec (precisam do seu aval)

A spec autoriza revisar as "Assumptions" nesta fase. Duas foram revisadas e **uma terceira
confirmada com reforço**:

### D1 — O que exatamente cabe em 55 caracteres  *(revisa a Assumption "Medição de 55 caracteres")*

**Assumption original:** contar o texto final entregue ao buscador, já com o sufixo automático.

**Problema medido:** o sufixo `' | Espelha Grupos'` tem 17 caracteres. Isso deixa 38 para o
texto da página. Nenhuma das quatro páginas que hoje convertem cabe em 38, e
`/bot-achadinhos-whatsapp` — a página-modelo que FR-005 **proíbe** reescrever — tem 56 de texto
e 73 entregues. Aplicar a regra ao pé da letra reprovaria o próprio modelo que a spec manda
seguir.

**Decisão:** o orçamento de 55 vale sobre **a parte do título que a página escreve**. O sufixo é
calculado, mostrado na mensagem de falha, e fica fora do orçamento — porque é anexado no fim e
é a primeira coisa que o Google corta no celular. Manter o sufixo é decisão de marca já
canônica; a alternativa que tornaria os 55 literais seria trocar as 11 páginas para
`title.absolute`, apagando a marca das páginas mais vistas do site.

Escopo: as 11 páginas de FR-004 (que estão sendo escritas agora) em ≤ 55.
`/bot-achadinhos-whatsapp` fica com o teto de 60 que já tem — **sem afrouxar nada existente**.

### D2 — Critério de triagem de indexação  *(revisa a Assumption "Critério de triagem")*

**Assumption original:** "gerada por modelo, sem intenção própria, zero impressão em 3 meses".

**Problema:** o dado de impressão por página vive no Search Console, fora do repositório. Um
critério que nenhum teste consegue verificar não vira guard e não é auditável em revisão.

**Decisão:** critério em duas partes — a parte medível no código (`template: 'programmatic-lp'`
sem conteúdo exclusivo declarado) vira guard; a parte medível fora (zero impressão em 3 meses)
vira registro escrito por página, com a data da consulta, em `triagem-indexacao.md` (FR-012).
Página com qualquer impressão ou intenção própria é **engordada, não retirada**.

### D3 — Página de comparação = Achadinho Pro  *(Assumption CONFIRMADA, com motivo mais forte)*

Além da evidência de demanda que a spec já citava, os dados dele **já estão coletados com fonte
e data** em `dashboard/lib/competitors-data.js` (`verifiedAt: '2026-07-31'`, `source`: print da
página de preços). A página nasce cumprindo FR-031 sem coleta nova — o que não vale para os
outros cinco concorrentes da fila.

---

## Project Structure

### Documentation (this feature)

```text
specs/013-inbound-leads-strategy/
├── plan.md                      # este arquivo
├── spec.md
├── research.md                  # Fase 0 — decisões com evidência de código
├── data-model.md                # Fase 1 — entidades (nenhuma nova)
├── contracts/
│   ├── credential-block-alert.md   # rota nova do painel (P3)
│   └── seo-robots.md               # helper de não-indexar + guards (P2)
├── quickstart.md                # Fase 1 — como validar cada entrega
├── triagem-indexacao.md         # criado na execução de P2 (FR-012, FR-013)
├── checklist-comparativos.md    # criado na execução de P5 (FR-026)
└── tasks.md                     # Fase 2 — NÃO criado por /speckit-plan
```

### Source Code (repository root)

```text
dashboard/
├── lib/
│   ├── seo-registry.mjs                 # P1: fonte única de título; P2: getSeoRoute/buildSeoRobots/getAllSeoRoutes
│   ├── competitors-data.js              # P5: dado de Achadinho Pro (já existe, verificado)
│   └── painel/logsCopy.js               # P3: explainErrorMsg passa a nomear a loja e o próximo passo
├── app/
│   ├── layout.js                        # (só leitura) origem do sufixo ' | Espelha Grupos'
│   ├── _lpShared.js                     # P2: chokepoint das 36 páginas de grade
│   ├── _seoHubShared.js                 # P2: chokepoint dos hubs
│   ├── _preservationCommercialPages.js  # P1 título/descrição; P2 robots
│   ├── _comparisonContent.js            # P1 título/descrição; P2 robots; P5 entrada Achadinho Pro
│   ├── alternativas/achadinho-pro/      # P5: página nova (uma só)
│   └── blog/…shopee…/                   # P6: guia Tier 1 (Shopee)
├── components/ActivationChecklist.js    # P3: aviso na tela inicial E no checklist (um componente, dois pontos)
└── scripts/
    ├── guard-seo-registry-coverage.mjs  # P2: base vira getAllSeoRoutes() — ANTES de marcar qualquer página
    ├── validate-seo-consistency.mjs     # P2: checagem nova de robots emitido
    └── lint-seo-metadata-duplicates.mjs # P1: parser estendido + regra de fonte única

src/
├── api/routes/logs.js                   # P3: GET /logs/credential-block
├── credentialBlockAlert/message.js      # P3: módulo PURO — textos separados por loja
├── credentialHealth.js                  # (só leitura) vocabulário leigo canônico
└── credentialExpiry/message.js          # (só leitura) referência da inversão da Shopee

test/
├── inbound-titulos-clique.test.js            # P1
├── seo-noindex-guard.test.js                 # P2
├── painel-aviso-credencial.test.js           # P3
└── marketing-limites-que-nao-se-cruzam.test.js  # limites FR-029..FR-034
```

**Structure Decision**: monorepo existente, sem diretório novo. O conteúdo de marketing e a
metadata vivem em `dashboard/`; a regra de negócio do aviso (texto por loja) vive em `src/` como
módulo puro, seguindo o precedente de `src/credentialExpiry/message.js` — é o que permite testar
a inversão da Shopee sem banco e sem SMTP.

---

## Ordem de execução (dependência, não preferência)

```
P1 clique ──> P2 indexação ──> P3 ativação ──> P4 autoridade ──> P5 comparação ──> P6 Tier 1
                   │                                                 ▲                ▲
                   └──────────────── bloqueia (FR-014) ──────────────┴────────────────┘
```

| Fase | Entrega | Depende de | Portão de saída |
|---|---|---|---|
| **P1** | 11 títulos + descrições reescritos; fonte única de metadata | — | `test/inbound-titulos-clique.test.js` + `lint:seo-metadata` |
| **P2** | `buildSeoRobots` ligado; guard de cobertura ajustado **primeiro**; triagem escrita | P1 (mesmo arquivo) | `robots` no HTML servido + `validate:seo-consistency` + `guard:seo-registry` |
| **P3** | rota `/logs/credential-block` + aviso no painel + histórico com texto por loja | — (independente) | `test/painel-aviso-credencial.test.js` + teste manual em staging |
| **P4** | `/bot-afiliados-whatsapp` responde as 4 perguntas de decisão; nenhuma página nova | — | revisão de conteúdo + guard de limites |
| **P5** | **uma** página `/alternativas/achadinho-pro` + checklist da fila | **P2** | página no índice em ≤14 dias (SC-011) antes da próxima |
| **P6** | guia Tier 1 da Shopee, produto só no fim | **P2** | `validate:editorial-freshness` + guard de limites |

**Por que P1 antes de P2:** os dois mexem em `seo-registry.mjs`. Fazer os títulos primeiro e o
campo de indexação depois evita conflito no mesmo bloco.

**Por que P4 não é bloqueado por P2:** reforça página existente e não cria rota (FR-024).

---

## Política de memória

> **A entrega é texto, metadados e uma tela de aviso. Consumo de RAM inalterado.**

| Item | Custo |
|---|---|
| Títulos e descrições reescritos | zero |
| `buildSeoRobots()` + campo `indexable` | zero (função pura, build-time) |
| Páginas novas (1 comparação + 1 guia) | zero em RAM de processo (Next estático) |
| `GET /logs/credential-block` | **zero permanente** — 1 consulta indexada por chamada, **sem cache**, sem estrutura em memória |
| `src/credentialBlockAlert/message.js` | desprezível (constantes de texto) |
| Guards e testes | só CI |

**Nenhum processo PM2 novo. Nenhuma dependência nova. Nenhum cache novo. Nenhuma mudança de
concorrência.** A alternativa mais leve foi escolhida deliberadamente: a rota é chamada no
mount e no `focus`, **não** entra no poll de 10 s do `ActivationChecklist`, e **não** replica o
`summaryCache` de `logs.js` (que é um `Map` sem despejo — replicá-lo adicionaria vazamento sem
necessidade).

> ### 🚩 Itens que EXIGEM aviso prévio e OK explícito da usuária antes de executar
>
> Se a execução cogitar qualquer um destes, **para e pergunta primeiro**, com estimativa de RAM:
>
> 1. Pendurar a agregação de bloqueios no poll de 10 s do `/dashboard/status` (multiplica
>    consulta por cliente com o painel aberto).
> 2. Criar cache em memória para o aviso de credencial (segundo `Map` sem despejo).
> 3. Qualquer dependência nova no `dashboard/` para gerar metadata ou schema.
> 4. Qualquer processo, worker ou cron novo para varrer `MessageLog`.
> 5. Qualquer aumento de `instances`/concorrência para acelerar build ou validação.
>
> Em todos os cinco, a alternativa leve já está escolhida acima e deve ser mantida salvo
> decisão explícita em contrário.

---

## Portões de qualidade

### Já existentes — precisam continuar verdes

```bash
npm test                                   # raiz (FR-040)
cd dashboard
npm run guard:config-page                  # FR-038
npm run guard:seo-registry                 # ⚠️ quebra em P2 se não for ajustado ANTES
npm run lint:seo-metadata
npm run validate:seo-consistency
npm run validate:editorial-freshness
npm run validate:schema-templates          # FR-039
```

### Novos (FR-041) — um por regra que regride em silêncio

| Arquivo | O que reprova | FR / SC |
|---|---|---|
| `test/inbound-titulos-clique.test.js` | título acima de 55 (com o entregue reportado), descrição acima de 160, título duplicado, achadinhos reescrito | FR-002..FR-007, SC-001 |
| `test/seo-noindex-guard.test.js` | rota `indexable:false` sem `robots` na metadata; rota sumindo do build; título em dois lugares | FR-008..FR-011, SC-005, SC-007 |
| `test/painel-aviso-credencial.test.js` | jargão na tela; Shopee dizendo "continua saindo"; ML/Amazon dizendo "parou"; textos fundidos num template só; aviso sobrevivendo ao cadastro | FR-017..FR-021, SC-009 |
| `test/marketing-limites-que-nao-se-cruzam.test.js` | promessa de não-banimento; preço de concorrente sem `verifiedAt`+`source`; comparativo sem `bestFit`; frente congelada reaberta; página antiga apagada | FR-029..FR-034, SC-013 |

Mais duas checagens dentro dos validadores existentes (detalhe em
[`contracts/seo-robots.md`](./contracts/seo-robots.md)): `robots` emitido para toda rota não
indexável (`validate-seo-consistency.mjs`) e fonte única de título
(`lint-seo-metadata-duplicates.mjs`).

---

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `guard:seo-registry` reprova assim que a 1ª rota vira não indexável | ajuste do guard é a **primeira** tarefa de P2, antes de qualquer marcação |
| 55 caracteres literais tornariam os títulos telegráficos e reprovariam o modelo | D1 acima — decisão registrada, pendente do seu aval |
| Página nova publicada com rastreamento ainda racionado | FR-014 como portão: P5/P6 só depois de P2 verificado; próxima da fila só depois de a anterior entrar no índice |
| Aviso novo duplicar/contradizer o aviso de código vencido | cruzamento com `Credential`: loja **cadastrada** é descartada; quem avisa é `credentialExpiry` |
| Texto da Shopee ser fundido com o de ML/Amazon numa refatoração futura | constantes separadas + teste que reprova a fusão |
| Página sair do índice e ficar órfã de links internos | `noindex, follow` mantém a circulação a partir dela; nenhuma página é apagada |
| Preço de concorrente envelhecer depois da publicação | `verifiedAt` visível na página; guard exige fonte+data para toda citação |

---

## Complexity Tracking

Nenhuma violação de portão a justificar. Tabela intencionalmente vazia.
