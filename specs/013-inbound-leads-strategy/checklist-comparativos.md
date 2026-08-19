# Checklist reaproveitável — próximas páginas de comparação (P5, FR-026)

`/alternativas/achadinho-pro` é a **única** página nova publicada nesta rodada
(FR-014/FR-025 — rastreamento ainda racionado, uma por vez). As cinco
seguintes ficam nesta fila, no ritmo de **uma por semana**, com a regra
explícita: **só publica a próxima depois que a anterior entrar no índice do
Google (SC-011, ≤ 14 dias)**.

## Fila (ordem sugerida — ajustar por evidência real de busca quando disponível)

1. Afilira
2. IA Divulgadora
3. Shark Pomo Bot
4. Lumi Ofertas Inteligentes
5. Gigi Bot

## Antes de começar a próxima da fila

- [ ] A página anterior está indexada? Confirmar via `site:espelhagrupos.com.br/alternativas/<slug>`
      no Google, ou via Search Console (URL Inspection). **Não iniciar a próxima
      sem essa confirmação.**
- [ ] Quantos dias levou desde a publicação até a indexação? Registrar aqui,
      abaixo da tabela — é o dado que confirma ou revisa a meta de ≤14 dias
      (SC-011).

| Página | Publicada em | Indexada em | Dias até indexar |
|---|---|---|---|
| `/alternativas/achadinho-pro` | 2026-08-19 | _(preencher)_ | _(preencher)_ |

## Padrão de campos por página (mesmo de T032, `/alternativas/achadinho-pro`)

Toda entrada nova em `dashboard/app/_comparisonContent.js` (`COMPARISON_PAGES`)
precisa ter:

- [ ] `title` ≤ 55 chars de texto próprio, no formato **"Alternativa a/ao
      `<Nome do concorrente>`"** — nunca se apresentando como o concorrente
      (FR-030). Testado por `test/marketing-limites-que-nao-se-cruzam.test.js`.
- [ ] `description` ≤ 160 chars.
- [ ] `tldr` — resumo de 1-2 frases, direto ao ponto de decisão.
- [ ] `directAnswer` — resposta direta e extraível por IA (o "snippet" que o
      Google e os motores de IA vão citar). 40-60 palavras, sem enrolação.
- [ ] `rows[]` — comparativo lado a lado, cada linha nomeando as duas
      ferramentas.
- [ ] `criteria[]` — os critérios que decidem, não features soltas.
- [ ] `botinhoDifferentials[]` — o que o BOTinho tem que o concorrente não.
- [ ] **`bestFit[]` — OBRIGATÓRIO (FR-032)**: pelo menos um item dizendo
      honestamente ONDE O CONCORRENTE é a melhor escolha, não só onde o
      BOTinho ganha. Comparativo enviesado é penalizado por IA e é risco
      jurídico.
- [ ] `notIdealFit[]` — onde cada ferramenta NÃO é ideal, incluindo o próprio
      BOTinho.
- [ ] `competitorSlugs: ['<slug>']` — liga a página ao dado verificado em
      `dashboard/lib/competitors-data.js`.
- [ ] `productPage` — link recíproco de volta para a página comercial mais
      relacionada (padrão do PR #1420).
- [ ] `migrationPath[]` e `faq[]` — mesmo padrão das páginas existentes.

## Preço/plano/comissão — sem coleta nova sem avisar (FR-031)

- [ ] **Todo número de preço/plano/comissão do concorrente vem de
      `dashboard/lib/competitors-data.js`**, com `verifiedAt` e `source`
      preenchidos. Nenhum número solto direto no texto.
- [ ] Se o concorrente da vez **ainda não estiver** em `competitors-data.js`
      (Afilira, IA Divulgadora, Shark Pomo Bot, Lumi e Gigi Bot **não
      estão**, ao contrário do Achadinho Pro — ver D3 de `plan.md`): a coleta
      de dado novo (print da página de preços, com data) precisa acontecer
      **antes** de escrever a página, e a pessoa responsável pela coleta deve
      confirmar a fonte antes de publicar qualquer número.

## Registro no `seo-registry.mjs`

- [ ] Entrada nova em `dashboard/lib/seo-registry.mjs`: `indexable: true`,
      `template: 'alternatives'`, `lastModified` via `EDITORIAL_DATES`
      (`dashboard/lib/editorial-content.js`).
- [ ] **Sem `title`/`description`** no registry — a fonte única continua
      sendo `_comparisonContent.js` (FR-001). Nenhum dos `/alternativas/*`
      hoje tem `schemaTypes` — manter esse padrão (não é exigido por
      `validate-schema-templates.mjs` enquanto nenhum irmão declarar).

## Portão antes de publicar

```bash
cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates && npm run guard:seo-registry
node --test test/marketing-limites-que-nao-se-cruzam.test.js
```

## Limites que não se cruzam (repetir a cada página nova)

- Nunca prometer que não banem (FR-029) — mesmo entrando pela palavra
  "banido"/"anti-ban".
- Nunca reabrir as linhas congeladas por dado (cidade, nicho novo, cluster
  "robô", Magalu, "automação whatsapp"/"disparo em massa" — ver `AGENTS.md`).
- Nunca apagar página existente.
