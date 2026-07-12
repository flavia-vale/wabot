# Feature Specification: Etapa 0.5 — Smoke list (subconjunto crítico rápido + checklist manual de staging)

**Feature Branch**: `003-smoke-list`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Smoke list — lista de testes das funcionalidades principais que sempre roda antes de subir fix/feature. Etapa 0.5 do saneamento técnico do Wabot (segue a Etapa 0: barreira de import + merge gate + coupling-ledger). Dois entregáveis: (1) script `npm run smoke` que roda um SUBCONJUNTO CRÍTICO RÁPIDO de testes já existentes; (2) doc `docs/testing/regression-checklist.md`, ritual manual de staging antes de promover develop→main."

## Visão geral

Esta é a **Etapa 0.5** do plano de saneamento técnico incremental do Wabot,
imediatamente após a **Etapa 0** (`002-regression-safety-net`: barreira de
import + merge gate + livro-razão de acoplamento). A Etapa 0 instalou a barreira
que **impede acoplamento novo**; esta etapa instala o **par natural** dessa
barreira: um smoke que **impede comportamento quebrado** de passar despercebido
antes de qualquer refatoração de lógica (Etapa 1 em diante).

A suíte de testes atual tem 176 arquivos `*.test.js` (`node:test`) e roda
serialmente com banco de teste (`npm test`). A decisão da usuária é que o smoke
automatizado **não** é a suíte inteira: é um **subconjunto crítico rápido e
verde-confiável** — apenas os eixos onde "se quebrar, o produto cai / perde
comissão / toma ban". A suíte completa continua existindo e sendo o merge gate
(Etapa 0); o smoke é a checagem rápida de sanidade que qualquer pessoa roda
localmente antes de subir um fix/feature.

**Invariante central:** nada de produção muda de comportamento nesta etapa. Não
há alteração de lógica de negócio, socket WhatsApp, conversores, pipeline de
envio ou rotas de runtime. Os únicos artefatos adicionados são: **um script npm
(`smoke`) no `package.json`** que SELECIONA arquivos de teste já existentes, e
**um documento de processo** (`docs/testing/regression-checklist.md`). Nenhum
arquivo de `src/`, nenhum teste existente e nenhuma configuração de
`.env`/banco/porta/deploy é alterado. O smoke roda em dev/CI, **nunca** em
produção — não há impacto algum no uso de memória de runtime do VPS.

### Dois níveis (dois entregáveis)

- **Nível 1 — Automatizado (`npm run smoke`)**: subconjunto crítico rápido de
  testes já existentes. Cobre o que um teste automatizado **consegue** cobrir
  sem WhatsApp/loja/navegador reais.
- **Nível 2 — Manual (`docs/testing/regression-checklist.md`)**: ritual de
  staging antes de promover `develop → main`, cobrindo o que **nenhum** teste
  automatizado cobre (exige WhatsApp real, loja real com clique no celular,
  navegador real, pagamento sandbox).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rodar o smoke antes de subir um fix/feature (Priority: P1)

Como mantenedor(a) do Wabot, antes de abrir um PR contra `develop` quero rodar
**um comando único e rápido** (`npm run smoke`) que exercita apenas os eixos
críticos do produto (reconexão honesta, dupla-posse/modo, dedup anti-ban,
conversão de afiliado sem vazar comissão, envio com foto, cripto de credencial,
login/brute-force, pagamento, imageMode preview, fiação do retry-cache, teto de
memória do worker) e sair com confiança de que não quebrei nenhum desses eixos —
sem esperar a suíte inteira de 176 arquivos.

**Why this priority**: É o coração da feature e o gatilho da decisão da usuária.
Sem o Nível 1 não há smoke automatizado; com ele, o loop de desenvolvimento
ganha uma checagem de sanidade barata que pega regressão nos pontos que
historicamente causaram incidente (ban, perda de comissão, sessão caindo).

**Independent Test**: Rodar `npm run smoke` no `develop` atual e observar saída
de código 0 (verde), num tempo perceptivelmente menor que `npm test`, exercitando
todos os arquivos do subconjunto curado.

**Acceptance Scenarios**:

1. **Given** o repositório no estado atual do `develop`, **When** executo
   `npm run smoke`, **Then** o comando sai com código 0 (todos os testes do
   subconjunto passam).
2. **Given** o subconjunto de smoke, **When** comparo o tempo de parede de
   `npm run smoke` com `npm test`, **Then** o smoke é significativamente mais
   rápido (roda ~27 arquivos em vez de 176).
3. **Given** que alguém introduza uma regressão em um eixo crítico coberto (ex.:
   quebra a política de reconexão em `reconnect-policy`), **When** roda
   `npm run smoke`, **Then** o comando sai com código diferente de 0 e aponta o
   arquivo que falhou.
4. **Given** o script `smoke`, **When** ele é executado, **Then** ele usa o mesmo
   padrão de env do script `test` existente (`NODE_ENV=test`, `DATABASE_URL` de
   teste) e não altera nem depende de nenhum `.env` de staging/produção.

---

### User Story 2 - Executar o ritual manual de staging antes de promover para produção (Priority: P1)

Como responsável por promover `develop → main`, quero um **checklist manual
versionado** que me lembre de validar em staging exatamente o que nenhum teste
automatizado consegue provar — conectar QR ponta-a-ponta, sessão sobreviver a
`pm2 restart` no modo remote, espelhamento real chegando com foto/link
convertido/cupom preservado, clique no link no celular creditando comissão
(especialmente ML com cupom), dashboard renderizando, e pagamento sandbox
ativando plano — para não descobrir um comportamento quebrado só depois do deploy
em produção.

**Why this priority**: A promessa do produto (robô 24h, comissão nossa, oferta
com foto) depende de comportamentos que só se validam na vida real. O AGENTS.md é
explícito: coisas como "o ML credita cupom?" **só validam clicando no link num
celular ANTES de ligar em prod**. Um checklist versionado transforma esse
conhecimento tribal num ritual repetível.

**Independent Test**: Abrir `docs/testing/regression-checklist.md` e verificar
que contém, como itens acionáveis, todos os passos do Nível 2 e a referência aos
3 smoke de deploy já existentes em `scripts/deploy_safe_staging.sh`.

**Acceptance Scenarios**:

1. **Given** o documento `docs/testing/regression-checklist.md`, **When** um
   mantenedor o abre antes de promover `develop → main`, **Then** encontra um
   checklist com Nível 1 (o que o smoke cobre e como rodar) e Nível 2 (ritual
   manual de staging), cada item redigido como uma verificação de comportamento
   observável.
2. **Given** o item de aceitação do modo remote, **When** o mantenedor executa
   `pm2 restart api-staging` com uma sessão conectada, **Then** o checklist deixa
   claro que o critério de aprovação é a sessão **continuar conectada**.
3. **Given** o item de espelhamento real, **When** o mantenedor posta em um grupo
   monitorado, **Then** o checklist exige confirmar que a oferta chega ao destino
   **com foto**, com o link convertido (afiliado nosso) e com o cupom preservado,
   no formato card preview clicável.
4. **Given** os 3 smoke de deploy (`/login` renderiza, `/health` responde, `POST
   /api/auth/login` retorna JSON e não 404 do Next), **When** o documento os
   descreve, **Then** ele os referencia como já automatizados em
   `scripts/deploy_safe_staging.sh` em vez de duplicá-los.

---

### User Story 3 - Documentar a lição "comportamento > regex de source" (Priority: P2)

Como mantenedor(a) que vai escrever ou revisar testes no futuro, quero que o doc
registre a lição aprendida na Etapa 0.5 — **preferir testes de comportamento a
testes que casam string do código-fonte** — usando como ilustração os testes
estruturais que deram falso-positivo numa refatoração legítima, para não
reintroduzir esse anti-padrão.

**Why this priority**: É preventivo, não bloqueia o smoke rodar, mas evita que a
própria rede de segurança gere ruído (falso-vermelho em refatoração legítima). Um
teste que verifica que a string `msgRetryCounterCache` aparece no source quebra
quando alguém renomeia a variável mesmo mantendo o comportamento correto.

**Independent Test**: Abrir o doc e verificar que há uma seção explicando a
diferença entre testar comportamento e testar regex de source, com o exemplo dos
testes estruturais que quebraram.

**Acceptance Scenarios**:

1. **Given** o documento, **When** alguém procura orientação sobre como escrever
   um novo teste de smoke, **Then** encontra a recomendação explícita de testar
   comportamento observável e a explicação de por que testes de regex de source
   dão falso-positivo em refatoração legítima.

---

### Edge Cases

- **Um teste do subconjunto exige banco (não é puro).** O smoke deve usar o mesmo
  padrão de env do script `test` (`NODE_ENV=test`, `DATABASE_URL` apontando para
  o banco de teste, e o passo de preparação de banco quando necessário). A
  preferência é manter o subconjunto majoritariamente com testes puros
  (db-free/env-free) para ser rápido; qualquer teste do subconjunto que toque o
  banco deve estar documentado como tal e o script deve garantir o mesmo preparo
  de DB que a suíte completa usa, para não sair falso-vermelho por banco ausente.
- **Caminho de arquivo diverge do citado na demanda.** Ao curar a lista,
  confirmou-se que três caminhos divergem do texto original da demanda: o teste
  de dedup global está em `test/core/global-dedup.test.js`, o de dedup-key de
  espelhamento em `test/core/mirror-dedup-key.test.js`, e o de teto de memória do
  worker em `test/core/worker-spawn-options.test.js`. O script referencia os
  caminhos reais.
- **Um arquivo do subconjunto é renomeado/movido no futuro.** Se um caminho
  listado no script deixar de existir, o smoke deve falhar de forma visível
  (arquivo não encontrado) em vez de silenciosamente pular o eixo — assim a lista
  é mantida sincronizada com a suíte.
- **Smoke verde mas suíte completa vermelha.** O smoke é um subconjunto: passar
  no smoke **não** substitui o merge gate da suíte completa (Etapa 0). O doc deve
  deixar claro que o smoke é uma checagem rápida local, não o gate de merge.

## Requirements *(mandatory)*

### Functional Requirements

#### Nível 1 — Script `npm run smoke`

- **FR-001**: O `package.json` MUST conter um script `smoke` que executa, via
  `node --test`, **apenas** o subconjunto curado de arquivos de teste já
  existentes (não a suíte inteira).
- **FR-002**: O script `smoke` MUST sair com código 0 no estado atual do
  `develop` (subconjunto 100% verde).
- **FR-003**: O subconjunto MUST cobrir todos os eixos críticos listados abaixo,
  de forma rastreável (cada eixo mapeado para pelo menos um arquivo de teste no
  doc/spec). Os arquivos curados (caminhos reais confirmados em `test/`):

  | Eixo crítico (se quebrar…) | Arquivo(s) de teste |
  |---|---|
  | Reconexão honesta / badSession | `test/reconnect-policy.test.js`, `test/session-persistence-policy.test.js` |
  | Dupla-posse / modo inline↔remote | `test/supervisor-env-guard.test.js`, `test/ops-mode-regression-guard.test.js`, `test/env-modes.test.js` |
  | Dedup (ban/spam e oferta perdida) | `test/message-dedup.test.js`, `test/core/global-dedup.test.js`, `test/core/mirror-dedup-key.test.js`, `test/coupon-dedup-window.test.js`, `test/offer-automation.test.js` |
  | Conversão + comissão nunca vaza (por loja) | `test/converters-amazon.test.js`, `test/shopee-affiliate-info.test.js`, `test/shopee-shortlink-resolve.test.js`, `test/mercadolivre-resolve.test.js`, `test/mobile-converter.test.js` |
  | Envio com FOTO (armadilha serialização BullMQ→texto) | `test/send-queue-backend.test.js`, `test/send-queue-backend-dlq.test.js` |
  | Cripto de credencial (migração graciosa) | `test/credential-crypto.test.js` |
  | Login / brute-force | `test/auth.test.js`, `test/auth-rate-limit.test.js` |
  | Pagamento (webhook + serviço) | `test/payments-webhook.test.js`, `test/payments-service.test.js` |
  | imageMode sempre 'preview' (chokepoint) | `test/group-entitlements.test.js`, `test/groups-route-image-mode.test.js` |
  | Fiação do retry-cache (loop ~50min) | `test/bot-worker-retry-cache-wiring.test.js` |
  | Teto de memória do worker | `test/core/worker-spawn-options.test.js` |

- **FR-004**: O script `smoke` MUST rodar significativamente mais rápido que
  `npm test` (roda ~27 arquivos em vez de 176), preservando o caráter de
  "checagem rápida".
- **FR-005**: O script `smoke` MUST usar o mesmo padrão de env do script `test`
  existente (`NODE_ENV=test` e `DATABASE_URL` de teste), e reaproveitar o mesmo
  passo de preparação de banco (equivalente ao `pretest`) **quando** algum teste
  do subconjunto tocar o banco. Testes puros do subconjunto continuam
  db-free/env-free.
- **FR-006**: O subconjunto SHOULD priorizar testes puros (db-free/env-free) para
  manter a velocidade; qualquer arquivo do subconjunto que exija banco MUST estar
  documentado como tal no doc de Nível 1.
- **FR-007**: O script `smoke` MUST falhar (código ≠ 0) se algum arquivo do
  subconjunto falhar ou não existir, em vez de pular o eixo silenciosamente.

#### Nível 2 — Doc `docs/testing/regression-checklist.md`

- **FR-008**: MUST existir o arquivo `docs/testing/regression-checklist.md`
  contendo duas partes: **Nível 1** (o que o smoke cobre + como rodá-lo) e
  **Nível 2** (ritual manual de staging antes de promover `develop → main`).
- **FR-009**: A parte de Nível 2 MUST incluir, como itens acionáveis de
  checklist, no mínimo:
  - Conectar QR ponta-a-ponta e verificar status honesto no painel.
  - Teste de aceitação do modo remote: `pm2 restart api-staging` com sessão
    conectada → a sessão **continua conectada**.
  - Espelhamento real: postar em grupo monitorado → oferta chega ao destino
    **com foto**, link convertido (afiliado nosso) e cupom preservado (card
    preview clicável).
  - Clicar o link convertido no celular → abre o app / credita comissão
    (especialmente ML com cupom — só valida na vida real).
  - Dashboard: `/login` renderiza (não 404 do Next), "Criar oferta" raspa
    título/preço, página de grupos abre.
  - Pagamento sandbox: checkout → webhook → plano ativa.
- **FR-010**: O doc MUST referenciar os 3 smoke de deploy já existentes em
  `scripts/deploy_safe_staging.sh` (`GET /login`, `GET /health`, `POST
  /api/auth/login` retornando JSON e não 404 do Next) em vez de duplicá-los.
- **FR-011**: O doc MUST registrar a lição "preferir teste de **comportamento** a
  teste de **regex de source**", ilustrada pelos testes estruturais que deram
  falso-positivo numa refatoração legítima (Etapa 0.5).

#### Restrições canônicas (AGENTS.md)

- **FR-012**: A feature MUST NOT alterar nenhum arquivo de runtime de produção
  (`src/`), nenhum teste existente (apenas os SELECIONA), nenhuma porta e nenhum
  `.env`/banco/fluxo de deploy. As únicas mudanças são: um script no
  `package.json` e um novo arquivo de documentação.
- **FR-013**: A feature MUST NOT aumentar o uso de memória de runtime — o smoke
  roda em dev/CI, nunca em produção. (Sem impacto de RAM no VPS; nada a
  super-sinalizar.)
- **FR-014**: O trabalho MUST seguir o fluxo canônico: branch a partir de
  `develop`, PR **contra `develop`** (nunca direto para `main`).

### Key Entities

- **Subconjunto de smoke**: a lista curada de ~27 arquivos de teste existentes
  que compõem o `npm run smoke`, mapeada 1:N a partir dos eixos críticos.
- **Eixo crítico**: uma categoria de comportamento "se quebrar, o produto cai /
  perde comissão / toma ban" (reconexão, dupla-posse, dedup, conversão, envio com
  foto, cripto, login, pagamento, imageMode, retry-cache, teto de memória).
- **Checklist de regressão manual**: o documento `regression-checklist.md` com os
  itens de Nível 1 (referência ao smoke) e Nível 2 (validações de staging na vida
  real).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm run smoke` existe e sai com código 0 no `develop` atual,
  executando apenas o subconjunto curado (~27 de 176 arquivos de teste).
- **SC-002**: `npm run smoke` completa em tempo de parede substancialmente menor
  que `npm test` (o subconjunto é ~15% dos arquivos), tornando-o utilizável como
  checagem rápida pré-PR.
- **SC-003**: Todos os 11 eixos críticos listados estão cobertos por pelo menos
  um arquivo no subconjunto, com rastreabilidade eixo→arquivo verificável no
  próprio doc/spec.
- **SC-004**: `docs/testing/regression-checklist.md` existe e contém tanto o
  Nível 1 (o que o smoke cobre + como rodar) quanto o Nível 2 (ritual manual de
  staging), incluindo a referência aos 3 smoke de deploy e a lição
  comportamento-vs-regex.
- **SC-005**: O diff da feature não altera nenhum arquivo sob `src/`, nenhum
  arquivo de teste existente, nenhum `.env`, banco, porta ou script de deploy —
  apenas `package.json` (novo script) e o novo doc.

## Assumptions

- Os 27 arquivos do subconjunto estão verdes no `develop` atual (confirmado na
  curadoria: todos os caminhos existem em `test/`, com três divergências de
  caminho já resolvidas para os arquivos sob `test/core/`).
- A maioria do subconjunto é composta de testes puros (db-free/env-free); espera-se
  que poucos ou nenhum exijam banco. Caso algum exija, o script reaproveita o
  padrão de env/preparação de banco já usado pelo script `test`/`pretest`
  existente — sem inventar um novo mecanismo de banco.
- O smoke é um **complemento** ao merge gate da suíte completa (Etapa 0), não um
  substituto: passar no smoke não dispensa a suíte completa no CI.
- A execução do smoke é local/CI (dev), portanto fora do escopo de qualquer
  consideração de memória de produção do VPS.
- A curadoria da lista é responsabilidade humana/mantida no `package.json`; não há
  descoberta automática de "quais testes são críticos" — a lista é explícita e
  versionada.
