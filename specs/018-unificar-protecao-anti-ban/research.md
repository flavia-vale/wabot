# Research — 018 Anti-banimento (fase plan, 2026-09-23)

Tudo abaixo foi conferido no código da branch `018-unificar-protecao-anti-ban`
(a partir de `develop`). Cada item fecha um "ponto em aberto" da spec ou uma
incógnita do Technical Context.

---

## R1 — A tela de Conexão WhatsApp tem controle de anti-banimento? (FR-006a)

**Decision**: **nada a mexer.** A tela `dashboard/app/painel/whatsapp/page.js`
não tem nenhum controle de proteção. A única ocorrência de vocabulário do tema
(`rajada`, linha ~674) é um **comentário JSX** explicando por que um banner
antigo foi removido — não é texto visível. O plano não remove nem redireciona
nada ali; FR-006a fica satisfeito por confirmação.

**Rationale**: busca por `preserv|anti-ban|limite|horário|rajada|stagger|atraso|intervalo`
na página só devolveu esse comentário. Pôr um atalho para "Anti-banimento" nessa
tela seria acréscimo, não mudança pedida, e a spec (FR-003) já coloca o item no
mesmo grupo de menu "Configuração", logo abaixo de "Conexão WhatsApp".

**Alternatives considered**: adicionar um cartão "Proteja seu número" na tela de
Conexão — rejeitado: a tela é o momento de maior ansiedade da cliente
(`WHATSAPP_SAFETY_POINTS`) e o RCA de 2026-09-02 pede que ela diga só o que o
robô faz com o WhatsApp dela.

---

## R2 — Onde aplicar "vale o mais conservador" (FR-011/FR-013)

**Decision**: **chokepoint único de LEITURA**, num módulo puro novo
`src/core/antiBanFloor.js`, consumido:

1. dentro de `resolveDestinationPreservation` (`src/core/preservationConfig.js`) —
   o único ponto que monta a config efetiva de destino (`bot-worker.js:2502`);
   cobre `burstCap`, `burstWindowSec` e `throttleEnabled` em qualquer nível
   (override do grupo, modelo atribuído, modelo padrão, padrão do sistema);
2. no carregamento do `botConfig` dentro do `getConfig()` do worker (um único
   ponto, ~`bot-worker.js:932`), para o **atraso entre canais**
   (`channelStaggerJitterMs`, lido em `bot-worker.js:4272`).

**Sem migration DML.** Os valores gravados ficam como estão (dormentes quando
menos conservadores que o fixo). As rotas continuam aceitando e gravando o campo
antigo (FR-013) — o efeito é neutralizado na leitura. As respostas GET passam a
devolver também o valor **efetivo** calculado pelo mesmo módulo.

**Rationale** (padrões do AGENTS.md):
- É o mesmo desenho de `Group.imageMode` (valor persistido ignorado,
  chokepoint `toMonitorGroup`) e de `Group.listType`/`searchListType.js` (coluna
  dormente, rota continua aceitando, sem migration).
- "Na migração graciosa, o dado antigo não pode virar comportamento novo em
  silêncio" — ler e decidir num lugar só garante FR-011 "para sempre", inclusive
  para requisição antiga, script e dado legado, que uma DML única não cobre.
- Reversível sem redeploy: `ANTI_BAN_FLOOR=off` (só o valor exato `off`
  desliga, padrão ligado) devolve o comportamento histórico — mesmo padrão dos
  interruptores de rollout (`SHEIN_SHORTLINK_ENABLED`, `PREVIEW_CARD_CANVAS`).
  Valor inválido cai no padrão ligado.

**Alternatives considered**:
- *DML que grava o valor final + clamp nas rotas de escrita*: tem uma vantagem
  real — **não muda código carregado pelo robô**, logo não reinicia o
  `bot-supervisor` (ver R7). Rejeitada como padrão porque (a) apaga a
  customização da cliente sem volta, (b) depende de TODO caminho de escrita
  lembrar da regra (duas rotas + presets + scripts), exatamente a duplicação que
  o projeto proíbe, (c) não é reversível por env. **Fica registrada como
  alternativa para a dona do produto** caso ela prefira não reconectar as
  sessões (ver "Pontos para aprovação" no plan.md).
- *Aplicar a regra no front*: rejeitada — o robô não passa pela tela.

---

## R3 — Os cinco campos fixos: o que é "padrão atual" de verdade

Conferido campo a campo. **Três achados mudam a spec e precisam de aprovação.**

| Campo (spec) | Coluna real | Onde vive | Padrão real | Quem lê |
|---|---|---|---|---|
| Tamanho da rajada | `burstCap` | `Group` (nulável) e `PreservationPreset` (default 6) | 6 | worker via resolver |
| Janela da rajada | `burstWindowSec` | idem (default 600) | 600 s | worker via resolver |
| Limites do destino | `throttleEnabled` | idem (default true) | ligado | worker via resolver |
| Atraso entre canais | `BotConfig.channelStaggerJitterMs` | conta (default 20000 ms) | 20 s | worker `:4272` |
| Variação de imagem | **`BotConfig.imageMutationActive`** (o worker lê este; a API expõe como `imageMutationEnabled`) | conta | **DESLIGADO (default false)** | worker `:4751`, só em canal, só com plano |

**Achado A — variação de imagem NÃO é ligada por padrão.** A spec tomou
`imageMutationEnabled` (legado, default `true`) como padrão; o campo que o robô
de fato lê é `imageMutationActive`, default `false` (migration
`20260611120000_independent_preservation_features`). Fixar "ligado" para todas
as contas com acesso **ligaria a variação para quase todo mundo**, contrariando
FR-014 ("nenhum comportamento muda por padrão"). Efeitos colaterais: como
`isPreservationActive` passa a ser `true` quando qualquer defesa de conta liga,
`channelSnapshot.js` e `followGuard.js` também mudam de ramo para essas contas.
Custo de RAM: nenhum (a mutação já roda dentro do passo único de
`normalizeImageForWhatsApp`); CPU: marginal, só em canal.

**Decision (proposta, pendente de aprovação)**: **tirar a variação de imagem do
conjunto de campos fixos** — ela continua **editável** em "Ajustes da conta",
com frase leiga ("Mudar levemente cada foto enviada para canais, para o WhatsApp
não achar que é a mesma foto repetida"). Ficam fixos **4** campos. O script de
diagnóstico (R4) mede quantas contas com acesso estão com ela desligada, para a
dona decidir com número se prefere fixar ligado.
*Alternativa*: fixar ligado como a spec diz — aceitar a mudança de comportamento
e registrá-la como a segunda exceção de FR-014.

**Achado B — a regra "campo a campo" deixa o preset "Leve" bem mais lento.**
O botão pronto "⚡ Leve" grava `burstCap 10 / burstWindowSec 3600` (10 envios
por hora). Campo a campo: 10 → 6 (fixo) e 3600 mantém (mais conservador) →
**6 por hora**, mais devagar que o Leve **e** que o fixo (6 a cada 10 min). É o
que a spec decidiu ("nunca pela combinação"), e é seguro, mas quem usa "Leve"
vai sentir queda de vazão de 40% na rajada. O diagnóstico mede quantos destinos
caem nesse caso. **Pendente de ciência da dona.** Alternativa descartada por ora:
comparar pela taxa (envios/segundo) — mais justa, mas é "pela combinação", o que
a spec proíbe.

**Achado C — ligar `throttleEnabled` ativa mais do que a rajada.** Com
`throttleEnabled=false` o gate do destino ignora intervalo mínimo, rajada **e**
limite diário. Forçar ligado faz esses três voltarem a valer para o destino,
inclusive o intervalo mínimo e o limite diário que a cliente deixou gravados.
Coerente com "mais seguro", mas é mais que "a rajada volta"; o diagnóstico
reporta intervalo/limite diário desses destinos.

**Faixas válidas mantidas nas rotas** (compatibilidade): `burstCap 1..1000`,
`burstWindowSec 60..86400`, `channelStaggerJitterMs 0..600000`.

---

## R4 — Medir o impacto antes do deploy

**Decision**: `scripts/diag-antiban-valores.mjs`, read-only, no padrão dos
43 `scripts/diag-*.mjs`:

- lê `Group` (role `post`), `PreservationPreset`, `BotConfig` e o plano do
  `User`;
- **importa** `applyAntiBanFloor` / `describeAntiBanFloor` de
  `src/core/antiBanFloor.js` e `resolveDestinationPreservation` — nunca
  reimplementa a regra (lição do `backfill-numeros-whatsapp.mjs`: script que
  reescreve a regra passa a discordar dela em silêncio);
- para cada um dos 4 campos fixos (+ variação de imagem, informativa): contas e
  linhas **menos conservadoras** (mudam), **mais conservadoras** (mantêm e
  ganham a etiqueta de R6), **iguais**, **herdando**; separado por "tem acesso
  ao plano" × "não tem";
- por destino: valor efetivo **antes** × **depois** (resolver sem piso × com
  piso) nos 4 campos — é a prova de SC-004/SC-005: nenhuma linha "depois" pode
  ser menos conservadora que "antes";
- casos especiais: destinos com `throttleEnabled=false` (e o intervalo/limite
  que voltam a valer), destinos cuja rajada fica mais lenta que o fixo por
  efeito campo a campo (Achado B);
- `--detalhes` lista as contas afetadas por e-mail (nunca telefone);
- toda consulta que falhar é **impressa**, nunca vira "zero" (lição do
  `diag-assinatura-recusada.mjs`).

Rodar em staging e produção **antes** do merge em `main` e colar a saída na PR.

---

## R5 — Fonte única do direito de acesso (FR-015/FR-015a)

**Decision**: a tela importa **a mesma função do backend**:
`canUseAdvancedPreservation` de `src/billing/plans.js`.

- `plans.js` é puro (só importa `preservationFeatures.js` → `jid.js`, sem I/O no
  topo), e o dashboard **já importa módulos puros de `src/`** direto
  (`src/domain/painel/mirrorWizard.js`, `src/tutorialVideo.js`,
  `src/domain/painel/trialNotice.js`). Mesmo padrão, zero rota nova.
- `canAccessAdvancedPreservation` (`dashboard/lib/plan.js`, esquece Premium) é
  **removida**; `hasProLikeAccess` (`dashboard/lib/planEntitlements.js`) passa a
  delegar a `getPlanEntitlements` para não virar a próxima segunda fonte.
- Guarda: teste compara tela × backend nos 5 perfis (Basic, Trial ativo, Trial
  vencido, PRO, Premium) e falha estruturalmente se `canAccessAdvancedPreservation`
  voltar a existir ou se `dashboard/app/painel/anti-banimento/` checar `plan ===`
  à mão.

**Alternatives considered**: expor `entitlements` em `GET /auth/me` — funciona,
mas mexe numa rota central por um ganho que o import direto já dá; fica como
evolução.

**Achado lateral**: as rotas recusam com códigos diferentes — `preservation.js`
devolve **402**, `config.js`/`groups.js` devolvem **403**, ambos com o mesmo
corpo de `buildFeatureGateError`. Não unificar o código HTTP nesta feature (cliente
antigo pode depender dele); só a mensagem muda para "O Anti-banimento é um
recurso do plano PRO." (sem prometer que não bane).

---

## R6 — Destino com ritmo mais cuidadoso que o padrão (UX, FR-011)

**Decision**: o backend (mesmo módulo, `describeAntiBanFloor`) devolve, por
destino e por modelo, `ritmoMaisCuidadoso: boolean`. A tela mostra, no cartão
do destino/modelo, uma etiqueta **só leitura**, sem controle:

> 🐢 **Ritmo mais cuidadoso** — este grupo usa um ritmo mais devagar que o
> padrão, escolhido antes. Ele continua valendo.

E, para conta com atraso entre canais acima de 20 s, a mesma frase no bloco
"Ajustes da conta" ("Sua conta espera mais entre um canal e outro do que o
padrão"). Nenhum número técnico é exibido (rajada/janela não voltam à tela);
não reabre edição. Texto e ícone, nunca só cor (FR-020, acessibilidade).
Para voltar ao padrão, ela usa as escolhas prontas ("Equilibrado") — que gravam
só os campos editáveis — e **um botão "Voltar ao ritmo padrão"** no destino que
limpa os overrides (`null` = herdar); isso já é aceito pela rota
`PUT /destinations/:id` e não exige contrato novo.

**Alternatives considered**: mostrar os números antigos em cinza — rejeitado,
reintroduz jargão ("6 envios em 600 s"); esconder completamente — rejeitado,
tela e robô pareceriam discordar (a própria spec pede a frase).

---

## R7 — Risco de reconexão e RAM (Política de memória / "código não carregado")

**RAM**: **zero impacto.** Nenhum processo PM2, worker, cache ou dependência
nova. O piso é aritmética pura por envio (já existe a leitura do destino).

**Reconexão — SINALIZAR**: a feature **muda código que o bot-worker carrega**:
`src/core/preservationConfig.js`, o novo `src/core/antiBanFloor.js` e o
`getConfig()` de `src/bot-worker.js`. Todos batem em `WORKER_CODE_PATHS_RE`, então
o deploy de produção **reinicia o `bot-supervisor` automaticamente** e **reconecta
todas as sessões WhatsApp de uma vez**. Sem esse restart, o piso não vale nos
robôs (RCA 2026-08-31). Mitigações:

- anunciar/agendar a janela do deploy de `main`, ou subir com
  `RESTART_SUPERVISOR=0` e reiniciar à mão num horário combinado;
- a parte de TELA (unificação, nome, gate, redirecionamentos) não depende do
  restart e pode ir antes, em PR separada, se a dona quiser desacoplar;
- alternativa sem restart está em R2 (DML + clamp na escrita).

Nada muda em Baileys, reconexão, filas, dedup ou `processSendJob` além de os
números de preservação passarem pelo piso — a ordem canônica de
`processSendJob` não se altera.

---

## R8 — Perder o plano (FR-019)

**Como é hoje** (confirmado no código):
- ritmo por destino (`resolveDestinationPreservation`) **não é gated por plano**
  no worker: vale para toda conta, com ou sem plano;
- atraso entre canais: também não é gated (lido direto do `botConfig`);
- defesas de conta (variação de imagem, vigia de seguidas, observador,
  variação de texto): só agem com `preservationActive`, que exige plano;
- as rotas de edição recusam (402/403) sem plano; nada é apagado.

**Decision**: **manter exatamente isso**. Ao perder o plano, a tela volta a ficar
bloqueada (FR-017) e os valores gravados continuam no banco **e continuam
valendo** para o ritmo por destino — agora sempre com o piso, então nunca menos
seguro que o fixo nos campos fixos. Ao voltar a assinar, ela reencontra a
configuração que tinha. Nenhum "reset", nenhuma mudança de worker por plano.

**Tensão com a spec (pendente de aprovação)**: o cenário US3-5 diz que a conta
sem acesso "passa a usar o ritmo padrão seguro". Aplicar isso exigiria um gate de
plano novo dentro do worker (outra mudança de runtime) e **aceleraria** quem
tinha escolhido ir mais devagar — contra a regra de ouro da própria spec. O plano
recomenda a leitura acima (valores gravados continuam, com piso) e atualizar a
redação de US3-5/FR-019 na spec. Único resíduo: campos **editáveis** gravados
mais rápidos que o padrão (ex.: intervalo mínimo de 5 s) continuam valendo sem
plano — igual a hoje.

---

## R9 — Estrutura da tela e rotas antigas

**Decision**: rota nova `/painel/anti-banimento` com três partes (Situação,
Ritmo por grupo, Ajustes da conta) navegáveis por `?parte=` e
`?destino=<groupId>`; as quatro rotas antigas viram `redirect()` do Next para a
parte correspondente (mesmo padrão de `/painel/grupos` → `/painel/espelhamento`).
Menu: sai o grupo "Preservação avançada" (3 itens); entra 1 item "Anti-banimento"
com `pro: true` no grupo "Configuração", após "Conexão WhatsApp". Componentes em
`dashboard/components/preservacao/` são reaproveitados/renomeados em texto — sem
biblioteca nova. No celular, a lista de destinos é lista com busca, sem largura
fixa (RCA 2026-09-05).

**Superfícies de texto a renomear** (lista para tasks): `src/billing/plans.js`
(mensagem do gate), `dashboard/app/painel/nav.js`, `espelhamento/page.js`
(atalho), `UpsellShell.js`, `dashboard/lib/painel/logsCopy.js`,
`landing/Pricing.jsx`, `Hero.jsx`, `marketing-content.js`, `planEntitlements.js`
(comentário). **Páginas públicas de SEO** (`_preservationCommercialPages.js`,
`diagnostico-antiban-whatsapp`, blog, `conteudos`) só trocam o **nome do
recurso** no corpo; **título, H1 e URL não mudam** (regra de SEO: mudar título de
página indexada sem medição é risco), e nenhuma frase pode prometer que não bane.
