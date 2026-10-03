# admin — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Histórico por cliente no admin (`/admin/clientes`, 2026-08-27)

Antes só existia visão macro: a gestão em `/admin` lista por RISCO (20 por
página, sem ordenação) e o drill-down `GET /users/:id` é operacional — não
respondia "quando essa cliente assinou, qual plano, quando vence". A
`Subscription` sequer era lida ali.

| Peça | Onde |
|---|---|
| Montagem dos 4 blocos + linha do tempo (PURO, sem banco) | `src/domain/admin/customerHistory.js` |
| Lista larga, buscável e ordenável | `listCustomers` em `src/domain/admin/service.js` |
| Rotas | `GET /api/admin/customers` e `GET /api/admin/customers/:id/history` |
| Tela da lista | `dashboard/app/admin/clientes/page.js` |
| Tela do histórico | `dashboard/app/admin/clientes/[id]/page.js` |

Os quatro blocos: **cadastral** (criação, origem, termos, último acesso),
**financeiro** (trial, assinaturas, pagamentos, LTV, acessos liberados na mão),
**técnico** (quedas por janela/código, erros por categoria, lojas) e **uso**
(grupos, envios 30d/7d/24h, automações, série diária).

**Não regredir — as regras que impedem a tela de virar parede:**
- **Cabeçalho tem exatamente 6 números.** Teste falha se virar 7.
- **A linha do tempo só recebe MARCOS.** Envio individual nunca vira linha —
  vira agregado diário, e queda de WhatsApp idem ("caiu 3 vezes"). Sem isso um
  cliente com 160 envios/dia produz 4.800 linhas e a página deixa de servir
  para qualquer coisa.
- **Cada aba mostra 8 linhas**; o resto fica atrás de "ver tudo".
- **Linguagem leiga**, como no resto do produto: a categoria de erro vira
  "Demorou demais e desistiu", não `timeout:`. Teste falha se prefixo de
  `errorMsg` chegar à tela.

**Trial não tem tabela própria** — é `plan='trial'` + `accessExpiresAt`.
`summarizeTrial` reconstrói início/fim/conversão a partir do cadastro e do
PRIMEIRO pagamento aprovado. Depois de assinar, `accessExpiresAt` passa a ser a
validade do plano pago, então `endsAt` do trial vira `null` de propósito —
reaproveitá-lo mentiria na linha do tempo.

**Custos:** só leitura, nenhum processo novo, **zero impacto de RAM**. Todo
agregado por cliente sai em lote (`groupBy`/`in`), nunca uma consulta por linha.
`MessageLog` é lido em janela de 30 dias com teto de 20.000 linhas — o histórico
de uso é agregado, não listagem. Ordenação só por coluna real do banco
(`SORTABLE_CUSTOMER_FIELDS`); último envio e LTV ficam de fora porque ordenar
por eles exigiria carregar a base inteira em memória.

Telefone segue mascarado por papel (`sanitizeUser`/`canSeePhone`) e as duas
rotas exigem `support:read` e gravam `AdminAuditLog`. Testes:
`test/admin-customer-history.test.js`.

## Tag "Pagante" e leitura da aba Início do admin (2026-09-05)

Duas queixas da dona do produto na mesma conversa: (1) nenhuma tabela de
cliente dizia quem já tinha pago, então toda priorização passava por abrir o
histórico um a um; (2) a aba Início virou parede — número sem explicação, card
sem drill-down e tabela de trabalho de atendimento no meio do painel de
decisão.

| Peça | Onde |
|---|---|
| Regra da tag (PURA, sem banco) | `src/domain/admin/payingStatus.js` |
| Carregador em lote de quem já pagou | `src/domain/admin/payingLoader.js` |
| "Por que caiu", em linguagem leiga (PURO) | `src/domain/admin/disconnectReason.js` |
| Etiqueta na tela | `dashboard/components/PayingTag.js` |
| Balão "?" dos cards | `dashboard/components/HelpDot.js` |
| Texto de cada card | `dashboard/lib/admin/cardHelp.js` |

**Não regredir:**

- **A tag sai de PAGAMENTO APROVADO, nunca do campo `plan`.** Liberação manual
  de acesso e trial também escrevem `plan` — usá-lo pintaria de verde quem
  nunca pagou, que é o oposto do que a tag serve para dizer. `paidAtRisk` e o
  rótulo "Pagante em risco" seguem a mesma fonte.
- **Dois estados, não um.** `pagante` (pagou e o acesso está em dia, verde com
  cifrão) e `ex_pagante` (pagou e venceu, cinza). Quem venceu é conversa de
  recuperação; jogá-lo no mesmo balde de quem nunca pagou apagaria isso.
- **Verde já significa "online" no admin**, então a diferença da tag está no
  cifrão e no texto, não só na cor.
- **A tag é decidida no backend**, nunca por cada tela — senão duas tabelas
  passam a discordar sobre quem é pagante. Aplicada em: gestão de clientes,
  WhatsApp desconectado, fila de sucesso, aba Online, `/admin/clientes` e o
  drill-down do cliente.
- **A tabela de desconectados diz POR QUE caiu**, em frase — antes mostrava só
  o código cru do WhatsApp, que junta num balde casos com ações opostas (QR
  novo, chip recusado, plano vencido, ninguém tentando). A dona da desconexão
  continua vindo de `resolveSessionOwner`; `describeDisconnectReason` só
  traduz. **Acesso vencido e "ela desligou" vêm ANTES do código**: o código
  gravado é o da queda anterior e contaria história errada.
- **Todo card do Início tem drill-down e "?".** Card de gente abre a lista de
  quem são (aba Online já filtrada); card técnico abre o detalhe do que está
  pendente, montado do que a página **já carregou** — nenhuma chamada nova.
- **A fila proativa saiu da aba Início** e continua na aba Sucesso do Cliente:
  o Início é "o que precisa de decisão agora", a fila é trabalho de atendimento.
- **Linguagem leiga nos cards e nos motivos**: "trabalhos parados" em vez de
  DLQ, "falhas de site" em vez de 5xx, "ela desconectou pelo celular" em vez de
  401. Teste falha se jargão voltar.
- **Custo:** só leitura. Uma consulta agregada a mais por lista
  (`payment.groupBy`) e uma de eventos de conexão na tabela de desconectados —
  nunca uma por linha. **Nenhum processo novo, zero impacto de RAM.**

- **A tag acompanha a cliente também nos DIÁLOGOS**, não só nas listas:
  "Registrar contato de CS" e "Ajustar plano e expiração" em
  `/admin/sucesso-cliente`. O segundo é o que mais importa — mexer no plano de
  quem já pagou não é a mesma coisa que liberar acesso de cortesia.

⚠️ **"A tag não aparece" quase nunca é defeito de tela.** Staging tem **banco
próprio** (`staging.db`) e token de sandbox do Mercado Pago: se nenhuma conta de
lá concluiu pagamento, **não existe pagante em staging** e a tag não aparece em
tela nenhuma — corretamente. `node scripts/diag-tag-pagante.mjs` (read-only,
roda no diretório do ambiente) separa os dois casos: mostra os pagamentos por
situação, quantas contas têm `approved` e como cada uma sairia na tela. Para ver
a tag funcionando em staging, registre um pagamento pelo próprio admin
(Financeiro → "Registrar pagamento por fora") — esse caminho grava
`status='approved'` com `provider='manual'`, igual ao Mercado Pago, e **é
proposital que pagamento conferido na mão conte como pagante**.

Testes: `test/admin-paying-tag.test.js`, `test/admin-painel-inicio.test.js`,
`test/admin-wa-disconnected-users.test.js`.

## Tag "número repetido" e a trava por número de WhatsApp (2026-09-09)

Quatro pessoas usaram **doze contas** para renovar o teste grátis. Uma trocou
nome E e-mail a cada conta, então nenhuma regra de nome ou e-mail a pegaria —
só o número de WhatsApp em comum. No cadastro o número já era barrado quando
repetido; **na hora de ligar a sessão do WhatsApp não havia conferência
nenhuma**.

| Peça | Onde |
|---|---|
| Decisão da trava (PURA, sem banco/rede) | `src/domain/session/phoneReuse.js` |
| Histórico "quem já conectou este número" | `src/domain/session/phoneOwnership.js` |
| Tabela | `WaPhoneOwnership` (`@@unique([phone, userId])`) |
| Gancho no robô | `handlePhoneOwnership` em `src/bot-worker.js`, depois do `open` |
| Regra da tag do admin (PURA) | `src/domain/admin/sharedPhoneStatus.js` |
| Carregador em lote | `src/domain/admin/sharedPhoneLoader.js` |
| Etiqueta na tela | `dashboard/components/SharedPhoneTag.js` |
| Aviso interno | `admin_numero_repetido` em `src/email/registry.js` |
| Trazer o histórico que já existe | `scripts/backfill-numeros-whatsapp.mjs` |

`WA_PHONE_REUSE_MODE` tem três valores: `off` (padrão), `warn` (registra, avisa
e **deixa conectar**) e `block` (recusa). Produção está em `warn`.

**Não regredir:**

- **O histórico é gravado ANTES do `if (modo === 'off')`.** É isso que faz o
  modo `warn` acumular a base que a decisão de ligar o `block` vai usar —
  gravar só quando a trava está ligada tornaria a decisão impossível de tomar
  com dado.
- **Conta pagante nunca é bloqueada**, e só quem está em teste entra na regra:
  quem paga trocando de chip não pode ficar sem robô por causa disto.
- **Fail-safe é DEIXAR CONECTAR.** Qualquer falha (banco, consulta, número
  ilegível) passa. Barrar por dúvida deixaria uma cliente legítima sem produto,
  que é pior que um teste repetido.
- **A tag descreve um FATO, não uma acusação:** "este número aparece em N
  contas". Troca de chip e conta antiga abandonada produzem o mesmo sinal;
  quem conclui é gente. A decisão é do backend, nunca de cada tela — senão duas
  tabelas do admin discordam sobre quem está marcado.
- **A recusa NUNCA apaga credencial nem gera QR** — só encerra o socket.
- **Custo:** duas consultas a mais por lista do admin (`findMany` + `groupBy`),
  nenhum processo novo, **zero impacto de RAM**.

⚠️ **O histórico NASCE VAZIO e só ganha linha quando um robô CONECTA** — então
no dia do deploy a tag não aparece para ninguém, inclusive para os casos que a
motivaram: três daquelas contas tiveram o acesso cortado e nunca mais vão
conectar, e conta antiga abandonada também não. O número delas, porém, está em
`WaSession.phone` desde sempre. `scripts/backfill-numeros-whatsapp.mjs` traz
esses números para o histórico (read-only por padrão; grava com `--aplicar`) e,
no modo de leitura, já responde qual é o caso: mostra quantos números existem,
quais aparecem em mais de uma conta e quem são. **Rodar isso é o que faz a tag
aparecer** — sem ele, "a tag não aparece" é ausência de histórico, não defeito
de tela.

```bash
cd ~/wabot && node scripts/backfill-numeros-whatsapp.mjs            # só mostra
cd ~/wabot && node scripts/backfill-numeros-whatsapp.mjs --aplicar  # grava
```

A gravação e a normalização são **importadas do produto**
(`recordPhoneOwnership`), nunca reescritas no script: script que reimplementa a
regra passa a discordar dela em silêncio e o histórico fica com dois formatos
do mesmo número. Teste: `test/backfill-numeros-whatsapp.test.js`.

⚠️ Em modo `remote`, o deploy da API **não** recarrega os bot-workers — a
gravação do histórico só começa depois de `pm2 restart bot-supervisor`
(reconecta TODAS as sessões: anunciar antes).

## Balão de ajuda saindo da tela no celular (RCA 2026-09-05 — não regredir)

Os dois balões de ajuda do produto — o "?" dos cards do admin
(`dashboard/components/HelpDot.js`) e o "i" do histórico da cliente
(`dashboard/components/Tooltip.js`) — nasciam com **largura fixa** (288px e
256px) e posição **absoluta a partir do gatilho**. O gatilho fica no canto
direito do card; numa tela de 375px o balão nascia fora da área visível: dava
para ver abrir e não dava para ler.

**Ancoragem por CSS não resolve isso.** Abrindo para a direita, estoura no card
da direita; para a esquerda, estoura no da esquerda; centralizado no gatilho,
estoura nos dois extremos. Sem medir a tela em JavaScript não existe um lado
seguro — então os dois passaram a ser **fixos na TELA**: gaveta presa embaixo
no celular (`fixed inset-x-3 bottom-3`) e, de `sm:` para cima, o
comportamento de antes (diálogo centralizado no `HelpDot`, balão ancorado no
`Tooltip`). O título dentro do balão diz de qual card ele fala, então perder a
ancoragem no celular não perde o contexto.

**Não regredir:** largura fixa (`w-72`, `w-64`) só a partir de `sm:`; no
celular quem manda são as duas laterais presas à tela. Tabela larga dentro de
diálogo é o outro jeito de o conteúdo sumir para a direita — `min-w-[...]`
precisa de `overflow-x-auto` por perto. Teste:
`test/dialogos-no-celular.test.js` (cobre os dois balões e varre as tabelas do
admin).

## Enxugada do admin: capacidade legível, funil em jornada, duas páginas a menos (2026-09-05)

Quatro telas na mesma conversa. O fio comum: número na tela sem dizer se está
bem ou mal, e página separada para pergunta que é de olhar todo dia.

### Capacidade (`/admin/capacidade`)

- **RCA: "Diagnóstico traduzido sempre sem medição".** `persistedDecision`
  (`src/ops/capacity/service.js`) devolvia a decisão gravada **sem
  `resourceHealth`** — e é ele que pinta RAM/CPU/disco/swap. Resultado: os
  quatro cartões diziam "Sem medição" com o servidor medido e saudável, num
  bloco cujo próprio texto avisa que "sem medição nunca significa saudável".
  A saúde agora é recomposta das medições brutas do snapshot
  (`evaluateResourceHealth`, puro, sem consulta nova). O retorno antecipado de
  `evaluateCapacity` (`insufficient_data`) também passou a levá-la: sem saber a
  memória total ainda sabemos CPU, disco e swap. **Não regredir:** nenhum
  caminho pode devolver decisão sem `resourceHealth`.
- **RCA: "Contratado vs utilizado sempre sem medição".** O bloco tinha esse
  título e mostrava só o inventário da Hetzner — que é **opcional** e vem vazio
  sem `HCLOUD_READ_TOKEN`. A comparação agora sai das medições do próprio
  servidor (sempre presentes): RAM, disco, CPU e robôs conectados, cada um com
  contratado / utilizado / livre. O inventário do provedor virou detalhe
  recolhido. **Não regredir:** a comparação não pode voltar a depender do token.
- **Fundo escuro removido** do cartão de decisão: destoava do admin, que é
  claro, e o que precisa saltar é o estado — trabalho da cor da tarja.
- **Cards de recurso** agora têm cor por estado (verde/âmbar/vermelho/cinza),
  barra de uso e um chip com o estado. A barra mostra sempre **quanto está em
  uso**, nunca o que sobra: duas barras com sentidos opostos na mesma tela é o
  jeito mais rápido de ler errado.
- **Gráficos** ganharam veredito em uma frase antes do desenho ("Estamos bem:
  12 robôs de 18 que cabem"), eixos identificados (valores à esquerda, datas
  embaixo, unidade nomeada) e, em cada série pequena, a tendência com sinal
  certo — `goodWhenRising` existe porque subir é bom em "RAM disponível" e ruim
  em "disco utilizado". Os rótulos ficam em HTML ao redor do SVG, nunca dentro:
  o desenho usa `preserveAspectRatio="none"` e texto lá dentro sai deformado.

### Funil (`/admin/funil`) — pipeline da jornada

`FUNNEL_STEPS` passou de 5 para **7 etapas**, na ordem em que a cliente vive o
produto: criou a conta → conectou o WhatsApp → **cadastrou a loja** → **escolheu
os grupos** → teve oferta publicada → começou o pagamento → pagou. As duas
etapas novas **não custam consulta nenhuma**: `credentialUserIds`,
`sourceGroupUserIds` e `destGroupUserIds` já eram carregados para explicar POR
QUE a pessoa parou. A tela virou colunas lado a lado com a perda entre elas; a
lista antiga continua acessível, recolhida.

**Não regredir:** a regra de implicação vale para as etapas novas também — quem
teve oferta publicada conta como tendo loja e grupos, mesmo que tenha apagado
depois; sem isso o pipeline encolhe para trás e confunde. E as etapas seguem
**não sendo sequência obrigatória** (dá para escolher grupo antes de cadastrar
a loja): é a implicação que as torna legíveis em fila.

### Duas páginas a menos

- **`/admin/ofertas` foi removida.** O percentual de ofertas com foto (48h)
  virou card do Início, e "de que jeito as imagens saíram" + "envios e imagem
  por loja" viraram blocos logo abaixo. "Onde a foto está se perdendo" continua
  existindo, recolhido — é o detalhe que só se abre quando o número está ruim.
  Mesma rota de dados (`GET /api/admin/qualidade-entrega`), só que com janela
  fixa de 48h.
- **`/admin/automacoes` foi removida.** Ela existia só para editar um campo
  (`User.maxAutomations`) numa tabela de toda a base. Virou campo editável na
  aba **Uso** do histórico do cliente (`/admin/clientes/[id]`), onde a pergunta
  "quantas automações ela pode ter?" de fato nasce. As rotas
  `GET/PATCH /api/admin/automation-quota` continuam as mesmas.

**Custo:** uma chamada a mais no Início (qualidade de entrega, já existente),
nenhum processo novo, **zero impacto de RAM**.

Testes: `test/admin-capacidade-leitura.test.js`, `test/admin-funnel.test.js`,
`test/admin-painel-inicio.test.js`, `test/admin-panel-visual-adjustments.test.js`.

⚠️ **`test/admin-capacity-page.test.js` PULA sem as dependências do dashboard** —
ele renderiza os componentes de verdade e, sem `npm ci --prefix dashboard`,
`npm test` marca os 13 casos como `# SKIP` e passa. A CI instala, então lá eles
rodam: mexeu em `dashboard/app/admin/capacidade/`, rode
`npm ci --prefix dashboard` antes de concluir que está verde. Foi assim que
quatro guardas de texto dessa tela só apareceram no gate da PR.

## ADMIN > Funil (`/admin/funil`, 2026-09-02)

Responde "onde as pessoas param entre criar a conta e pagar" sem ninguém
precisar rodar script. Os números já existiam em `scripts/diag-funil-ativacao.mjs`
e `scripts/diag-origem-cadastros.mjs` — o que faltava era a leitura.

| Peça | Onde |
|---|---|
| Montagem das etapas, semanas e origens (PURO, sem banco) | `src/domain/admin/funnel.js` |
| Classificação de origem do cadastro (PURA, compartilhada com o script) | `src/domain/admin/signupOrigin.js` |
| Carregador em lote | `getActivationFunnel` em `src/domain/admin/service.js` |
| Rota | `GET /api/admin/funnel?weeks=8` (`support:read`, auditada) |
| Tela | `dashboard/app/admin/funil/page.js` |

Cinco etapas: criou a conta → conectou o WhatsApp → **teve oferta publicada** →
começou o pagamento → pagou. Junto vem **POR QUE cada pessoa parou** (nove
motivos, `STALL_REASONS`) e, em cada motivo, quem contatar — com link para o
histórico do cliente.

**Os nove motivos e a regra de leitura:** a classificação devolve o **PRIMEIRO
obstáculo** que a pessoa encontrou, não a última etapa concluída — as etapas não
são sequência obrigatória (dá para escolher grupo sem cadastrar loja), e alguém
sem loja E sem grupo parou na loja. Os que mais mudam a ação:

- **"Nem chegou a pedir a conexão" ≠ "tentou e NÃO conseguiu"** — os dois eram
  um balde só até 2026-09-02, e a medição real (124 cadastros, 55 parados aí)
  mostrou por que isso não serve: o primeiro é decisão da pessoa (confiança,
  expectativa) e o segundo é **obstáculo nosso** (QR que não lê, servidor sem
  vaga, recusa do WhatsApp). Juntos, defeito de produto se esconde atrás de
  "ela não quis". O sinal que separa é a existência de `WaSession` (criada
  quando ela clica em conectar) contra o `whatsapp_connected`.

- **"O robô tentou e NENHUMA oferta saiu"** — o painel mostra atividade e nada
  chega ao grupo (`skip:no_valid_conversions`, quase sempre loja incompleta ou
  chave recusada). Ela acha que testou o produto e nunca o viu funcionar. É a
  conversa mais urgente do funil e a que ninguém abre sozinha.
- **"Viu oferta sair e não foi para o pagamento"** — aqui o produto funcionou;
  se este grupo for grande, o assunto é preço/confiança, não configuração.

`classifyStallReason` + `describeStallReason` são consumidos TAMBÉM pelo
`scripts/diag-funil-ativacao.mjs`, que antes duplicava os rótulos. Guarda em
`test/admin-funnel.test.js` e em `test/diag-atribuicao.test.js` (esta exige que
o script importe a regra em vez de reescrevê-la).

**Não regredir:**

- **"Teve oferta publicada" é só `MessageLog.status='success'`.** A linha mais
  comum de quem não cadastrou a etiqueta de afiliada é
  `skip:no_valid_conversions` — o robô se recusa a publicar link não convertido.
  Contar qualquer linha colocaria no grupo "viu o produto funcionar" justamente
  quem nunca teve uma oferta chegando ao grupo, que é o oposto da conversa que
  essa pessoa precisa.
- **A coorte é a semana do CADASTRO**, nunca a semana do evento. Misturar as
  duas produz percentual acima de 100% quando alguém paga semanas depois.
- **Etapa posterior implica as anteriores.** Quem pagou conta como tendo
  conectado mesmo se o sinal de conexão se perdeu (retenção de
  `WaConnectionEvent`, conta anterior ao evento) — senão a tela mostra funil
  crescendo, que só confunde.
- **"Chegou a conectar" tem duas fontes de propósito:** o evento durável
  `whatsapp_connected` e a própria `WaSession` (status conectado ou telefone
  preenchido). O evento não existe para conta anterior à sua criação; a sessão
  sozinha não enxerga quem conectou e desconectou faz tempo.
- **A lista de "falar com" é curta de propósito** (8 por motivo) e traz nome,
  e-mail e link para o histórico — **nunca telefone**, que tem mascaramento por
  papel (`sanitizeUser`). Ela existe para a conversa começar hoje, não para
  virar exportação de base.
- **Custo:** só leitura, **zero processo novo e zero impacto de RAM**. As duas
  tabelas grandes (`MessageLog`, `AnalyticsEvent`) entram por `groupBy`
  (agregação no SQLite) com `in` na coorte — nunca `distinct` do Prisma, que
  agrega em memória depois de trazer as linhas. Janela máxima de 26 semanas.
- **Linguagem leiga:** "onde as pessoas param", "conectaram o WhatsApp",
  "tiveram oferta publicada". Nada de "coorte", "funil de conversão" ou nome de
  tabela na tela.
- **A classificação de origem mora em UM lugar** (`signupOrigin.js`), usada pelo
  painel e pelo `scripts/diag-origem-cadastros.mjs`. Duplicada, script e tela
  discordavam sobre quantos cadastros vieram de conteúdo e não havia como saber
  qual estava certo.

⚠️ Atribuição é aproximação: "Direto / ambíguo" **não** significa "veio
sozinho" — quem achou no Google, fechou e voltou depois digitando o endereço cai
aí, e o SEO fica sem crédito. Semana recente está sempre em andamento.

Teste: `test/admin-funnel.test.js`.

## Contato ativo semanal (lista de quem procurar, 2026-09-13)

Pedido da dona do produto: rodar um comando por semana e receber **nome, e-mail
e telefone** de quem precisa de contato — sem abrir o admin cliente a cliente.

| Peça | Onde |
|---|---|
| Regra dos grupos (PURA, sem banco/rede) | `src/domain/admin/outreachSegments.js` |
| Script read-only | `scripts/contato-ativo-semanal.mjs` |

```bash
cd ~/wabot && node scripts/contato-ativo-semanal.mjs            # lista na tela
cd ~/wabot && node scripts/contato-ativo-semanal.mjs --csv > /tmp/contatos.csv
cd ~/wabot && node scripts/contato-ativo-semanal.mjs --so-pedidos
cd ~/wabot && node scripts/contato-ativo-semanal.mjs --nao-falei-em=14
```

Dez grupos, em ordem de prioridade: cobrança recusada, vence em 5 dias, venceu
até 3d / 4-20d / +20d, nunca publicou (conta ≤7d e 8-20d), robô caído, parou de
publicar, sem loja cadastrada.

**Não regredir:**

- **Cada cliente entra em UM grupo só**, o de maior prioridade. Três mensagens
  diferentes para a mesma pessoa na mesma semana é o jeito mais rápido de ela
  parar de ler o que mandamos (mesma razão do teto semanal de e-mail automático
  em `src/email/accountActivity.js`).
- **Fail-safe é NÃO procurar.** Sem validade de acesso confiável, sem data de
  cadastro ou com consulta que falhou, a cliente fica de fora — e a consulta que
  falhou é impressa, nunca engolida (lição do `diag-assinatura-recusada.mjs`,
  onde `.catch(() => [])` virou "nenhuma conta encontrada").
- **Quem tem renovação automática ligada não entra em lista de cobrança**, e
  **"ela desligou o robô" nunca vira aviso de robô caído** (`wasStoppedByUser`).
- **"Publicou" é `MessageLog.status='success'`**, nunca qualquer linha: a linha
  mais comum de quem não cadastrou a etiqueta é `skip:no_valid_conversions`, e
  contá-la poria no balde de "já viu o produto funcionar" justamente quem nunca
  viu (mesma regra do `/admin/funil`).
- **Read-only**: nenhuma escrita, nenhum e-mail. Teste estrutural falha se
  `.create(`/`.update(`/`sendTemplateEmail` aparecerem no script.
- **Custo:** seis agregações em lote por execução (`groupBy`), nunca uma
  consulta por cliente. Nenhum processo novo, **zero impacto de RAM**.

⚠️ A saída tem **telefone e e-mail de cliente**. O painel mascara telefone por
papel (`sanitizeUser`); aqui não mascara de propósito — é a dona do produto
rodando no próprio servidor para conseguir ligar. Não repassar o CSV.

Teste: `test/admin-contato-ativo.test.js` (puro, sem banco).

## Pagante canônico nas contagens (Q3 da auditoria, 2026-10-02)

A tag já saía de pagamento aprovado, mas as **contagens** não: "Pagantes
atuais"/"Pagos parados" do Início, "pagante parado" da fila de sucesso,
`activeBasic/Pro/Premium` (MRR) do Financeiro e do ROI, "Pagos vencidos" e o
filtro `overdue` de assinaturas contavam por `plan IN PAID_PLANS` — cortesia e
liberação manual entravam como receita. E `buildRiskFlags` acendia
`paid_stale_48h`/`bot_not_running` pelo `plan`.

| Peça | Onde |
|---|---|
| Cláusulas únicas `everPaidWhere` / `currentPayingWhere` / `formerPayingWhere` / `stalePayingWhere` | `src/domain/admin/payingLoader.js` |
| `loadEverPaidUserIds` agora une `Payment` e `SubscriptionCharge` aprovados | idem |
| Guarda | `test/admin-pagante-canonico.test.js` |

**Não regredir:** `admin.js` não pode voltar a ter `plan: { in: PAID_PLANS }`
nem `plan: 'basic', accessExpiresAt` em contagem — o teste falha. `PAID_PLANS`
só serve para validar o valor que o admin digita. Renovação recuperada pela
reconciliação grava só `SubscriptionCharge`; contar só `Payment` escondia
pagante. **Números mudam** (para baixo onde havia cortesia, para cima onde só
havia cobrança de assinatura): avisar a dona antes do deploy em `main`.
**Custo:** filtros de relação dentro do próprio `count`, nenhuma consulta por
linha, zero RAM.

## Telemetria do painel da cliente fora de `AdminAuditLog` (Q1 da auditoria, 2026-10-02)

Medido em produção (7 dias): `session.telemetry` = 1.568 linhas, 75 % de
`AdminAuditLog`. Era a tela "Conexão WhatsApp" do painel da **cliente**
(`POST /api/session/telemetry`) gravando etapa/evento/detalhe como se fosse
ação de admin, retida 180 dias e soterrando a trilha de "quem fez o quê".

| Peça | Onde |
|---|---|
| Gravação | `src/api/routes/session.js` → `trackAnalyticsEvent({ event: 'session_telemetry' })` |
| Relatório (PURO) | `src/domain/admin/sessionTelemetry.js` |
| Leitura | `GET /api/admin/session-telemetry` lê `AnalyticsEvent` e junta nome/e-mail em lote |
| Retenção | `SESSION_TELEMETRY_RETENTION_DAYS` (90) no sweep diário de `server.js` |
| Guarda | `test/admin-telemetria-fora-da-auditoria.test.js` |

**Não regredir:** rota de cliente nunca escreve `adminAuditLog`; `AdminAuditLog`
é só ação de admin. O evento precisa estar em `ANALYTICS_EVENTS`, senão some
sem erro. O painel passa a mostrar só eventos novos (os antigos ficam na
auditoria até vencerem os 180 dias). Zero RAM: mesma escrita, mesmo sweep.

## Auditoria nas escritas de afiliado e confirmação obrigatória no disparo (Q8 da auditoria, 2026-10-02)

Aprovar/rejeitar afiliado, mudar a regra geral de comissão e dar percentual
especial (`affiliate.js`) escreviam sem `AdminAuditLog`; comissões e saques já
gravavam. Agora as quatro gravam antes/depois (`admin.affiliate.approve`,
`.reject` com motivo, `.settings.update`, `.commission_override`). No disparo
de e-mail em massa (`adminEmails.js` `/send`), `confirmTotal` era opcional:
sem ele, saía para a base sem conferir. Agora é obrigatório (400) e segue 409
quando a lista mudou. Guarda: `test/admin-afiliados-auditoria.test.js`.
Zero RAM.

## Início quebrado em Receita e Operação (G2 da auditoria, 2026-10-02)

`dashboard/app/admin/page.js` tinha 3.825 linhas e disparava 20 consultas no
boot, mesmo para quem só queria ver o semáforo. Metade era a aba Financeiro
(ROI, cobranças recorrentes, reembolso, pagamento por fora) e a aba oculta
"Observabilidade (técnico)" + Configurações (planos da LP, FAQ, termos, tutorial).

| Peça | Onde agora |
|---|---|
| Financeiro inteiro (visão, ROI, cobranças, pagos vencidos, todos que já pagaram, reembolso, pagamento por fora) | `dashboard/app/admin/receita/page.js` (link "Receita" no menu, `billing:read`) |
| Observabilidade técnica (sessão admin, métricas completas, GO/NO-GO, saúde, sessões WA, telemetria, robô do Telegram, erros 24h, logs) + card de staging + Configurações | `dashboard/app/admin/operacao/page.js` (link "Operação", `tech:read`; conteúdo do site fica recolhido em "Conteúdo e modelos do site") |
| Início | 1.719 linhas; boot caiu de 20 para 10 consultas (saíram sessions, session-telemetry, logs, logs/summary, payments, subscriptions, system/health, lp-content, legal/terms; `finance/overview` ficou só para os dois cards da aba Afiliados) |
| Guarda | `test/admin-inicio-enxuto.test.js` (teto de linhas por tela + boot enxuto); testes antigos de ROI/cobranças/reembolso/staging apontam para as páginas novas |

Clicar numa cliente na Receita abre a ficha `/admin/clientes/:id` (antes abria
um painel duplicado dentro do Início). Nada mudou de rota, permissão ou banco.
Zero RAM: mesmas consultas, agora cada uma só na tela que a mostra.

**Não regredir:** aba nova no Início é a exceção, não a regra — tela com dono
próprio (Receita, Operação, Hoje) nasce como página em `dashboard/app/admin/`.
Próximo corte previsto: abas Online e Sucesso saem do Início quando a caixa
"Hoje" (G1) for validada em staging.

## Rajada de 403 no admin: 429 por conta + aviso (Q10 da auditoria, 2026-10-02)

Em 26/09 uma conta trial fez 80 chamadas por `curl` a `/api/admin/*` em 6 min.
Tudo 403 e auditado, ninguém avisado; o limite de requisições é só global por
IP. `src/domain/admin/adminProbePolicy.js` (puro) conta negativas por conta
numa janela de 10 min: na 20ª a resposta vira 429 e `requireAdmin` manda o
e-mail interno `admin_sondagem_admin` (uma vez por conta a cada 24 h, pelo
cooldown de `sendAdminAlert`). **RAM:** um `Map` por processo da API com no
máximo 500 contas × 20 horários (poucos KB), sinalizado. A auditoria da
negativa continua sendo gravada antes de qualquer resposta. Guarda:
`test/admin-rajada-403.test.js`.

## Caixa de entrada "Hoje" (`/admin/hoje`, G1 da auditoria, 2026-10-02)

Responde "o que precisa de mim agora" com a ação ao lado, em vez de cards e
números espalhados.

| Peça | Onde |
|---|---|
| Prioridade (PURA): peso financeiro × gravidade, uma linha por cliente | `src/domain/admin/inboxPriority.js` |
| Rota (support:read, auditada, só leitura em lote, teto de 2 000 contas) | `GET /api/admin/inbox` em `src/api/routes/admin.js` |
| Tela | `dashboard/app/admin/hoje/page.js` (tokens do DS, sem hex) |
| Guarda | `test/admin-caixa-hoje.test.js` |

Fontes reaproveitadas, nunca reescritas: `classifyOutreachSegment` (os 10
grupos do contato semanal) e `findPayingDown`/`findPayingBlind` (as mesmas
regras do aviso M4). **Não regredir:** cada cliente entra UMA vez (operacional
vence comercial); todo segmento novo em `outreachSegments.js` precisa de
gravidade em `GRAVIDADE`, senão some da caixa em silêncio (teste trava);
telefone mascarado por papel (`canSeePhone`); reconectar sempre com confirmação.
Custo: ~10 agregações em lote por abertura, zero processo novo, zero RAM.

## Bloquear/banir conta com papel alto e dupla confirmação (item 5, 2026-10-03)

**Era:** `POST /users/:id/block|unblock` pedia só `support:write` (o mesmo nível
de "registrar contato"), o motivo podia ter 1 letra e a ficha nem tinha botão.

**Agora:** regra PURA em `src/domain/admin/blockPolicy.js`
(`validateBlockRequest`): permissão `admin:write` (só o dono; o papel `admin`
NÃO tem), motivo ≥ 10 letras (bloquear E desbloquear) e `confirmEmail` igual
ao e-mail da conta (o servidor confere de novo). Status só `suspended`/`banned`.
Auditoria (`admin.user.block|unblock`) grava o motivo. Ficha 360
(`/admin/clientes/[id]`): botão `BloquearConta` só aparece com
`podeBloquear` (devolvido por `GET /customers/:id/history`), pede
`window.confirm` + digitar o e-mail. Guarda: `test/admin-bloqueio-seguro.test.js`.

**Não regredir:** não baixar para `support:write`; não aceitar motivo curto nem
pular o e-mail no servidor "porque a tela já pede". Custo: zero RAM.

## Ficha 360 → aba Robô com Parar, motivo e "por que não envia" (item 6 / M2, 2026-10-03)

**Era:** a aba Robô da ficha (`/admin/clientes/[id]`) já mostrava "Por que caiu",
histórico de quedas e Reconectar (PR #2183), mas a admin não conseguia parar o
robô sem a VPS (`scripts/parar-sessao.mjs`), nenhuma ação pedia motivo e o
"por que não envia" só existia como script lendo `bot.log`.

**Agora:**

| Peça | Onde mora |
|---|---|
| Parar de propósito (PURO de rota; marca `stopped_by_user` ANTES do `stopBot`, grava `manual_stop_requested` com `source=admin` + motivo) | `src/domain/session/stopSession.js` — usado pela rota E por `scripts/parar-sessao.mjs` |
| Rota `POST /api/admin/users/:id/session/stop` (`tech:write`, motivo ≥ 5 letras, auditoria `admin.session.stop`) | `src/api/routes/admin.js` |
| Reconectar com motivo (opcional no servidor, a ficha sempre manda; vai no evento `admin_reconnect_requested` e na auditoria) | `POST /online/:userId/reconnect` |
| Diagnóstico elo por elo (conta → robô → WhatsApp → grupos → envios), PURO | `src/domain/admin/diagnostics/envios.js`; usado por `GET /api/admin/users/:id/diagnostico/envios` (`support:read`, auditada) e por `scripts/diag-envios-vazios.mjs` |
| Tela: botões Parar robô / Tentar reconectar (`confirm` + `prompt` de motivo), bloco "Por que não envia?", eventos com nome leigo e motivo | `dashboard/app/admin/clientes/[id]/page.js` (`RoboTab`) |
| Guarda | `test/admin-ficha-robo.test.js` |

**Não regredir:** o diagnóstico só lê banco e Redis (nunca `bot.log`, que é da
frota inteira e não se atribui a uma conta — elos de log ficam só no script);
`workerRunning: null` = "não sei", nunca "parado"; fila de erros (DLQ) só com
`QUEUE_BACKEND=bullmq` (`null` = indisponível, não erro); a marca
`stopped_by_user` vive só em `stopSession.js` (rota e script não a reescrevem);
Parar nunca sem confirmar + motivo; evento próprio `admin_reconnect_requested`
continua separado de `manual_reconnect_requested` (mede a promessa do produto).
DLQ continua nas rotas `/send-dlq/:userId` já existentes (Operação → Filas).
Custo: 6 consultas pequenas por clique em "Verificar agora", zero processo
novo, zero RAM.

## G4 — "Por que não conecta" na ficha do cliente (2026-10-03)

**O que era:** `scripts/diag-nao-conecta.mjs` só rodava por SSH. A atendente
não tinha como separar "QR venceu", "sem vaga", "WhatsApp recusou a versão
(405)" e "tempo esgotado (408)" — causas que pedem ações opostas.

**Onde mora:** regras puras em `src/domain/admin/diagnostics/conexao.js`
(`diagnoseConexao`: elos conta → vaga → tela → WhatsApp → credencial, cada um
com problema + "o que fazer" em frase leiga). Rota
`GET /api/admin/users/:id/diagnostico/conexao` (`support:read`, auditada como
`admin.user.diagnostico_conexao`), bloco "Por que não conecta?" na aba Robô da
ficha, ao lado de "Por que não envia?". O script importa o mesmo módulo e
imprime o `[VEREDITO]`. Teste: `test/admin-diagnostico-conexao.test.js`.

**Não regredir:**
- Só banco (`WaSession`, `WaConnectionEvent`, `AnalyticsEvent`) + existência da
  pasta de credencial. NUNCA `bot.log` na rota (é da frota inteira).
- A telemetria da tela mora em `AnalyticsEvent('session_telemetry')` desde
  2026-10-02; o script lia `AdminAuditLog` (vazio) e foi corrigido.
- 405 com `ops_wa_version_rejected` em várias contas = problema geral, nunca
  pedir para a cliente parear de novo (ver `whatsapp-sessao.md`).
- Sem jargão (`405`, `socket`, `handshake`, `pairing`) nas frases da tela.
- Custo: 6 consultas pequenas por clique, zero processo novo, zero RAM.

## Menu de 5 entradas: `/admin/observabilidade` e `/admin/emails` encaixados (2026-10-03)

**O que era:** o cabeçalho do Início tinha 9 botões (Capacidade, Erros, Funil,
Contato com cliente...) e duas páginas fora do eixo: `/admin/observabilidade`
(texto de roadmap, 490 linhas) e `/admin/emails` (modelos + envio + WhatsApp
na mesma tela).

**Onde mora agora:**
- Menu (`dashboard/app/admin/page.js`): Hoje, Clientes, Receita, Crescimento
  (`/admin/funil`), Operação. Capacidade, Erros, Modelos e Experimentos
  (teste-shard, só com a env ligada) são links DENTRO da Operação.
- Operação → Saúde: `dashboard/components/SaudeSection.js` (GO/NO-GO em 4 chips,
  alertas e fila de webhooks de pagamento com Reprocessar + `window.confirm`;
  `runReprocess` mora aqui). `/admin/observabilidade` foi apagada.
- `dashboard/components/AdminContato.js` é o ÚNICO componente de contato, com
  duas rotas finas: Clientes → Contato em massa (`/admin/clientes/contato`:
  e-mail com `confirmTotal`, histórico, WhatsApp) e Operação → Modelos
  (`/admin/operacao/modelos`: edição de templates). `/admin/emails` foi apagada.
- Teste: `test/admin-menu-cinco-entradas.test.js`.

**Não regredir:** não recriar as duas páginas nem duplicar o componente; as
asserções de `test/admin-acoes-com-confirmacao.test.js` sobre `runReprocess` e
`enviarIndividual` apontam para os arquivos novos (nunca apagar a garantia);
menu = só 5 entradas. Custo: zero RAM, zero processo.

## Retenção de `AnalyticsEvent ops_*` em 90 dias (item 3 / M7, 2026-10-03)

- **O que era:** `AnalyticsEvent` sem limpeza para `ops_*`. Medição em produção: 409.199 linhas. Top: `ops_mirror_fallback_all_destinations` 205.663, `ops_store_photo_over_origin` 68.493, `ops_custom_domain_link_resolved` 53.871, `ops_wa_group_desync_autoheal` 28.170, `ops_wa_group_desync_unresolved` 13.132.
- **Onde mora:** `OPS_EVENT_RETENTION_DAYS` (default 90, `0` desliga) no sweep diário de `src/api/server.js` (`cleanupOldLogs`). Apagador em lotes: `src/observability/opsEventRetention.js` (5.000 por lote, pausa 200 ms, no máximo 40 lotes = 200 mil linhas por passada; o primeiro sweep termina nos dias seguintes, sem segurar o SQLite). Lista de eventos: `OPS_RETENTION_EVENTS` em `operationalSignals.js` (valores de `ANALYTICS_EVENT_BY_SIGNAL`), nunca `LIKE 'ops_%'`.
- **Fora da retenção de propósito:** `ops_self_*` (o bot-worker lê SEM janela para não reenviar mensagem: apagar faria reenviar boas-vindas/nudge), `ops_wa_phone_reuse_*`, `ops_billing_config_problem`, `ops_unsupported_store_daily` (poda própria de 30 d), `credential_expiry_alert_sent`, `session_telemetry` (poda própria) e funil/UTM.
- **Leitores de `ops_*` auditados (maior janela):** admin 7 d (desync) e 14 d no máximo; alerta de cegueira (`adminOpsAlertSweep`) janela curta; `diag-*` e `wa-forbidden-report` recebem `--days`/`--horas` do usuário (default 30 ou menos). Nada exige mais de 90 d, então o default é 90. Quem precisar de histórico maior sobe a env.
- **Índice:** já existe `@@index([event, createdAt])` em `AnalyticsEvent` (`prisma/schema.prisma`), que serve ao filtro `event IN (...) AND createdAt < cutoff`. Nenhuma migration criada.
- **Não regredir:** evento novo de sinal só entra na retenção se estiver em `ANALYTICS_EVENT_BY_SIGNAL`; marcador de dedup nunca entra. Teste: `test/analytics-retencao-ops.test.js`. Zero RAM.
