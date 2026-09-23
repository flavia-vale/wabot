# cobranca — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Configurações do Mercado Pago (envs obrigatórias)

Estas variáveis devem estar no `.env` de produção antes de ativar o fluxo de
pagamento via Mercado Pago. Sem elas o endpoint de checkout ou o webhook
falha silenciosamente.

| Env                          | Obrigatória? | O que faz                                                                                   |
|------------------------------|--------------|---------------------------------------------------------------------------------------------|
| `MP_ACCESS_TOKEN`            | Sim          | Token de produção do MP (`APP_USR-...`). Obtido em Credenciais → Produção no painel MP.    |
| `MP_WEBHOOK_SECRET`          | Sim (prod)   | Chave HMAC gerada pelo painel MP (Webhooks → Assinatura). Sem ela, `/api/payments/webhook` retorna 500 em produção. |
| `BILLING_WEBHOOK_AUTOPROCESS`| Recomendada  | `true` ativa processamento imediato do webhook. Default `false` atrasa ativação em até 1h (reconciliação periódica). |
| `MP_FEE_PERCENT`             | Não (default `4.99`) | Percentual retido pelo Mercado Pago, descontado da **receita líquida** no painel Financeiro (`GET /finance/overview` → `mpFees30d`/`netRevenue30d`). Estimativa: 4,99% reproduz o caso observado (R$69 → R$65,56). O valor real varia por método/prazo — ajustar aqui se necessário. |
| `MP_FEE_FIXED_CENTS`         | Não (default `0`) | Taxa fixa em centavos por transação aprovada, somada às taxas MP no cálculo do líquido. |

**URL de webhook a registrar no painel MP:**
`https://espelhagrupos.com.br/api/payments/webhook`

Evento a marcar: `payment`.

**Aplicar as envs:** qualquer mudança nas envs do MP exige delete+start, não
`restart --update-env` (pegadinha #1):

```bash
pm2 delete api
cd ~/wabot && pm2 start ecosystem.config.cjs --only api
pm2 save
```

**Token de sandbox vs produção:** o MP fornece tokens separados. Usar token
de produção em staging dispara cobranças reais. Para testes, usar token de
sandbox no `.env` de staging.

## Assinatura recorrente (Mercado Pago `preapproval`) — canônico, 2026-09-01

Até aqui todo cliente pagava **30 dias avulsos** e precisava refechar a compra
todo mês. O caminho recorrente já existia no back (`POST /payments/create-subscription`,
webhook tratando `subscription_preapproval` e `subscription_authorized_payment`)
mas **nenhuma tela chamava** — estava pronto e dormente. Agora está ligado.

| Peça | Onde |
|---|---|
| Regras puras (ativa? pode cancelar? estende acesso?) | `src/domain/payments/subscriptionPolicy.js` |
| Criar assinatura + guarda de duplicidade | `POST /payments/create-subscription` |
| Desligar a cobrança automática | `POST /payments/subscription/cancel` |
| Estado para o painel | `GET /payments/overview` → campo `subscription` |
| Rede de segurança da renovação | `runSubscriptionReconciliation` (mesmo tick da reconciliação de pagamento) |
| Tela | `dashboard/app/painel/plano/page.js` |

**Não regredir:**

- **`pending` não é renovação ligada.** O MP cria o preapproval como `pending` e
  só vira `authorized` quando a pessoa conclui. Mostrar "renovação automática
  ligada" para um checkout abandonado faria a cliente achar que está coberta sem
  estar. Quem decide é `summarizeSubscriptionForPanel`, nunca `Boolean(sub)`.
- **Uma assinatura ativa por conta.** `blocksNewSubscription` barra criar a
  segunda enquanto houver uma `authorized` — duas cobrariam a mesma pessoa duas
  vezes por mês. `pending` de propósito **não** bloqueia: é checkout aberto e
  abandonado, e barrar por causa dele travaria a conta para sempre.
- **Cancelar só marca como cancelada DEPOIS que o MP aceita.** Dizer "cancelei" e
  continuar cobrando é o pior desfecho possível — falha do provedor devolve 502 e
  não altera nada aqui. A exceção é `404` no provedor (`provider_not_found`): a
  assinatura não existe mais lá, então cancelar aqui é o que iguala os dois lados.
- **Cancelar NÃO corta o acesso na hora.** O período já pago vale até
  `accessExpiresAt`; cortar seria cobrar o mês e não entregar. A tela diz isso
  antes de confirmar, e o cancelamento pede confirmação (dois cliques).
- **A reconciliação só ESTENDE acesso, nunca encurta**
  (`decideAccessExtensionFromSubscription`). Ela existe porque a renovação
  depende do aviso `subscription_authorized_payment`: se esse aviso se perder
  (rede, deploy no meio, fila em erro), a cobrança acontece e o acesso corta
  assim mesmo — cliente paga e fica sem robô. Como o MP informa a **próxima**
  cobrança, o período pago vai até lá; assinatura `authorized` com acesso
  vencendo antes disso é estendida até a data do MP. Assinatura pausada,
  cancelada ou sem data confiável **não** estende nada.
- **Sem processo PM2 novo** — a passada roda no `setInterval` que já existia para
  a reconciliação de pagamento (política de memória).
- **Linguagem leiga**: "cobrança automática", "desligar", "próxima cobrança".
  Nunca `preapproval`, `authorized`, `gateway` na tela — teste falha se voltar.
- **O identificador do provedor não vai para o navegador** (`mpSubscriptionId`
  fica fora do resumo do painel).

**Eventos que estavam sendo descartados:** `subscription_started`,
`subscription_email_blocked`, `subscription_provider_rejected` e
`subscription_payment_approved` eram EMITIDOS pelas rotas desde sempre e não
estavam na allowlist de `src/analytics.js` — sumiam em silêncio, e por isso não
havia como saber quem tentou assinar nem onde parou (mesmo modo de falha do
`organic_page_view`). Entraram na allowlist junto com `subscription_cancelled` e
`subscription_access_extended`. **Cada `subscription_access_extended` é uma
cliente que teria ficado sem robô depois de pagar** — se aparecer com
frequência, o problema está no webhook, não na reconciliação.

**Antes de validar em staging:** usar token de **sandbox** do MP no `.env` de
staging. Token de produção lá **cobra de verdade**. Trocar env exige
`pm2 delete` + `start` (pegadinha #1). Teste:
`test/subscription-policy.test.js`.

Roteiro de validação em staging (nesta ordem):

1. Ligar a cobrança automática e concluir no MP → o painel precisa mostrar
   "Renovação automática ligada" e a data da próxima cobrança.
2. Tentar ligar de novo → tem que recusar com o aviso de que já está ligada.
3. Desligar → confirmar em dois passos, e o acesso continuar até a data que a
   tela mostrou (conferir `accessExpiresAt` no banco, não só na tela).
4. Assinar de novo depois de cancelar → tem que funcionar (o cancelamento não
   pode deixar a conta travada).
5. Conta com e-mail que o MP recusa → a tela precisa oferecer a troca de e-mail
   e o pagamento avulso, nunca um erro sem saída.
6. Renovação sem aviso: apagar/ignorar o webhook de um ciclo e conferir que a
   passada de reconciliação estendeu o acesso até a próxima cobrança
   (`AnalyticsEvent('subscription_access_extended')`).

### "Seu pagamento foi recusado" no checkout de assinatura (RCA 2026-09-07 — não regredir)

Cliente mandou print do checkout recorrente (Pro, R$69, cartão Visa Santander)
com **"Seu pagamento foi recusado. Recomendamos que você pague com o meio de
pagamento e dispositivo que costuma usar para compras on-line."** Essa frase é
do **antifraude do Mercado Pago** (`cc_rejected_high_risk`), não do banco
emissor — banco recusa com outro texto ("sem limite", "cartão desabilitado").

**A documentação do próprio MP nomeia a causa:** quando duas cobranças seguidas
saem com itens idênticos ou parâmetros muito parecidos, o motor de antifraude
lê como cobrança duplicada e recusa por precaução; a recomendação é
"implementar controles para evitar novas tentativas imediatas com os mesmos
dados de pagamento".

**Nós não tínhamos esse controle — e produzíamos exatamente o padrão que ele
recusa.** `pending` de propósito não bloqueia (senão um checkout abandonado
travaria a conta para sempre), então **cada clique em "Assinar" criava um
preapproval NOVO** com `reason`, `external_reference`, `payer_email` e
`transaction_amount` byte a byte iguais. Quem tentava de novo depois de uma
recusa alimentava a recusa seguinte. Como `Subscription` não guardava o
`init_point`, não havia nem como voltar ao checkout que já existia.

Hoje `decidePendingSubscriptionReuse` (`src/domain/payments/subscriptionPolicy.js`,
pura) manda a pessoa de volta ao checkout em aberto do MESMO plano, e o
`init_point` é recuperado do próprio MP (`GET /preapproval/:id` → campo
`initPoint` do snapshot) — **sem migration, sem coluna nova**.

**Não regredir:**

- **A invariante de que `pending` não trava a conta continua valendo** e é o
  que limita o reaproveitamento: fora da janela de 24h
  (`SUBSCRIPTION_REUSE_MAX_AGE_MS`), com plano diferente, sem identificador do
  provedor ou sem data confiável → cria checkout novo. E só reaproveita o que o
  MP **confirma** que ainda está `pending`: falha de rede ou checkout já
  concluído caem no caminho normal.
- **Não voltar a criar preapproval sem tentar reaproveitar antes** (guarda
  estrutural no teste exige que a decisão venha ANTES da criação).
- **O preapproval manda `notification_url`.** Ele não mandava — só o checkout
  avulso mandava —, então os avisos da assinatura dependiam inteiramente do que
  estivesse marcado no painel do MP, e configurar os eventos
  `subscription_preapproval`/`subscription_authorized_payment` lá era um TODO
  em aberto desde a implementação. Aviso de renovação perdido é a cliente pagar
  e ficar sem robô.
- **Chave de TESTE em produção recusa todo cartão real com ESTA MESMA TELA.**
  `isSandboxTokenInProduction` (`src/domain/payments/accessTokenMode.js`) avisa
  no boot e faz a rota devolver erro próprio, em vez de deixar o time procurar
  defeito no cartão da cliente. Prefixo fora do padrão do MP (`unknown`)
  **não** acusa — alarme falso recorrente treina a pessoa a ignorar o aviso.
- **Linguagem leiga**: a frase da chave errada diz "não pelo seu cartão" e não
  pode conter "sandbox", "token", "gateway" ou "preapproval". Teste falha se
  jargão voltar.

#### O reaproveitamento sozinho NÃO fecha o caso (medição da conta real)

Os três checkouts da cliente que reportou, com os horários do banco:

| checkout | criado | encerrado | viveu |
|---|---|---|---|
| #1 | 09:05:13 | 09:32:44 | 27,5 min |
| #2 | 09:08:31 | 09:32:44 | 24,2 min |
| #3 | **10:02:11** (a recusa do print) | 10:32:44 | 30,6 min |

- **#1 ainda estava `pending` às 09:08:31** → o reaproveitamento cobre o #2.
- **#3 nasceu com #1 e #2 já encerrados** → não havia o que reaproveitar, e um
  checkout novo e idêntico nascia mesmo assim. Era esse o recusado.
- #1 e #2 foram encerrados com **214 ms de diferença**, os dois às `:32:44` —
  é a **nossa reconciliação horária**, não o MP em tempo real.
- ⚠️ **A tabela de pagamentos da conta está VAZIA.** O MP não nos manda aviso
  de pagamento recusado nesse fluxo: não existe registro da recusa em lugar
  nenhum, então **não dá para reagir a ela**. O único sinal que temos é a
  repetição — vários checkouts do mesmo plano em pouco tempo, nenhum virando
  assinatura.

Por isso `decideSubscriptionAttemptCooldown` (pura) segura a tentativa quando
já houve `SUBSCRIPTION_ATTEMPT_MAX` (2) checkouts do mesmo plano em
`SUBSCRIPTION_ATTEMPT_WINDOW_MS` (6h) sem nenhum virar assinatura ativa,
liberando de novo `SUBSCRIPTION_ATTEMPT_COOLDOWN_MS` (2h) depois da última.

**Não regredir:**

- **A espera é sempre LIMITADA e o pagamento avulso continua aberto** — a conta
  nunca fica sem forma de pagar. Segurar a terceira tentativa protege a
  cliente: cada checkout idêntico a mais piora a leitura do antifraude, e
  insistir é o caminho mais rápido para nenhuma tentativa passar.
- **Fail-safe é DEIXAR TENTAR**, nunca barrar por dúvida: sem histórico
  confiável, com assinatura ativa na janela, sem data ou com
  `SUBSCRIPTION_ATTEMPT_MAX=0` (escape hatch), a tentativa passa. Barrar por
  dúvida impediria uma compra legítima, que é pior que a recusa.
- **Plano diferente não conta** — trocar de plano é intenção nova, não
  repetição.
- **O texto diz as três coisas ou não serve**: que o cartão dela não é o
  problema, quando ela pode voltar, e que o avulso está disponível agora. Nada
  de "antifraude", "preapproval", "gateway", "checkout" na tela — teste falha
  se jargão voltar.

Sinais `subscription_checkout_reused` e `subscription_attempt_throttled`
(allowlist em `src/analytics.js`) — cada um é uma recusa por antifraude que
deixou de acontecer. Volume alto no segundo é sinal de que muita gente está
batendo na recusa, **não** de que a trava está apertada demais.

⚠️ **A tela de recusa é a mesma para causas com ações opostas.** Antes de
responder à cliente, rode o diagnóstico (read-only, no diretório do ambiente):

```bash
cd ~/wabot && node scripts/diag-assinatura-recusada.mjs <email> --days=7
```

Ele separa os três casos: chave de teste em produção, checkouts repetidos e
idênticos, ou recusa que veio de fato do banco/cartão dela (aí a ação é outro
cartão ou o pagamento avulso). Não imprime segredo — da chave só sai o modo.

#### A repetição nunca explicou a PRIMEIRA tentativa (revisão 2026-09-07)

Na conta medida, o #1 é de 09:05:13 e o #2 de 09:08:31 — **três minutos
depois**. Não havia o que repetir no #1, e mesmo assim ela tentou de novo: o
#1 já tinha falhado por outra coisa. A repetição explica o #2 e o #3, **não a
causa de origem**, e enquanto ela não for conhecida corremos o risco de
consertar o sintoma.

⚠️ **"O MP não nos manda aviso de pagamento recusado nesse fluxo" é inferência
a partir da tabela vazia, NÃO medição — e a doc do MP diz o contrário:** para
assinatura sem plano associado, além de `subscription_preapproval` /
`subscription_authorized_payment`, o painel precisa ter o evento **`payment`**
marcado, "que permite receber notificações sobre os pagamentos associados a
essas assinaturas". A tabela vazia tem duas explicações e só uma foi
verificada, porque **nós jogamos a recusa fora**: em
`src/api/routes/payments.js`, o processamento do evento `payment` só tem dois
ramos — estorno (`isReversiblePaymentStatus`) e `approved`. **`rejected` não
cai em nenhum dos dois**: não vira linha em `Payment`, não vira log, não vira
sinal, e o `status_detail` (que `fetchMercadoPagoPaymentSnapshot` já lê) é
descartado. O payload cru, porém, **está gravado em `WebhookEvent`** desde
sempre — é de lá que o diagnóstico recupera o motivo.

Os blocos `[3]` e `[4]` do script perguntam ao MP o que ele registrou:

- **`[3]` o motivo exato** — lê os `WebhookEvent` de tipo `payment` da janela e
  consulta `GET /v1/payments/:id` → `status_detail`, traduzido para o que
  significa e de quem é a ação. **Nenhum aviso na janela também é achado:**
  significa que nenhuma cobrança chegou a ser tentada, e aí "cobrança recusada"
  deixa de explicar o caso.
- **`[4]` o estado do checkout** — `GET /preapproval/:id` → `card_id` /
  `payment_method_id` vazios provam que **nenhum cartão foi vinculado** (ela
  não concluiu, nada foi cobrado), `summarized.charged_quantity` conta as
  cobranças e `last_modified` diz **quando o MP encerrou de verdade** (a hora
  do nosso banco é a da passada horária que copiou o estado).

O `GET /preapproval/:id` **não tem `status_detail`** — o motivo da recusa mora
na fatura (`GET /authorized_payments/:id` → `payment.status_detail`). Não
procurar no lugar errado.

#### O diagnóstico mentia por dois defeitos próprios (2026-09-07)

Rodado em produção com o e-mail da cliente, o script respondeu **"nenhuma conta
encontrada"** — e a conta existe com exatamente esse e-mail. Rodado sem alvo,
ela aparece, e aí ele concluiu **"a recusa veio do cartão/banco da cliente"**
para três checkouts do mesmo plano em 57 minutos. As duas respostas estavam
erradas, por motivos diferentes:

- **`User` não tem coluna `phone`, tem `contactPhone`.** Com o nome errado o
  Prisma recusa a consulta INTEIRA, e o `.catch(() => [])` transformava o erro
  em resposta: "não achei" em vez de "não consegui procurar". Erro engolido em
  script de diagnóstico é pior que erro na cara — ele vira conclusão. Agora a
  falha é impressa.
- **A repetição era medida pelo que continua `pending` AGORA.** A reconciliação
  horária encerra os checkouts anteriores, então o padrão que a correção existe
  para tratar fica invisível justamente depois que ele acontece. Passou a ser
  medida por checkouts **criados** dentro de `SUBSCRIPTION_ATTEMPT_WINDOW_MS`
  (a mesma constante da regra de espera, para diagnóstico e produto não
  discordarem).

Junto: os horários do script saem em **UTC** e agora são marcados com `Z`. Os
mesmos três checkouts são 09:05/09:08/10:02 na tabela acima (Brasília) e
12:05/12:08/13:02 no banco — sem a marca, parecem checkouts diferentes.

⚠️ **Achado de produção que confirma a correção do `updatedAt`:** a conta
`flavia.vale@usp.br` tinha um checkout `pending` de **5 dias antes** marcado
como `reaproveitavel=sim`. Fora da janela de 24h declarada, exatamente como
descrito abaixo.

#### Duas correções na própria correção (2026-09-07)

- **A janela de reaproveitamento conta do `createdAt`, nunca do `updatedAt`.**
  `Subscription.updatedAt` é `@updatedAt` no schema: a reconciliação horária e
  o webhook renovam o campo sozinhos. Contando por ele, um checkout de dias
  atrás parecia recém-criado, **a janela de 24h nunca expirava** e a cliente
  era devolvida para sempre ao mesmo link velho — e o freio entre tentativas
  nunca rodava, porque o reaproveitamento responde antes dele.
- **`subscription_started` só sai quando um checkout NOVO nasce.** Emitido
  antes do reaproveitamento, ele contava junto o clique devolvido ao checkout
  em aberto e o adiado pela espera: os três caminhos viravam um número só e não
  dava para ver quantas clientes batiam em cada um. Hoje cada caminho tem o seu
  (`subscription_checkout_reused`, `subscription_attempt_throttled`,
  `subscription_started`), sem sobreposição.

Teste: `test/subscription-checkout-reuse.test.js`.

### "Assinou recorrente e o painel diz que ela não terminou" (RCA 2026-09-07 — não regredir)

Cliente assinou com renovação automática, viu a mensagem de sucesso, o acesso
foi liberado e o pagamento entrou. Mesmo assim o painel dela dizia **"Renova
manualmente"** e **"Você começou a ligar a cobrança automática e não terminou no
Mercado Pago"**, e no admin a tag era "Recorrente · Falta concluir no Mercado
Pago" — para uma conta que estava pagando.

**Causa raiz: o aviso da COBRANÇA nunca encostava no status da assinatura.**
Em `src/api/routes/payments.js`, o ramo `subscription_authorized_payment`
liberava o acesso (`activateSubscriptionAccess`) e ia embora. Quem sincroniza o
status é o ramo `subscription_preapproval` **ou** a reconciliação, que passa de
**hora em hora**. Então: (1) quem só recebe o aviso da cobrança fica `pending`
para sempre, cobrando todo mês; (2) mesmo quando o outro aviso chega, existe uma
janela de até uma hora em que a cliente lê "você não terminou" logo depois de
pagar — e é justamente aí que ela abre o painel.

Três consertos, todos com regra pura em `subscriptionPolicy.js`:

- **`decideSubscriptionStatusFromCharge`** — a cobrança aprovada acerta o
  status. O que o MP responde na consulta do preapproval é a verdade e ganha de
  tudo; sem resposta (rede/token), a própria cobrança é prova e **só promove
  `pending`** — assinatura pausada ou cancelada nunca é ressuscitada por aqui.
- **`shouldRefreshPendingSubscription`** — `GET /payments/overview` consulta o
  MP sob demanda quando o checkout ainda está `pending`. Limitado de propósito:
  só checkout criado nas últimas 24h e **no máximo uma consulta por minuto por
  assinatura** (o painel é aberto o tempo todo, isso não pode virar uma chamada
  ao provedor por carregamento de tela). Falha na consulta **nunca** derruba a
  tela de plano.
- **`describePendingSubscriptionNotice`** — `pending` significa duas coisas
  OPOSTAS e tinha uma frase só. Sem pagamento depois do checkout, ela de fato
  parou no meio. **Com** pagamento aprovado depois do checkout, o MP cobrou e o
  que falta é a confirmação chegar até nós: a frase passa a ser "seu acesso já
  está liberado, estamos confirmando, você não precisa fazer nada, **não assine
  de novo**". Isso não é cosmético — mandar quem já pagou assinar de novo é
  exatamente o padrão que dispara a recusa do antifraude (seção acima).

**Não regredir:**

- **O texto mora no backend** (`summarizeSubscriptionForPanel().notice`), não na
  tela: painel e admin precisam dizer a mesma coisa sobre a mesma assinatura.
  Teste falha se a frase fixa voltar para `dashboard/app/painel/plano/page.js`.
- **A tag do admin separa os dois casos** ("Recorrente (confirmando)", âmbar, vs.
  "Recorrente (não concluída)"), decidida pelo backend com o **último pagamento
  aprovado** — que sai do `_max` do `groupBy` que já existia, **sem consulta
  nova**. Pagamento antigo (avulso de meses atrás) não vira "confirmando":
  a janela é o pagamento a partir do nascimento daquele checkout.
- **`pending` continua não sendo "renovação ligada"** e continua não travando a
  conta — nada aqui mexe nessas duas invariantes.
- Linguagem leiga: nada de `preapproval`, `authorized`, `webhook` na tela.

Sinal `subscription_status_synced` (allowlist em `src/analytics.js`): cada um é
uma cliente que teria lido "falta concluir" depois de pagar. Volume alto aponta
para aviso de preapproval não chegando — conferir os eventos marcados no painel
do MP.

**Como conferir que a cobrança automática vai mesmo acontecer, sem esperar 30
dias:** `node scripts/testar-recorrencia.mjs <email>` (read-only) confere os
seis elos um a um — assinatura valendo no MP com cartão vinculado, cobrança já
feita, aviso chegando, aviso processado sem erro, nosso banco espelhando o MP e
acesso cobrindo até a próxima cobrança. O elo que mais quebra é o **aviso**, e
ele quebra em silêncio: cobrança registrada no MP (item 2) sem aviso nenhum
(item 3) significa evento não marcado no painel do Mercado Pago —
`subscription_preapproval`, `subscription_authorized_payment` **e** `payment`.
Um `subscription_access_extended` na janela é a rede de segurança tapando
exatamente esse buraco.

Para acertar uma conta AGORA (e responder "ela precisa fazer algo no Mercado
Pago?"), read-only por padrão:

```bash
cd ~/wabot && node scripts/sincronizar-assinatura.mjs <email>          # só mostra
cd ~/wabot && node scripts/sincronizar-assinatura.mjs <email> --aplicar # grava o que o MP respondeu
```

Teste: `test/subscription-policy.test.js`.

## ADMIN > Financeiro > ROI e conta de teste fora das somas (2026-09-17)

Duas coisas da mesma conversa. (1) A assinatura de `tacianeaas02@gmail.com`
existe só para validar a cobrança recorrente — esse dinheiro **não cai no
caixa** e estava inflando receita, MRR, LTV e pagantes. (2) O Financeiro sabia
quanto ENTRA e o que sai para afiliados e para o Mercado Pago, mas **nunca
soube quanto custa manter o produto de pé** — e sem isso "receita" não é lucro
e não havia como responder "valeu a pena até agora?".

| Peça | Onde |
|---|---|
| Contas de teste fora das somas (PURO) | `src/domain/admin/testAccounts.js` |
| Etiqueta na tela | `dashboard/components/TestAccountTag.js` |
| Ledger de custos (faturas + patamar fixo, PURO) | `src/domain/admin/operatingCosts.js` |
| Passado/presente/futuro, payback, cenários (PURO) | `src/domain/admin/roi.js` |
| Rota | `GET /api/admin/finance/roi?months=12` (`billing:read`, auditada) |
| Tela | `RoiPanel` em `dashboard/app/admin/page.js` (sub-aba ROI) |

**Não regredir:**

- **REALIZADO e PREVISTO nunca viram um número só.** O "investido até agora" e
  o acumulado do passado param no último mês FECHADO; o mês corrente é
  `parcial` e a projeção é `previsto`, cada um rotulado. Somar projeção dentro
  do que já é fato é decidir dinheiro em cima de número inventado.
- **A conta de teste some da SOMA, nunca da TELA.** Ela continua nas listas,
  nas cobranças recorrentes e no ROI com etiqueta 🧪 — é ela que está sendo
  observada. Linha aparecendo na lista e sumindo do total, sem explicação,
  pareceria defeito.
- **A exclusão é decidida no backend**, aplicada em TODAS as agregações de
  `/finance/overview` e `/finance/roi` (receita, LTV, pagantes, planos ativos,
  comissões, taxas) — senão duas tabelas do admin discordam sobre o mês. Guarda
  estrutural no teste varre a rota atrás de soma de pagamento sem o filtro.
- **Fail-safe é NÃO excluir ninguém**: falha de banco ao resolver as contas de
  teste devolve lista vazia. Sumir com receita por causa de um blip é pior que
  contar a assinatura de teste por mais um carregamento de tela.
- **`FINANCE_TEST_ACCOUNT_EMAILS` SUBSTITUI a lista** (vazio = nenhuma). É como
  a conta de teste vira cliente de verdade sem deploy.
- **Fatura em dólar é guardada em dólar** e convertida na leitura
  (`USD_BRL_RATE`, default 5,80). Guardar convertido trava a conta numa cotação
  que ninguém lembra de onde saiu.
- **O ledger histórico PARA onde a recorrência começa** (`2026-09`). Setembro
  entra com o patamar fixo cheio (R$ 565 Claude + R$ 190 servidor), que é maior
  que a fatura real de R$ 535,22 daquele mês — o passado nunca fica
  subestimado, e nenhum mês é contado duas vezes. Mexer em
  `COST_RECURRING_START_MONTH` exige mexer no ledger junto.
- **Crescimento observado exige amostra e tem TETO.** Menos de 3 meses fechados
  com receita → cenário sem crescimento. Acima de 20%/mês → limitado (20%/mês
  já multiplica a receita por ~9 em um ano). Queda não vira crescimento
  negativo composto.
- **A projeção respeita o teto de clientes do servidor**
  (`MAX_SESSIONS_PER_PROCESS`, default 20; **produção está em 80** desde
2026-09-18): cheio, nenhuma cliente nova conecta —
  receita que a infra não entrega não é receita, e o custo de crescer não está
  nesta conta.
- **Sem dado confiável NÃO se afirma nada**: sem cliente pagante,
  `breakEvenCustomers` e `paybackMonth` são `null`, não zero.
- **O gráfico não depende só da cor.** Verde e vermelho é o par que quem tem
  daltonismo mais confunde (ΔE 6,0 em deuteranopia) — só é aceitável com
  codificação secundária, e aqui ela é a linha do zero, o valor escrito com
  sinal e o tracejado do previsto. Não remover nenhuma das três. O desenho
  ainda **corta pouco depois da travessia do zero**: crescimento composto faz a
  última barra ficar dezenas de vezes maior e achata justamente o vermelho de
  hoje. Todos os meses continuam na tabela.
- **Linguagem leiga**: "entrou", "saiu", "sobrou", "se paga em". Teste falha se
  `payback`, `break-even`, `churn` ou `runway` chegarem à tela.
- **Custo: só leitura, nenhum processo novo, zero impacto de RAM.** Duas
  consultas de linhas por carregamento (pagamentos aprovados e comissões desde
  a primeira fatura, teto de 20.000), e a sub-aba só busca quando é aberta.

Envs (todas opcionais): `FINANCE_TEST_ACCOUNT_EMAILS`, `USD_BRL_RATE`,
`COST_CLAUDE_MONTHLY_BRL`, `COST_VPS_MONTHLY_BRL`, `COST_RECURRING_START_MONTH`.

⚠️ **Aumentar o teto de clientes muda a projeção** (o teto de receita sai de
`MAX_SESSIONS_PER_PROCESS`), e continua valendo que subir esse teto é mudança
memory-heavy — ver "Teto de robôs por processo".

Teste: `test/admin-roi.test.js`.

## ADMIN > Financeiro > Cobranças recorrentes (2026-09-07)

Sub-aba dentro do Financeiro com **uma linha por TENTATIVA de cobrança** da
assinatura recorrente: quando foi tentada, de quem, plano, valor, resultado,
**código de retorno do Mercado Pago** (`status_detail`, cru) e **o que ele
significa junto de quem precisa agir**, número da tentativa e quando o MP tenta
de novo.

| Peça | Onde |
|---|---|
| Tradução do retorno + resumo (PURO, sem banco) | `src/domain/payments/chargeOutcome.js` |
| Tabela da tentativa | `SubscriptionCharge` (migration `20260907190000_subscription_charge`) |
| Gravação na hora do aviso | ramo `subscription_authorized_payment` em `src/api/routes/payments.js` |
| Histórico completo (inclusive recusa sem aviso) | `fetchMercadoPagoSubscriptionInvoices` em `runSubscriptionReconciliation` |
| Rota | `GET /api/admin/finance/subscription-charges` (`billing:read`, auditada) |
| Tela | `SubscriptionChargesPanel` em `dashboard/app/admin/page.js` |

**Por que a tabela precisou existir:** cobrança **recusada não virava registro
nenhum**. O ramo `payment` do webhook só trata estorno e aprovado, então
`rejected` caía fora dos dois, não gerava linha em `Payment`, não virava log e o
`status_detail` era descartado — só o payload cru sobrevivia em `WebhookEvent`.
Não havia como responder "o que o banco respondeu e quando" sem consultar o MP
link a link.

**Não regredir:**

- **A tentativa é gravada ANTES de qualquer decisão de acesso e para TODO
  status.** Recusa não mexe em acesso — é justamente ela que precisa aparecer.
  Teste falha se a gravação voltar para dentro do ramo de aprovado.
- **O Mercado Pago é a fonte da verdade, não o nosso webhook.** A recusa pode
  não gerar aviso nenhum; por isso a passada horária lê
  `/authorized_payments/search` por assinatura. Chave é o id da fatura
  (`mpAuthorizedPaymentId`), então webhook e sincronização escrevem a MESMA
  linha — aviso repetido não duplica histórico.
- **Sem processo PM2 novo e sem timer novo**: roda no tick da reconciliação que
  já existia (política de memória). Uma chamada a mais por assinatura aberta,
  por hora.
- **A tela NUNCA chama o Mercado Pago.** Consulta ao provedor por carregamento
  de tela é o caminho mais rápido para a aba ficar lenta e estourar limite.
- **O código cru fica visível.** É ele que abre caso no Mercado Pago. O que a
  tradução acrescenta é **de quem é a ação** (`CHARGE_ACTION_OWNERS`) — o mesmo
  código manda fazer coisas opostas: `cc_rejected_high_risk` é ação NOSSA (não
  repetir tentativa idêntica), `cc_rejected_insufficient_amount` é da cliente
  (outro cartão), `cc_rejected_blacklist` é do próprio MP.
- **Código que ainda não mapeamos aparece cru com "fora da nossa lista"** — nunca
  vira tela vazia nem uma explicação inventada.
- **A tradução mora em UM lugar**, compartilhada com
  `scripts/diag-assinatura-recusada.mjs` (que antes tinha cópia própria).
- **O resumo é do PERÍODO, não da página** (teto de 5.000 linhas) — número que
  muda ao virar a página é número em que ninguém confia. E **`taxaSucesso` é
  `null` sem cobrança decidida**: 0% seria mentira.
- **"Assinaturas em risco" é o número que mais importa**: assinatura cuja ÚLTIMA
  tentativa foi recusada é receita que já existe indo embora sem ninguém decidir
  nada. Quem voltou a cobrar depois da recusa não conta.
- Busca sem resultado devolve **vazio**, nunca a lista inteira.
- A sub-aba só busca dados **quando é aberta**.

⚠️ **Histórico começa no deploy.** A tabela nasce vazia e a passada horária só
enxerga assinaturas ainda abertas (`SUBSCRIPTION_OPEN_STATUSES`) — cobrança de
assinatura já cancelada antes do deploy não entra sozinha. Aba vazia em conta
recém-assinada é o esperado: só aparece linha depois que o MP tenta cobrar.

Teste: `test/admin-cobrancas-recorrentes.test.js`.

## Plano B da cobrança: o que fazer quando ela quebra em silêncio (2026-09-08)

Toda a corrente da cobrança quebra **sem derrubar nada**: o aviso do Mercado
Pago que deixa de chegar, a chave que vence, a rede de segurança desligada, a
cobrança que passa a ser recusada. O sistema fica verde e o dinheiro para de
entrar. Três frentes, e um canal novo de aviso.

| Peça | Onde |
|---|---|
| "A máquina está de pé?" (PURO) | `src/domain/payments/billingHealth.js` |
| Quem avisar quando a cobrança é recusada (PURO) | `src/domain/payments/chargeFailureNotice.js` |
| Reação à recusa (cliente + admin) | `reagirACobrancaRecusada` em `src/api/routes/payments.js` |
| Rede de segurança com interruptor PRÓPRIO | `startBillingReconciliation` (idem) |
| Conferência no boot | `checkBillingConfigAtBoot` (idem) |
| Avisos internos por e-mail (para a administradora) | `src/email/adminAlerts.js` |
| Faixa de alarme no Financeiro | `SubscriptionChargesPanel` (campo `health`) |
| Faixa da cobrança recusada no painel da cliente | `dashboard/app/painel/plano/page.js` (`chargeFailure`) |

### 1. A rede de segurança não podia depender de OUTRA env (era o pior defeito)

`runPaymentReconciliation` / `runSubscriptionReconciliation` viviam **dentro**
de `startWebhookProcessor`, que retorna cedo quando `BILLING_WEBHOOK_AUTOPROCESS`
não é `'true'` — e o default dela é `false`. Ou seja: quem não ligou o
processamento imediato do aviso estava, sem saber, **sem a única coisa que
conserta um aviso perdido**. `PAYMENT_RECONCILIATION_ENABLED` existia e não
valia de nada nesse caso. **Não regredir:** teste falha se `startWebhookProcessor`
voltar a conter `PAYMENT_RECONCILIATION_ENABLED`.

### 2. A cliente é avisada ENQUANTO o acesso dela ainda vale

Cobrança recusada dispara o e-mail `cobranca_recusada` — com o motivo traduzido
e **o que fazer, que muda conforme de quem é a ação**: mandar "atualize seu
cartão" quando o bloqueio foi do lado do Mercado Pago faz ela mexer no que está
certo e desconfiar do produto. A mesma explicação vira faixa no painel, **antes
dos planos**.

**Não regredir:**
- **Nunca mandar "assine de novo"** — tentativa idêntica repetida é o padrão que
  dispara a recusa por suspeita do próprio MP (RCA 2026-09-07). O texto oferece
  **atualizar o cartão** ou **o pagamento avulso**, nunca refazer a assinatura.
- **Recusa com mais de 72h não vira e-mail** (`recusa_antiga`): a passada
  horária lê o histórico INTEIRO do MP, e sem esse teto o primeiro deploy
  mandaria e-mail de cobranças de meses atrás, algumas já resolvidas.
- **Cobrou depois → não avisa** (`ja_cobrou_depois`), e no máximo 1 aviso por
  cliente a cada `CHARGE_FAILURE_NOTICE_COOLDOWN_HOURS` (48h).
- **Não corta acesso**: o período já pago vale até o fim, e o texto diz isso.

### 3. Alarme quando a máquina para (aba Financeiro + boot)

`assessBillingMachine` cruza configuração + medições e devolve os problemas em
frase, com o que fazer. O que ele pega: chave ausente/de teste, aviso sem
assinatura, processamento e rede de segurança desligados, conferência parada há
mais de 3h, assinatura ativa sem cobrança nenhuma há mais de 48h e **recusa em
série** (>50% em 7 dias, com amostra mínima de 5 — aí a causa costuma ser nossa,
não o cartão de cada cliente).

**Não regredir:** **sem medição confiável NÃO se alarma** — vira `sem_medicao`
(cinza), nunca vermelho; alarme falso recorrente treina a pessoa a ignorar
justamente este. Silêncio de cobrança só conta com assinatura ativa. Chave de
teste e webhook sem assinatura só acusam em **produção** (em staging é o estado
correto).

### 4. Avisos internos: e-mail para a ADMINISTRADORA

`src/email/adminAlerts.js` manda para `ADMIN_ALERT_EMAIL` (default
`flaviaroberta.1496@gmail.com`). Três avisos, no grupo `interno` do catálogo —
**editáveis pela aba E-mails** como qualquer outro:

| Slug | Quando sai |
|---|---|
| `admin_cobranca_recusada` | uma cobrança de assinatura foi recusada (com cliente, valor, código e o que significa) |
| `admin_cobranca_maquina_parada` | a cobrança está mal configurada ou parou (boot e diagnóstico) |
| `admin_pagamento_com_falha` | pagamento aprovado que **não virou acesso** — cliente pagou e ficou sem robô |

**Não regredir:**
- **Caminho PRÓPRIO, fora do despachante da cliente.** As travas de lá
  (descadastro, conta parada, teto semanal, endereço fabricado) são regras de
  relacionamento com a CLIENTE e nenhuma pode calar um alerta de operação. As
  travas que valem aqui são outras: **cooldown de 24h por assunto** (rajada de
  falha não pode virar rajada de e-mail) e o mesmo `EmailSendLog` para auditar.
- **`audience: 'admin'` é barrado nos dois sentidos**: `sendAdminAlert` recusa
  template que não seja interno, e o disparo em massa (`POST /emails/send`)
  recusa template interno — o texto fala de problema nosso e é endereçado a você.
- **Sem SMTP não grava "enviado"**, senão a janela de cooldown queimaria sem
  ninguém ter recebido nada (mesma regra do resto do motor).
- Envs: `ADMIN_ALERT_EMAIL`, `ADMIN_ALERT_ENABLED` (só o valor exato `false`
  desliga). Desligar não esconde nada: os problemas seguem no log e na aba
  Financeiro.

Sinais: `subscription_charge_failed_notified` (cada um é uma cliente avisada a
tempo) e `ops_billing_config_problem`. **Zero do primeiro com recusa
acontecendo significa que o aviso parou de sair.**

⚠️ **Nada disso funciona sem SMTP.** Sem `SMTP_*` no `.env`, todo envio é no-op
silencioso — inclusive os avisos internos. Conferir antes de concluir que o
alarme não dispara.

Teste: `test/cobranca-plano-b.test.js`.
