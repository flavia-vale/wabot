# Phase 0 — Research: Fallback de vitrine ML quando o SSID está vencido

Todas as incógnitas técnicas foram resolvidas por leitura do código atual. Não
há `NEEDS CLARIFICATION` pendente.

## Contexto do código atual (fonte da verdade)

- `convertMlCouponWithoutProduct(url, creds)` — `src/converters/mercadolivre.js`
  L953-1018. Só é alcançável a partir de `convert()` quando `!cleanTarget`
  (link sem produto conversível). O guard anti-regressão em L1031-1039 garante
  que link de produto legítimo NUNCA entra aqui.
- Hoje o fallback de vitrine (`buildVitrineFallback(creds)`, L910-914, retorna
  `{ url, linkKind:'coupon', warning:'ml_vitrine_fallback_used' }`) só roda
  dentro de `if (err.mlFailureType === 'unsupported_url')` (L986-1009).
- Classificação da falha do ML: `classifyMlAffiliateFailure` (L568-582) →
  tipos `expired | forbidden | rate_limited | unsupported_url`. `expired` vem de
  status 401/auth (SSID vencido). `unsupported_url` vem do error_code 111 ("URL
  not allowed in affiliates program").
- `isDirectVitrineShare(originalUrl)` (L929-936): `true` só quando o link
  ORIGINAL compartilhado já era `/social/...` no host ML — certeza de vitrine.
- Fluxo do motivo até o painel: `convert()` re-lança erros com `mlFailureType`
  (L1133) → `bot-worker.js` `catch` (L2698-2708) chama `recordConversionIssue`
  (L2643-2661) que grava `errorMsg = 'error:conversion:' + err.message`, status
  `'error'`. Tradução no painel: `dashboard/lib/painel/logsCopy.js`
  `explainErrorMsg` e, no mobile, `dashboard/lib/mobileLogs.js`.

## Decisão D1 — Função pura leaf para a decisão de fallback

- **Decisão**: criar `src/converters/mlVitrinePolicy.js` exportando
  `decideVitrineFallback({ failureType, isDirectVitrine, hasVitrine })` que
  retorna um dos 4 outcomes: `'use_vitrine' | 'missing_vitrine' | 'discard' |
  'passthrough'`. `convertMlCouponWithoutProduct` calcula `isDirectVitrine =
  isDirectVitrineShare(url)` e `hasVitrine = !!buildVitrineFallback(creds)` e
  despacha pelo outcome.
- **Rationale**: guidance exige "função pura/leaf testável" para a decisão
  `expired` vs `unsupported_url`. Módulo leaf sem imports pesados = teste
  unitário puro por tabela-verdade, sem tocar rede/credencial. Segue o padrão do
  repo (`reconnectPolicy.js`, `couponPolicy.js`, `monitoredRelayPolicy.js`).
- **Tabela-verdade** (contrato em `contracts/decide-vitrine-fallback.md`):

  | failureType      | isDirectVitrine | hasVitrine | outcome           | Por quê |
  |------------------|-----------------|------------|-------------------|---------|
  | `unsupported_url`| —               | `true`     | `use_vitrine`     | 004 preservado: recusa estrutural + vitrine própria → usa vitrine sempre |
  | `unsupported_url`| `true`          | `false`    | `missing_vitrine` | vitrine confirmada, mas sem a própria cadastrada → motivo específico |
  | `unsupported_url`| `false`         | `false`    | `discard`         | recusa ambígua via encurtador → descarta sem culpar vitrine (RCA 2026-07-08) |
  | `expired`        | `true`          | `true`     | `use_vitrine`     | **NOVO (FR-001)**: SSID não conserta vitrine de 3º → usa a vitrine própria |
  | `expired`        | `true`          | `false`    | `missing_vitrine` | **NOVO (FR-003)**: pede cadastrar a vitrine, não renovar SSID |
  | `expired`        | `false`         | —          | `passthrough`     | **US3/FR-006**: produto com SSID vencido → mensagem de renovar SSID / fallback partner_id inalterada |
  | outro (`forbidden`/`rate_limited`/…) | — | — | `passthrough` | fora do escopo — comportamento atual mantido |

- **Alternativas rejeitadas**: (a) inline `if/else` dentro da função assíncrona —
  não é testável isoladamente (guidance pede função pura). (b) Estender a função
  para também aplicar vitrine em `forbidden`/`rate_limited` — fora de escopo
  (spec só cita expired/unsupported_url); manter `passthrough`.

## Decisão D2 — Taxonomia do motivo "vitrine ausente" (`errorTaxonomy.js` + tradutor)

- **Descoberta relevante (bug latente)**: o motivo atual da recusa
  `unsupported_url` sem vitrine emite a frase **minúscula** "…cadastre o link da
  SUA vitrine…" (`buildMlAffiliateError`, L590), mas os dois tradutores casam por
  substring **maiúscula** `'Cadastre o link da SUA vitrine'`
  (`logsCopy.js:43`, `mobileLogs.js:42`). Ou seja, hoje esse ramo cai no texto
  genérico `error:conversion:` — o match nunca acontece. Reaproveitar essa frase
  seria frágil (depende de casar uma sentença inteira em PT, já com bug de caixa).
- **Decisão**: introduzir um **prefixo canônico dedicado**
  `skip:ml_vitrine_missing` para o outcome `missing_vitrine`.
  - Categoria: `config_block` (bloqueio por configuração) — a oferta é
    **ignorada** por falta de cadastro, não é uma falha de conversão. `skip:*`
    já cai em `CONFIG_BLOCK` pelo catch-all de `categorizeErrorMsg`
    (`errorTaxonomy.js:85`) e é `isBenignSkip` → painel pinta cinza "Ignorado",
    coerente com o "a oferta é ignorada" da US2 (não "falhou" vermelho).
  - `errorTaxonomy.js`: adicionar constante/branch explícito documentando o novo
    motivo (funcionalmente já coberto pelo catch-all `skip:`, mas o branch
    explícito registra o motivo na taxonomia — FR-007).
  - Tradutores: adicionar branch em **`dashboard/lib/painel/logsCopy.js`**
    (nomeado pela guidance) **e** em **`dashboard/lib/mobileLogs.js`** (2º
    renderizador — não esquecer, senão o mobile mostra a string crua). Texto:
    explica que faltou cadastrar a vitrine própria e aponta o caminho Painel →
    IDs de afiliada → Mercado Livre; **NÃO** menciona renovar/atualizar SSID
    (FR-004, FR-005).
- **Rationale**: FR-007 permite "reutilizar prefixo existente da categoria de
  bloqueio por configuração OU novo prefixo atualizando taxonomia + tradutor
  simultaneamente". Não há prefixo `config_block` reutilizável com esta
  semântica exata, e o `error:conversion` atual é categoria `conversion`
  (vermelho "falhou") — não bate com "oferta ignorada". Um `skip:` dedicado é
  robusto (sem match por sentença) e semanticamente correto.
- **Unificação (recomendada, com guarda)**: rotear TAMBÉM o caso
  `unsupported_url + direto + sem vitrine` (hoje `error:conversion` que, por
  causa do bug de caixa, cai no texto genérico) pelo MESMO
  `skip:ml_vitrine_missing`. Isso conserta o ramo morto e unifica a UX. Proteger
  a não-regressão da feature 004 com teste (o caso **com** vitrine continua
  `use_vitrine` + `warning:ml_vitrine_fallback_used`, intocado).
- **Alternativas rejeitadas**: (a) Reusar `error:conversion:` + alinhar a
  capitalização da frase — mantém categoria `conversion`/status `error`
  (vermelho), contraria "oferta ignorada" e o espírito de FR-007 (que fala em
  categoria de bloqueio por configuração). (b) Novo prefixo `error:*` — mesmo
  problema de status vermelho.

## Decisão D3 — Plumbing converter → bot-worker (como o motivo canônico chega ao log)

- **Problema**: hoje o `catch` do `bot-worker.js` só sabe gravar
  `error:conversion:${err.message}` (status `'error'`) via `recordConversionIssue`.
  Para gravar `skip:ml_vitrine_missing` com status `'skipped'`, o worker precisa
  saber que é um skip pré-classificado.
- **Decisão**: no outcome `missing_vitrine`, `convertMlCouponWithoutProduct`
  lança um erro carregando campos de sinalização, p.ex.
  `err.conversionLogErrorMsg = 'skip:ml_vitrine_missing'` e
  `err.conversionLogStatus = 'skipped'` (mantendo `mlFailureType` para propagar
  por `convert()`). O `catch` de conversão do `bot-worker.js` (L2698-2708),
  antes de cair em `recordConversionIssue` genérico, checa esses campos e, se
  presentes, grava o `errorMsg`/`status` pré-classificados. Nenhum outro caminho
  de erro muda.
- **Rationale**: mudança mínima e contida; não altera a assinatura pública de
  `convert()`/`convertLink`; preserva o caminho `error:conversion` para todos os
  demais erros. Evita retornar sentinelas que exigiriam reescrever o fluxo
  truthy/null/throw do worker.
- **Alternativas rejeitadas**: (a) `convertMlCouponWithoutProduct` retornar um
  objeto sentinela `{ skip:true, reason }` — o worker trata retorno truthy como
  conversão bem-sucedida (`.url`), exigiria refactor maior e arriscado. (b)
  Reclassificar dentro de `classifyError` — a informação "é vitrine ausente" só
  existe no converter; classifyError não tem como deduzir.

## Decisão D4 — Sem migração, memory-neutral

- **Decisão**: nenhuma alteração de schema Prisma. `vitrineUrl` já vive em
  `Credential.data`. Nenhum processo/worker/cache novo.
- **Rationale**: Assumptions da spec + regra de memória do AGENTS.md
  (super sinalizar). Caminho de exceção, sem impacto de RAM. Nada a sinalizar à
  usuária sobre memória.

## Riscos e mitigação

- **R1 — Regressão no caminho de produto (FR-008)**: a decisão só é alcançada
  via `!cleanTarget` (sem produto). Mitigação: manter o guard L1031-1039 e cobrir
  com teste (produto com SSID vencido → comportamento atual).
- **R2 — Regressão feature 004 (unsupported_url + vitrine)**: outcome
  `use_vitrine` inalterado. Mitigação: os 6 casos do contrato 004 seguem no
  `test/ml-vitrine-fallback.test.js`.
- **R3 — Esquecer o 2º tradutor (mobileLogs.js)**: o painel web mostraria o
  texto certo e o mobile a string crua. Mitigação: task explícita + assert no
  teste (ou revisão) cobrindo os dois arquivos.
- **R4 — Validação de crédito de comissão da vitrine**: só um clique real no
  celular em staging confirma (mesma ressalva do AGENTS.md para links ML).
  Mitigação: passo manual no quickstart antes de promover a prod.
