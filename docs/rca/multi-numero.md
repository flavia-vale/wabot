# Vários números de WhatsApp na mesma conta (multi-número)

Plano de negócio aprovado pela dona do produto em 2026-09-30. Este arquivo é
a fonte da decisão: fase atual, preço, critérios de avanço e o que NÃO
prometer. Ler antes de mexer no assunto.

## Situação de partida (dados)

- Hoje é **1 número por conta**: `WaSession.userId @unique` (`prisma/schema.prisma`).
- Planos: Basic R$39, PRO R$69, plano acima do PRO ainda não lançado (`PLAN_IDS.PREMIUM`).
- Custo por número: ~R$1,75–3/mês de servidor; para capacidade conta
  **0,35 GB/número** (ver `memoria-e-capacidade.md`). Cada número extra ocupa
  **uma vaga** igual a uma conta nova.
- Procura já existente: clientes com **várias contas usando o mesmo número**
  (`WaPhoneOwnership`; medido: 12 contas em 4 pessoas). Hipótese: parte é
  procura por mais números, parte é reuso de teste grátis.

## Preço aprovado

| Produto | Preço |
|---|---|
| Número extra (só PRO; Trial ativo conta como PRO) | **R$29/mês por número** (`EXTRA_NUMBER_PRICE_CENTS`) |
| Plano "Escala" (Fase 3) | R$129–149 com 3 números + rodízio + Instagram (a fechar) |
| Proxy por número (opcional, Fase 3) | +R$15–20/número, só se os dados mostrarem ban em cascata |

R$29 fica abaixo de uma 2ª conta PRO (R$69), mas não tão baixo que derrube a
receita de quem já paga duas contas.

## Fases e critério de avanço

| Fase | Entrega | Meta para seguir |
|---|---|---|
| **0. Validar** ✅ em andamento | Lista de espera no painel (`/painel/whatsapp`, com robô conectado) + `scripts/diag-multi-numero-demanda.mjs` | ≥5 contas PRO na lista, ou ≥10% dos PROs (com ao menos 3) |
| 1. Número reserva (spec abaixo) | 2º número assume se o 1º cair ou for banido | Quem usa reserva cancela menos que quem não usa |
| 2. Rodízio | Envios alternados entre os números presentes em cada grupo, com teto por número | Menos bans por número, vazão igual ou maior |
| 3. Plano Escala | Até 5 números, descanso automático, saúde por número, proxy opcional | Receita média do PRO +20% |

## Fase 0 — como funciona

- Rotas: `GET/POST/DELETE /api/multi-number/waitlist` (`src/api/routes/multiNumber.js`).
- Regra: `src/domain/multiNumber/waitlist.js` (preço, opções, validação,
  intenção vigente, critério de decisão). O diagnóstico IMPORTA essa regra.
- Armazenamento: `AnalyticsEvent` com `multi_number_waitlist_joined` /
  `multi_number_waitlist_left` (sem migration). A intenção vigente é o
  evento mais recente da conta. Grava direto pelo `writeAnalyticsEvent`, sem
  depender de `ANALYTICS_ENABLED` — é dado de negócio, não telemetria.
- Não liga sessão, não reserva vaga, **não aumenta RAM**.
- Diagnóstico (read-only): `node scripts/diag-multi-numero-demanda.mjs [--lista]`
  → base PRO, lista (quantidade, motivo, receita potencial), contas que
  compartilham número e a decisão da Fase 1. `--lista` imprime e-mails para
  o contato de pré-venda.

## Não regredir / o que não prometer

- **Nunca vender como "anti-ban garantido".** O rodízio reduz o volume por
  número; não elimina o risco. Texto certo: "continuidade" e "envio dividido".
- Um número só envia para grupo em que está (membro/admin; admin no canal).
  O rodízio só pode escolher entre números presentes no destino.
- Só **um** número "ouve" cada grupo de origem, senão a oferta duplica.
- Todos os números saem do mesmo IP do servidor: ban em cascata é hipótese a
  medir na Fase 2 antes de vender proxy.
- **Fase 1 em diante aumenta RAM** (cada número = uma sessão, 0,35 GB para
  capacidade): Regra #1 da política de memória — estimativa + OK da usuária
  antes de liberar. A folga era de 24 vagas em 2026-09-18.

## Fase 1 — especificação técnica (número reserva)

Escrita em 2026-10-03, ANTES de haver código. Só começar quando
`diag-multi-numero-demanda.mjs` disser **SEGUIR**. Fatos abaixo conferidos no
código da `develop` nessa data.

### Como é hoje (tudo é "1 conta = 1 robô")

| Peça | Chave hoje | Onde |
|---|---|---|
| Registro da sessão | `WaSession.userId @unique` | `prisma/schema.prisma` |
| Login do WhatsApp no disco | `getAuthInfoDir(userId)` → `auth_info/<userId>` | `src/paths.js` |
| Dedup local | `getDedupFile(userId)` | `src/paths.js` |
| Robôs ligados | `bots` Map por `userId`; worker recebe `BOT_USER_ID` | `src/core/sessionCore.js` (`startBot`/`stopBot`) |
| Supervisor, QR/status, último evento no Redis | `userId` | `src/supervisor/index.js`, `protocol.js` (`lastEventKey`) |
| Quem lê/escreve `waSession` | 16 arquivos | `grep -rl "waSession\." src` |
| Grupos e destinos | `Group.userId`, `Destination.userId` (sem número) | `prisma/schema.prisma` |

### Decisão central: a chave do número principal NÃO muda

Cada número ganha uma **chave de sessão** (`sessionKey`):

- número 1 (principal) → `sessionKey = userId` — **igual a hoje**;
- números extras → `sessionKey = <userId>~n2`, `~n3`…

Por quê: assim **nenhuma sessão existente precisa ser migrada**. Pasta de
login, Map de robôs, chaves do Redis e dedup do principal continuam com o
mesmo nome. Só o número extra é novo. Isso tira o maior risco do projeto
(mover o login de todos os clientes) e deixa a volta atrás simples: desligar a
flag e parar os robôs `~nX`.

Regra de ouro: código que recebe `userId` e precisa da conta usa
`accountIdFromSessionKey(sessionKey)` (corta o `~nX`); código que precisa do
robô usa a `sessionKey`. Função pura nova em `src/domain/session/sessionKey.js`,
com teste. **Proibido** montar `~n` à mão fora dela.

### 1. Banco (migration, só acrescenta)

- `WaSession`: tirar o `@unique` de `userId`; novas colunas
  `slot Int @default(1)`, `role String @default("primary")`
  (`primary` | `reserve`) e `@@unique([userId, slot])`.
  As linhas atuais viram `slot=1, role=primary` pelo default, sem script.
  (SQLite: o Prisma recria a tabela; testar no staging com cópia do banco de
  produção antes — regra de "banco passa por staging".)
- `User.extraNumbers Int @default(0)`: quantos números extras a conta pagou.
- Toda leitura `findUnique({ where: { userId } })` em `waSession` (16 arquivos)
  passa a `findFirst({ where: { userId, slot: 1 } })` ou recebe a `sessionKey`.
  Teste estrutural: nenhum `waSession.findUnique({ where: { userId` sobrando.

### 2. Disco e robô

- `getAuthInfoDir(sessionKey)` e `getDedupFile(sessionKey)`: mesma função, a
  chave muda só para extras. A guarda de "dois sockets no mesmo AUTH_INFO_DIR"
  (`src/supervisor/envGuard.js`) passa a valer por `sessionKey`.
- `startBot(sessionKey)` / `stopBot(sessionKey)`; o fork passa
  `BOT_USER_ID=<conta>` **e** `BOT_SESSION_KEY=<chave>` + `BOT_ROLE`.
- O bot-worker em `role=reserve` **conecta e fica de prontidão**: não escuta
  grupos de origem e não pega envio. Só assume quando promovido (abaixo).
  Isso evita oferta duplicada e conversão em dobro.
- Supervisor, eventos de QR/status e `lastEventKey` passam a usar `sessionKey`.

### 3. Troca automática (failover)

Promove a reserva a `primary` (e rebaixa o antigo) quando o principal:

- foi deslogado/banido (`loggedOut` 401 — ver `src/core/reconnectPolicy.js`); ou
- está desconectado há mais de `MULTI_NUMBER_FAILOVER_MINUTES` (padrão 10); ou
- está "conectado mas cego" (`isReceptionProblem` em
  `src/core/receptionHealth.js`) pela mesma janela.

Regras:
- **Uma troca por vez**, com trava no banco (sem dois `primary` ao mesmo tempo)
  e intervalo mínimo entre trocas (evita pingue-pongue).
- Ao promover: reinicia os dois robôs nos papéis novos (mais simples e seguro
  que trocar papel com o robô rodando).
- A reserva só envia para grupos em que **é membro**. Grupo sem a reserva fica
  sem envio durante a troca, e o painel avisa ("a reserva não está em 3 grupos").
- Avisar a cliente (e-mail + aviso no painel) a cada troca.
- Volta para o principal: **manual** na Fase 1 (botão "voltar para o número 1").

### 4. Painel

Na tela WhatsApp (dentro do retorno de quem está conectada — ver regressão de
2026-09-30), um bloco "Número reserva":
- conectar por QR/código (reaproveita o fluxo atual com a `sessionKey` extra);
- estado de cada número (conectado, de prontidão, ativo);
- lista de grupos em que a reserva **não** está;
- botões: desconectar reserva, voltar para o número 1.
Segue o design system v2 (padrão PRO). Texto: "continuidade", nunca "anti-ban".

### 5. Cobrança

- Só PRO (e Trial ativo, como o resto). `extraNumbers > 0` exige PRO.
- R$29/mês por número. **Decisão em aberto** (perguntar à dona do produto
  antes de codar): (a) somar no valor da assinatura recorrente do PRO
  (uma cobrança só; mudar valor de assinatura existente no Mercado Pago) ou
  (b) assinatura separada só do adicional (mais simples de ligar/desligar,
  duas cobranças no cartão). Ler `docs/rca/cobranca.md` antes.
- Plano vencido ou cancelado → robôs extras param primeiro.

### 6. Capacidade e RAM (Regra #1 — sinalizar antes de liberar)

- Cada número extra = uma vaga a mais: **~0,18 GB medidos, 0,35 GB para
  decidir capacidade**. A reserva em prontidão gasta quase o mesmo que um robô
  ativo (o socket fica aberto).
- Ex.: 10 clientes com 1 reserva = +3,5 GB na conta de capacidade (+1,8 GB
  reais). Conferir folga com `diag-vagas-robos.mjs` antes de abrir.
- A recusa por falta de vaga (`src/domain/session/startRefusal.js`) vale para o
  extra também, e o **principal tem prioridade** sobre qualquer reserva.

### 7. Liberação e volta atrás

1. Flag `MULTI_NUMBER_ENABLED` (padrão desligada). Desligada = tudo como hoje.
2. Staging com cópia do banco de produção: migration + 2 contas de teste com
   reserva + forçar queda do principal.
3. Produção liberada só para a lista de espera (quem pediu na Fase 0), em
   lotes pequenos, olhando swap e vagas.
4. Volta atrás: desligar a flag e parar os robôs `~nX`. O principal nunca foi
   mexido.

### 8. Testes obrigatórios

- `sessionKey`: montar, desmontar, conta a partir da chave, recusa chave inválida.
- Failover: cada gatilho promove; nunca dois `primary`; intervalo mínimo
  respeitado; sem reserva conectada não troca.
- Reserva em prontidão não processa mensagem de grupo nem pega envio.
- Estrutural: nenhuma leitura de `waSession` por `userId` único sobrando;
  ninguém monta `~n` fora de `sessionKey.js`.
- Conta sem extras: comportamento idêntico ao de hoje (o teste mais importante).

### Fora da Fase 1

Rodízio de envio (Fase 2), mais de 1 reserva, proxy por número, plano Escala.
