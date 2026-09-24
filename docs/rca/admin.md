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
