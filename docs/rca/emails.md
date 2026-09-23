# emails — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## E-mail transacional (boas-vindas) — opcional, no-op sem SMTP

O e-mail de boas-vindas pós-signup (`src/email/welcomeEmail.js`) é enviado
por `src/email/mailer.js`, um transporte SMTP provider-agnóstico (nodemailer).
É **opcional**: sem as envs `SMTP_*`, todas as funções viram **no-op
silencioso** (`{ skipped: true }`) — o signup nunca quebra e os testes seguem
db-free/env-free. O envio é fire-and-forget no `POST /register` e só dispara
para e-mails **reais** informados pelo usuário (não para o fallback
`user_*@sistema.com`).

| Env             | Obrigatória? | O que faz                                                       |
|-----------------|--------------|-----------------------------------------------------------------|
| `SMTP_HOST`     | para ativar  | Host do servidor SMTP (ex.: `smtp.gmail.com`). Sem ela → no-op. |
| `SMTP_PORT`     | não          | Porta (default `587`).                                          |
| `SMTP_SECURE`   | não          | `true` para TLS direto (porta 465); default `false`.            |
| `SMTP_USER`     | para ativar  | Usuário de autenticação.                                        |
| `SMTP_PASS`     | para ativar  | Senha / app password.                                           |
| `SMTP_FROM`     | não          | Remetente exibido (default = `SMTP_USER`).                      |

### Aviso "o código de acesso da loja venceu" (não regredir)

Caso real (ago/2026): cliente ficou **uma semana** com o código de acesso do ML e
o da Amazon mortos (0 link curto em 7 dias, 100% plano B) sem ninguém perceber —
o aviso só existia dentro do painel, e as ofertas continuavam saindo, então nada
gritava. `src/credentialExpiry/` fecha esse buraco por e-mail.

- **Onde roda:** `setInterval` + `unref()` no boot da API
  (`startCredentialExpirySweep`, `src/api/server.js`), mesmo padrão de
  `startLeadNurtureSweep`. **Sem processo PM2 novo, sem worker, sem dependência
  nova** — cron dedicado foi descartado por custar um processo Node inteiro para
  rodar 1×/dia (política de memória).
- **Só `alive === false` dispara.** `alive === null` (rede, 403, 429, sondagem
  ocupada) é indeterminado e NUNCA vira aviso — mandaria a cliente recadastrar um
  código vivo. Não afrouxar isso.
- **Anti-spam:** no máximo 1 aviso por cliente/loja a cada
  `CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS` (default 7), persistido no
  `AnalyticsEvent('credential_expiry_alert_sent')` (sem tabela/migration nova). A
  janela é checada **antes de sondar** — quem já foi avisado não gera chamada
  extra à loja. Sem SMTP o evento não é gravado (a janela não queima à toa).
- **Nunca dizer que o envio parou — no ML e na Amazon.** O plano B continua
  enviando e a comissão continua sendo dela; a diferença é link mais comprido (e,
  no ML, cupom sem produto deixa de ser convertido). Vocabulário leigo
  obrigatório, com teste que falha se jargão voltar
  (`test/credential-expiry-alert.test.js`).
- **Shopee é o caso OPOSTO e tem e-mail próprio (`chave_shopee_recusada`).**
  Sem chave aceita, a conversão da Shopee falha inteira: a oferta vira
  `skip:no_valid_conversions`, **nada é publicado**, e as ofertas automáticas
  param junto (o dispatcher morre no `fetchOffers`). Mandar ali o texto
  tranquilizador de "continua saindo" seria mentira e faria a cliente ignorar
  prejuízo real — por isso `buildExpiryAlerts` (`credentialExpiry/message.js`)
  separa os dois e-mails, e há teste que falha se o texto da Shopee voltar a
  prometer que as ofertas continuam. **Não fundir os dois textos.**

### A recusa registrada nos envios também confirma (RCA 2026-08-20 — não regredir)

Duas clientes ficaram **4 e 7 dias** com o código de acesso do Mercado Livre
recusado — 1.697 e 1.042 recusas gravadas, **zero link curto** — sem receber um
aviso sequer. O gatilho do e-mail dependia SÓ da sondagem, e a sondagem do ML
passa por `withMercadoLivreCredentialLock`: com o bot usando a credencial o
tempo todo, ela volta `busy` → `alive:null` → nunca vira aviso (regra correta,
gatilho insuficiente). O robô sabia da recusa e o aviso não saía.

Agora `runCredentialExpirySweep` consulta **primeiro** `loadRefusalEvidence`
(`src/credentialExpiry/sweep.js`): recusas no `MessageLog` na janela
(`ml_ssid_expired`) versus ofertas que saíram com link curto (`meli.la`). Só é
conclusivo com **volume de recusa E nenhum link curto na janela** — um único
link curto derruba a conclusão (credencial viva com instabilidade pontual não
pode virar "seu código venceu"). Evidência conclusiva **pula a sondagem**, o que
também poupa rotação de credencial.

Envs: `CREDENTIAL_REFUSAL_EVIDENCE_WINDOW_HOURS` (24),
`CREDENTIAL_REFUSAL_EVIDENCE_MIN_COUNT` (20). Banco indisponível ou loja sem
marcador conhecido (`REFUSAL_EVIDENCE_WARNING`, hoje só ML) devolve
inconclusivo e cai na sondagem — nunca avisa por dúvida. Teste:
`test/credential-refusal-evidence.test.js`.

### Aviso "a Shopee parou de aceitar a chave" (RCA 2026-08 — não regredir)

O comentário original de `EXPIRY_ALERT_PLATFORMS` afirmava que App ID + chave
secreta "não vencem sozinhos", e por isso a Shopee ficou **fora** da cobertura.
É falso: uma conta real (`victoriaiq9@gmail.com`) passou dias com a chave
recusada (`error [10020]: Invalid Signature`), com 100% das ofertas de Shopee
descartadas e as duas automações dela sem enviar **uma única vez** — em
silêncio total. Foi descoberto só numa investigação manual. **Não tirar a Shopee
de `EXPIRY_ALERT_PLATFORMS`.**

- Sondagem: `checkShopeeSession` (`src/converters/shopee.js`), mesmo contrato
  `{ configured, alive, reason }` do ML/Amazon. Usa uma consulta **só de
  leitura** (`productOfferV2` com `limit: 1`) — não gera link nem grava nada do
  lado da Shopee, então **não precisa de cache de sondagem** (diferente do
  ML/Amazon, onde o probe rotaciona credencial).
- **Só os códigos `10020` e `10035` viram `alive:false`** (`SHOPEE_AUTH_REJECTED_CODES`, com
  a classificação pura em `classifyShopeeProbeResponse`). Qualquer outro código,
  HTTP != 200, timeout ou rede fora fica **indeterminado**. Lembre que a API de
  afiliado responde **200 mesmo em erro**, sinalizando via `errors` — por isso a
  classificação lê o corpo, não só o status.
- Armadilha de diagnóstico: chave recusada e credencial incompleta produzem
  sintomas parecidos no painel, mas são coisas diferentes — campo faltando não
  chega a ser sondado (o painel já diz "falta preencher").
- **O painel também avisa** (`GET /credentials/shopee/session` + sondagem no
  `PUT /credentials/shopee`, via `PLATFORMS_WITH_SESSION_CHECK`). Antes disso o
  painel mostrava a Shopee em VERDE com a chave morta — só conferia o formato
  dos campos —, e era por isso que ninguém percebia. E-mail avisando com painel
  verde ao mesmo tempo é pior do que não avisar: as duas pontas andam juntas.
- **Texto da Shopee é o oposto do das outras duas, nas TRÊS superfícies**
  (e-mail, banner do painel, mensagem do save): "as ofertas da Shopee param de
  sair", nunca "continuam saindo, só o link fica mais comprido". Guardas em
  `test/credential-save-session-check.test.js` e
  `test/credentials-shopee-session-route.test.js`.
- Vocabulário: na Shopee é **"chave"** (App ID + chave secreta), não "código de
  acesso" — esse termo é dos cookies de sessão do ML/Amazon.
- Envs (todas opcionais): `CREDENTIAL_EXPIRY_ALERT_ENABLED`,
  `CREDENTIAL_EXPIRY_SWEEP_INTERVAL_MS`, `CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS`.
  Sem SMTP a passada nem começa. Runbook de ligar o SMTP:
  `docs/ops/aviso-codigo-acesso-vencido.md` (lembrar da pegadinha #1 —
  `pm2 delete` + `start`, não `restart --update-env`).

### Motor de e-mails (canônico — todo e-mail passa por aqui)

Antes cada e-mail tinha seu próprio builder e suas próprias regras. Hoje há um
caminho só, e a cliente edita os textos pelo painel.

| Peça | Onde |
|---|---|
| Catálogo (texto padrão de todos os e-mails) | `src/email/registry.js` |
| Formato do texto (parágrafo, lista, botão, `{{variavel}}`) | `src/email/markup.js` |
| Moldura visual + rodapé de descadastro | `src/email/layout.js` |
| Despachante (ÚNICO caminho de envio, com todas as travas) | `src/email/dispatcher.js` |
| Fila lenta dos disparos em massa | `src/email/queue.js` |
| Filtros de público (puro) | `src/email/audience.js` |
| Descadastro por categoria (LGPD) | `src/email/optOut.js` + `/api/emails/unsubscribe` |
| Gatilhos por ciclo de vida (passada diária) | `src/emailTriggers/lifecyclePolicy.js` + `lifecycleSweep.js` |
| Gatilhos por acontecimento | `src/emailTriggers/events.js` |
| Resumo semanal | `src/emailTriggers/weeklySummary.js` |
| Aba E-mails do admin | `src/api/routes/adminEmails.js` + `dashboard/app/admin/emails/page.js` |

**Não regredir:**
- **Não enviar e-mail fora do despachante.** Ele é quem barra endereço
  fabricado (`user_*@sistema.com`), conta banida/suspensa, descadastro
  (marketing), repetição dentro da janela do próprio e-mail (`dedupDays`) e o
  teto diário. Gatilho novo = `sendTemplateEmail`, nunca `sendMail` direto.
- **Texto padrão mora no código; o painel grava só override** (`EmailTemplate`).
  Sem linha lá, vale o código — apagar o override conserta uma edição ruim.
- **`transactional` vs `marketing`** decide consentimento: divulgação respeita
  descadastro e leva o link no rodapé; aviso de conta (cobrança, vencimento,
  segurança) vai sempre e não leva.
- **Disparo em massa só ENFILEIRA.** Quem envia é a fila lenta
  (`EMAIL_QUEUE_BATCH_SIZE`/rodada, `EMAIL_DAILY_CAP`/dia) — domínio novo que
  dispara tudo de uma vez cai em spam, e o provedor tem teto.
- **O "dia" do teto tem hora certa: 8h da manhã (America/Sao_Paulo)**, não é
  janela deslizante de 24h. Com janela deslizante, bater o teto às 15h de terça
  fazia a fila só voltar às 15h de quarta, e cada dia ela andava mais tarde que
  o anterior. `src/email/dailyWindow.js` (puro) resolve a virada vigente; o
  despachante conta o gasto do dia a partir dela e devolve `retryAt` quando
  barra. Envs: `EMAIL_DAILY_RESET_HOUR` (8), `EMAIL_TIMEZONE`
  (`America/Sao_Paulo`). Fuso ou hora inválidos caem no padrão de Brasília —
  teto na hora errada é menos grave que fila parada.
- Sem SMTP, nada é gravado como enviado: a janela anti-repetição não pode
  queimar sem a cliente ter recebido.
- Passadas rodam in-process na API (`setInterval` + `unref`) — **nenhum processo
  PM2 novo** (política de memória).

Envs (todas opcionais): `EMAIL_QUEUE_TICK_MS`, `EMAIL_QUEUE_BATCH_SIZE` (10),
`EMAIL_DAILY_CAP` (300), `EMAIL_DAILY_RESET_HOUR` (8), `EMAIL_TIMEZONE`
(`America/Sao_Paulo`), `LIFECYCLE_EMAIL_ENABLED`,
`LIFECYCLE_EMAIL_SWEEP_INTERVAL_MS`, `WEEKLY_SUMMARY_ENABLED`,
`WEEKLY_SUMMARY_WEEKDAY` (1 = segunda), `EMAIL_TRIGGERS_START_AT`.

### Aviso operacional só para conta em uso (RCA 2026-08 — não regredir)

Cliente com plano vencido, WhatsApp fora do ar e nenhuma oferta há semanas
recebeu "a Shopee parou de aceitar sua chave" — e, antes disso, o robô ainda
gastou uma sondagem na loja para descobrir. A varredura de credencial olhava só
"conta não banida + e-mail real".

`src/email/accountActivity.js` (puro + carregador com db injetado) responde
"essa conta está usando o robô agora?": **acesso ativo E (WhatsApp conectado OU
oferta enviada nos últimos `EMAIL_OPERATIONAL_IDLE_DAYS` dias OU conta com menos
de 14 dias que já chegou a conectar)**. A carência da conta nova é de propósito:
quem acabou de montar é quem mais precisa saber que o robô caiu.

Onde a regra age:
- **No despachante**, para todo e-mail do grupo `saude` disparado em modo
  `auto` (código de acesso venceu, chave da Shopee recusada, WhatsApp caído,
  robô parado). Chokepoint único: gatilho de saúde novo herda a trava sem
  precisar lembrar dela. Envio **manual** da admin nunca é barrado.
- **Antes de sondar** a loja, em `credentialExpiry/sweep.js` — economiza
  chamada à Shopee/ML/Amazon e poupa rotação de código de conta parada.

**Cobrança, senha e dinheiro de afiliada NÃO passam por essa trava**: conta
parada continua precisando saber que o plano vence e que tem saque a fazer.

**Foto incompleta não silencia.** Consulta que falhou (ou banco sem os modelos)
marca `incompleta: true` e o aviso VAI — engolir alerta legítimo por um blip é
pior que mandá-lo.

Duas travas irmãs, no mesmo arquivo:
- **Teto semanal**: no máximo `EMAIL_AUTO_WEEKLY_CAP` (2) e-mails automáticos
  por cliente por semana, contando só os grupos `saude` e `marketing`. Cada
  aviso sozinho se justifica; três assuntos diferentes em três dias viram spam.
- **Desconexão pedida** (`wasStoppedByUser`): `POST /session/stop` e
  `/session/forget` gravam `WaConnectionEvent('manual_stop_requested')`, e o
  aviso de WhatsApp caído não sai enquanto não houver conexão nova depois do
  pedido. Desligar o robô é escolha, não problema.

Envs (opcionais): `EMAIL_OPERATIONAL_IDLE_DAYS` (7), `EMAIL_AUTO_WEEKLY_CAP` (2,
`0` desliga). Teste: `test/email-conta-parada.test.js`.

### Gatilho ancorado no cadastro não pode ser retroativo (RCA 2026-08 — não regredir)

O motor entrou no ar com a base já formada, e três decisões de
`lifecyclePolicy.js` olhavam "dias desde o cadastro" **sem teto**:
`onboarding_conecte_whatsapp` (`>= 2 dias`), `configuracao_incompleta`
(`>= 1 dia`) e `seja_afiliado` (`>= 14 dias`). Cliente de oito meses atrás
satisfaz "faz 2 dias ou mais" — a base inteira recebeu e-mail de boas-vindas
atrasado na primeira passada. Duas travas, uma não substitui a outra:

- **Janela máxima** (`SIGNUP_WINDOW_DAYS`: 30/30/90 dias) direto na política
  pura — vale mesmo sem env nenhuma configurada.
- **Corte de virada** `EMAIL_TRIGGERS_START_AT` (data ISO, ausente = desligado):
  conta criada ANTES dessa data nunca dispara gatilho ancorado no cadastro.
  Vale também para a trilha de nutrição (`runNurtureSweep` recua o início da
  janela de 8 dias para a data da virada).

**O corte NÃO silencia aviso de fato atual** — plano vencendo, robô caído
ontem, saldo disponível para saque continuam valendo para toda a base: não são
retroativos, são o que está acontecendo agora. Cliente antiga que você quiser
convidar para afiliada é disparo manual pela aba E-mails. Testes:
`test/email-lifecycle-triggers.test.js` (bloco "gatilho de cadastro não é
retroativo").

Testes: `test/email-engine.test.js`, `test/email-lifecycle-triggers.test.js`,
`test/admin-emails.test.js`, `test/email-templates-migrados.test.js`,
`test/weekly-summary-email.test.js`, `test/password-reset.test.js`.

### Grupo "Contato e escuta" (não regredir)

Oito e-mails prontos (`group: 'contato'` em `src/email/registry.js`) para
perguntar à cliente o que travou, o que ficou confuso e o que faltou — check-in
geral, travou na configuração, dúvida nas lojas, primeira semana, parou de usar,
o que faltou (quem não continuou), convite para conversa e pesquisa de uma
pergunta só.

Contrato garantido por `test/email-contato-escuta.test.js`:
- **Sempre `trigger: 'manual'`.** Pergunta automática, disparada na hora errada,
  queima o canal — quem escolhe o momento e o público é a pessoa, pela aba
  E-mails.
- **Sempre `marketing`**: não é obrigação de serviço, então respeita descadastro
  e leva o link no rodapé.
- **Todo e-mail pergunta alguma coisa e convida a responder**, e traz os DOIS
  canais (WhatsApp e e-mail de suporte) no corpo. Pergunta sem canal de resposta
  é armadilha.
- **`dedupDays >= 21`**: ninguém pode ser sondada toda semana.
- Sem cobrança, sem culpa, sem promessa de resultado (o teste falha em
  "culpa sua", "garantimos", "última chance" e afins).

### Jornada de acesso vencido: plano pago E teste grátis (2026-09-19 — não regredir)

Duas histórias no mesmo lugar. **Plano pago:** desde 2026-09-07 havia o aviso do
vencimento mais cinco e-mails espaçados (antes disso eram dois e o assunto
morria em ~9 dias). **Teste grátis:** havia UM e-mail só (`teste_acabou`) e
depois dele a conta nunca mais recebia nada, com tudo dela guardado no sistema —
o buraco que este próprio arquivo declarava como conhecido.

Em 2026-09-19 a dona do produto pediu a mesma cadência nos dois casos: e-mail
nos dias **1, 3, 5 e 7** do vencimento, com um **voucher de 20% de desconto** no
5º e a repetição dele no 7º, dizendo quanto prazo sobrou.

| Peça | Onde |
|---|---|
| Os dias de cada etapa do plano pago (PURO, sem banco) | `src/emailTriggers/expiredPlanJourney.js` |
| Os dias de cada etapa do teste grátis (PURO) | `src/emailTriggers/expiredTrialJourney.js` |
| Código, desconto e prazo do voucher (PURO, sem tabela) | `src/domain/payments/recoveryVoucher.js` |
| Quem decide o e-mail do dia | `decideLifecycleEmail` em `lifecyclePolicy.js` |
| Os textos | `src/email/registry.js` (grupos `plano` e `conta`) |
| Conferir um código que a cliente mandou | `scripts/conferir-voucher.mjs` |
| Diagnóstico "saiu ou não, e por quê" | `scripts/diag-email-vencimento.mjs` |

Dias desde o vencimento do acesso:

| Dia | Plano pago | Teste grátis |
|---|---|---|
| 0-2 | `plano_venceu` | `teste_acabou` |
| 3-4 | `plano_vencido_primeiros_dias` | `teste_acabou_lembrete` |
| 5-6 | `plano_vencido_voucher` 🎟 | `teste_voucher` 🎟 |
| 7-8 | `plano_vencido_voucher_ultimos_dias` 🎟 | `teste_voucher_ultimos_dias` 🎟 |
| 11-12 | `plano_vencido_volta` | — (a jornada do teste acaba no 8) |
| 14-15 | `plano_vencido_2_semanas` | — |
| 17-18 | `plano_vencido_conta_guardada` | — |
| 21-22 | `plano_vencido_ultimo_aviso` | — |

**O voucher não tem tabela, e é de propósito.** O código é derivado da conta +
do dia em que o acesso venceu (HMAC), então o e-mail do 7º dia repete sozinho o
código do 5º e a conferência é regerar. Guardar linha custaria migration e não
responderia nada a mais — o resgate é **humano**: a cliente responde o e-mail ou
chama no WhatsApp e a administradora aplica o desconto (Financeiro → "Registrar
pagamento por fora", ou combinando o valor). Para conferir um código que chegou:

```bash
cd ~/wabot && node scripts/conferir-voucher.mjs <email> [CODIGO]
cd ~/wabot && node scripts/conferir-voucher.mjs --codigo VOLTA20-XXXXXX
```

**Não regredir:**

- **O prazo do voucher é CALCULADO, nunca escrito no texto.** A janela de cada
  etapa tem dois dias: "faltam 3 dias" fixo no corpo vira mentira no dia
  seguinte. O texto usa `{{dias_do_voucher}}` e `{{voucher_vale_ate}}`, e a
  validade conta do **vencimento** (não do envio) — senão um atraso da passada
  diária mudaria o prazo no meio da conversa.
- **Os dois e-mails do voucher levam o MESMO código.** Se a derivação deixar de
  ser determinística, a cliente fica com dois códigos e nenhum bate com o que a
  administradora regenera — o desconto vira discussão. Teste trava isso.
- **Sem voucher confiável (conta sem id, data ilegível) o e-mail NÃO sai.**
  Mandar código ou prazo inventado é pior que não mandar nada.
- **Os dois e-mails do voucher levam o WhatsApp**, porque o resgate é por
  conversa — e é nessa conversa que a gente descobre o que travou a renovação,
  que é a informação que nenhum relatório dá.
- **A jornada do plano pago cabe em ~3 semanas** (decisão da dona do produto,
  2026-09-07). A do teste acaba no 8º dia. Quem não voltou nesse prazo não volta
  por insistência, e cada e-mail a mais custa mais reputação de domínio do que
  traz cliente. Teste falha se alguém esticar.
- **Nenhuma janela é de um dia só.** A passada roda 1×/dia ancorada na hora em
  que a API subiu — um deploy no horário errado, uma passada que falhou ou um
  dia de API fora do ar pulariam a data exata e o e-mail **nunca sairia**.
- **As janelas nunca se SOBREPÕEM** (cada dia devolve no máximo um e-mail). Até
  2026-09-19 elas também não podiam se **encostar**, mas cadência de dois em
  dois dias não cabe em janela com folga: hoje o **bloco inicial** (dias 1, 3, 5
  e 7) encosta de propósito, e o **rabo** da jornada de plano pago mantém a
  folga — ali dois assuntos em dias seguidos continuam sendo só spam. Teste
  falha se alguém colar o rabo.
- **A jornada TERMINA.** Insistir para sempre faz a pessoa marcar como spam — e
  aí perdemos também os avisos que ela precisa receber. O último e-mail de cada
  jornada **diz** que é o último.
- **Só o aviso do vencimento é `transactional`** (o robô parou, é obrigação de
  serviço) — nos dois casos. Todo o resto é `marketing`: respeita descadastro e
  leva o link no rodapé. Sem isso, quem não quer mais ser chamada de volta só
  teria a opção de marcar como spam.
- **Nenhum texto usa pressão falsa** ("última chance", "vamos apagar seus
  dados") — e é mentira: nada é apagado. Teste falha se voltar.
- Custo: zero. Mesma passada diária, nenhum processo novo, **zero impacto de RAM**.

Env opcional: `VOUCHER_CODE_SECRET` (cai em `JWT_SECRET` e, sem ele, numa
constante — mantém teste e desenvolvimento sem env). Trocar a chave muda os
códigos: um voucher já enviado deixa de conferir, então só trocar entre
jornadas, não no meio de uma.

⚠️ **"O e-mail não está sendo enviado" tem SEIS causas com ações opostas** — SMTP
desligado (aí nenhum e-mail sai, nem este), passada desligada, texto desligado na
aba E-mails, descadastro, janela anti-repetição e teto diário — e todas aparecem
igual de fora. Rode o diagnóstico antes de procurar defeito no código:

```bash
cd ~/wabot && node scripts/diag-email-vencimento.mjs [<email>] [--dias=60]
```

Ele separa os seis casos e ainda distingue "não saiu" de "não havia a quem
mandar". Testes: `test/email-plano-vencido-jornada.test.js`,
`test/email-teste-vencido-jornada.test.js`, `test/voucher-recuperacao.test.js`.

### Recuperação de senha (não existia até 2026-08)

Quem perdia a senha só voltava pelo suporte — e o link "Esqueci minha senha"
apontava para um `mailto:` de um domínio que não é nosso. Agora:
`POST /api/auth/forgot-password` → e-mail com link → `POST /api/auth/reset-password`.

- **Sem tabela nova:** o link é um token assinado (`src/auth/passwordResetToken.js`)
  que inclui a impressão do hash da senha ATUAL. Isso dá **uso único de graça**
  (trocou a senha, todo link antigo morre) e validade de 1h.
- **Resposta sempre igual**, exista ou não a conta — a rota não pode virar
  detector de quem tem conta aqui.
- **Balde de tentativas PRÓPRIO, nunca o do login** (RCA 2026-09, abaixo).

#### O e-mail de nova senha não chegava (RCA 2026-09 — não regredir)

Duas travas, cada uma sozinha suficiente para deixar a recuperação de senha
sem funcionar. As duas atingiam exatamente quem precisa dela.

1. **O pedido consumia o balde de tentativas do LOGIN.** Quem esqueceu a senha
   erra o login várias vezes antes de clicar em "esqueci minha senha" — e o
   orçamento (8 tentativas / 15min, por e-mail e por IP) já vinha zerado. A
   rota respondia **429 "Muitas tentativas"** em vez de mandar o e-mail. Hoje
   `consumePasswordResetAttempt` (`src/api/routes/auth.js`) tem mapas próprios
   e teto próprio (`PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS`, 5 por hora, e as
   irmãs `_WINDOW_MS` / `_EMAIL_MAX_ATTEMPTS`). O limite continua existindo —
   a rota não pode virar varredura de e-mails —, só que com contagem separada.
   **Não voltar a compartilhar o balde com o login.**
2. **O teto diário do motor de e-mails engolia o envio, em silêncio.** O teto
   (`EMAIL_DAILY_CAP`, 300) protege o domínio dos **disparos em massa**, que
   saem pela fila lenta e voltam na virada das 8h. O e-mail de nova senha não
   volta: o gatilho é dispare-e-esqueça, não item de fila. Num dia de campanha
   grande, batido o teto, toda recuperação de senha parava até o dia seguinte —
   e o caminho do teto ia embora **sem gravar linha nenhuma** no `EmailSendLog`,
   então o e-mail não aparecia nem como enviado nem como barrado.
   `DAILY_CAP_EXEMPT_SLUGS` (`src/email/dispatcher.js`) tira `recuperar_senha`
   do teto — a pessoa está na tela, agora, sem entrar na conta, e "sai amanhã de
   manhã" é a mesma coisa que "não funciona". Volume é desprezível: a rota já é
   limitada por e-mail e por IP. **Não pôr `recuperar_senha` de volta no teto.**
   Junto: descarte por teto em gatilho **sem fila** agora vira linha `skipped`
   com o motivo (item de fila segue sem marcação — ele de fato volta amanhã).

⚠️ **Antes de procurar defeito no código, confira o SMTP.** Sem `SMTP_*` no
`.env` o envio é no-op silencioso e NENHUM e-mail sai — inclusive este. Sinal:
zero linha `sent` recente em `EmailSendLog`.

Testes: `test/password-reset.test.js`, `test/email-engine.test.js`.

**Contato de suporte (dashboard):** o e-mail e WhatsApp de suporte exibidos no
site vêm de constantes em `dashboard/lib/marketing-content.js`
(`SUPPORT_EMAIL`, `SUPPORT_WHATSAPP_*`, `SUPPORT_HOURS`, `SUPPORT_RESPONSE_SLA`).
O e-mail é overridável por `NEXT_PUBLIC_SUPPORT_EMAIL` (default
`contato@espelhagrupos.com.br`, domínio já registrado — não usar
`@botinho.com.br` sem comprar o domínio). Trocar o e-mail = mudar a env ou o
default nesse arquivo, num lugar só. Teste: `test/welcome-email.test.js`.
