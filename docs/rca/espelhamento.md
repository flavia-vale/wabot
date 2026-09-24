# espelhamento — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## Mensagem do grupo monitorado espelhada N vezes (RCA 2026-07 — não regredir)

**Sintoma:** o grupo monitorado publicou UMA mensagem às 14:13. Em staging ela
saiu 5x (14:14, 18:41, 19:42, 19:52, 20:04); em produção saiu uma vez só, mas
5h atrasada (19:13). Mesmo código nos dois ambientes (`develop` == `main` na
data) — a diferença é de estado/configuração, não de versão.

**Causa de primeira ordem — a mensagem estava sendo VISTA várias vezes.**
Confirmado na fonte do Baileys 6.7.23 instalado (`lib/Socket/messages-recv.js`):

```js
await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify')
```

Mensagem **reentregue** pelo WhatsApp (fila offline, drenada a cada reconexão)
chega com `type: 'append'`; ao vivo chega como `'notify'`. O handler de
`messages.upsert` aceitava as duas vias, e a única barreira era o cutoff de
idade — que o Baileys monta com `messageTimestamp: +stanza.attrs.t`
(`lib/Utils/decode-wa-message.js`). **Sem o atributo `t` no stanza isso vira
`NaN`**, e o guard antigo (`if (msgTs && msgTs < cutoff) continue`) era
**pulado**: reentrega de horas antes passava direto para o pipeline.

Hoje a decisão vive em `shouldProcessIncomingMessage`
(`src/core/incomingFreshness.js`, puro/testado), chamada no chokepoint do
`messages.upsert`:

- `append` (reentrega/histórico) **sem** timestamp confiável → **descarta**;
- qualquer via com timestamp mais velho que `INCOMING_MAX_AGE_MS` (5min) → **descarta**;
- `notify` (ao vivo) sem timestamp → **processa** (é a via da mensagem nova;
  descartar perderia mensagem legítima).

**Não descartar `append` em bloco:** mensagem de **canal (`@newsletter`) ao
vivo** também chega como `append` (`Processed plaintext newsletter message`, no
mesmo arquivo do Baileys). Ela vem com `t` válido e recente, então passa pela
regra de idade — a distinção é a idade, não o tipo.

O descarte **loga motivo e idade** (`Mensagem descartada: reentrega/mensagem
velha não reentra no pipeline`). Antes era um `continue` mudo, o que tornava
impossível ver reoferta acontecendo no `bot.log`.

**Não esticar a janela de `msgIds` para compensar.** Ela vale **5min** de
propósito (`DEDUP_MSGID_WINDOW_MS`) — é a rede contra re-emissão imediata do
mesmo id, não a barreira contra reoferta horas depois; janelas curtas são o que
a semântica de cupom depende. **Não voltar a derivar `linkDedupWindowMs` de
`dedupeWindowMs`** (era `Math.max(dedupeWindowMs, ...)`): amarrar as duas faz
qualquer aumento em msgIds arrastar a janela de link junto e prender repost
legítimo.

**Segunda brecha, no lado do ENVIO:**

1. **A dedup por DB não enxergava envio ainda PENDENTE.** A consulta filtrava
   `sentAt` dentro da janela do link; só que `sentAt` de uma linha `queued` é o
   momento em que ela foi criada, e um job pode ficar **horas adiado** pela
   preservação do destino (`deferSendJob`: horário de funcionamento, burst cap,
   daily cap). Passados os 120min a linha pendente ficava invisível pra dedup, a
   mesma oferta entrava de novo na fila, e quando a janela do destino abria as
   duas (ou cinco) saíam em **rajada espaçada pelo throttle** — exatamente o
   padrão 19:42/19:52/20:04. Hoje a consulta tem dois ramos: `success` dentro de
   `effectiveDedupWindowMs`, **ou** `queued`/`sending` dentro de
   `pendingDedupMaxAgeMs` (produto: `PENDING_DEDUP_MAX_AGE_MS`, default 24h —
   teto só pra que uma linha presa em `queued` por bug não bloqueie o destino
   pra sempre). Mensagem que ainda não foi entregue é duplicata independente da
   idade. **Cupom fica de fora desse teto** (`pendingDedupMaxAgeMs` cai para a
   janela curta do cupom): a mesma URL de campanha é reposta várias vezes ao dia
   com códigos diferentes, e segurar a segunda porque a primeira ainda não saiu
   perderia oferta legítima.

**Forense (o que faltava para diagnosticar):** o `bot.log` só registrava
`messages.upsert recebido {type, count}` — sem `msgId` era impossível separar
"WhatsApp reofertou o mesmo `key.id`" de "a fonte republicou". Agora cada
mensagem ACEITA loga `Mensagem aceita para processamento {jid, msgId,
upsertType, hasValidTimestamp, ageMs}` e cada mensagem DESCARTADA loga o motivo
(`stale` / `replay_without_timestamp`) com a idade. Volume proporcional ao de
mensagens do socket.

**Atraso de horas ≠ duplicata.** Um envio pode ficar `queued` legitimamente
esperando a preservação do destino; o painel mostra a espera no `errorMsg` da
linha. Antes de tratar atraso como bug, rodar o diagnóstico abaixo e conferir
`operatingHours*`/`burstCap`/`dailyCap` do destino.

**Diagnóstico (read-only, roda no VPS dentro do diretório do ambiente):**
```bash
cd ~/wabot-staging && node scripts/diag-mirror-duplicates.mjs <email> \
  --since "2026-07-27 13:30" --until "2026-07-27 21:00"
cd ~/wabot && node scripts/diag-mirror-duplicates.mjs <email> \
  --since "2026-07-27 13:30" --until "2026-07-27 21:00"
```
Ele cruza `MessageLog` (incluindo pendentes), `SendDedupKey`,
`WaConnectionEvent`, `AnalyticsEvent ops_*`, a preservação de cada destino e o
`bot.log`, e diz explicitamente se o MESMO `key.id` foi aceito mais de uma vez.

Testes: `test/incoming-freshness.test.js`, `test/mirror-duplicate-replay.test.js`,
`test/bot-worker-relay-branding.test.js`.

## Espelhamento para grupo NÃO escolhido + foto borrada (RCA 2026-08-26 — não regredir)

Cliente `julianepumuceno16@gmail.com` reportou três coisas no mesmo dia: oferta
chegando com a foto **irreconhecível**, oferta chegando com a foto do
concorrente (marca d'água), e o robô **espelhando para grupo que ela nunca
escolheu** para aquela origem. São duas causas raiz independentes.

### 1) Foto borrada: publicávamos miniatura de 457 bytes

No log da oferta do Cooktop, em sequência: `Usando thumbnail do link preview
{ size: 457 }` → `resolveMonitoredImage: fetchProductImage { shopee }` → e
**nenhum** `imagem alta-res obtida via marketplace`. Ou seja: a mensagem de
origem não trazia imagem de verdade, só a miniatura embutida no card de link
(457 bytes ≈ 100px), a busca da foto oficial na loja não devolveu nada, e o
último recurso ("imagem ruim > nenhuma imagem") publicou essa miniatura
ampliada.

`core/thumbnailQualityPolicy.js` (puro) põe um **piso em bytes**: abaixo de
`MONITORED_MIN_IMAGE_BYTES` (default **800**) a miniatura não vira imagem de
corpo inteiro. `0` desliga o piso (comportamento histórico). Bytes é o único
sinal disponível de graça nesse ponto (o buffer ainda não foi decodificado).
Sinal durável `ops_monitored_thumbnail_dropped`.

⚠️ **O piso nasceu em 3000 e teve que cair para 800 no MESMO DIA.** 3000 veio de
analogia ("miniatura de card costuma ter 3-20KB"), não de medição, e derrubou a
imagem de muita oferta legítima. E o caminho de degradação estava errado: sem
imagem, o código só ligava `useLinkPreview`, que aciona o preview **automático**
do Baileys — e ele **não resolve link de afiliado encurtado**
(`s.shopee.com.br`, `amzn.to`, `meli.la`), limitação que abre o comentário de
`monitoredImageResolver.js`. Resultado em produção: a oferta chegou como **texto
pelado**, sem foto e sem card. Trocar foto ruim por nenhuma imagem é regressão.

Hoje o caminho sem imagem monta o **mesmo card manual do modo preview**
(`buildManualLinkPreview` com `fetchOriginPhoto`), e o plano B da foto de origem
roda ali **mesmo com `PREVIEW_CARD_ORIGIN_FALLBACK` desligado**
(`allowSmallOriginPhoto`): nesse ponto a alternativa não é uma foto melhor, é
nenhuma imagem. Miniatura pequena dentro de um card é legível — o problema
original era ela ampliada como imagem de corpo inteiro. **Não regredir:** não
voltar a confiar no preview automático como degradação, e não subir o piso sem
medir a distribuição real de bytes no `bot.log`. Guarda:
`test/oferta-sem-imagem-card.test.js`.

**A marca d'água não é nossa e não tem conserto por aqui**: quando a foto oficial
da loja não vem, o que sobra são os bytes da mensagem de origem — que é o
concorrente, marca d'água inclusa. Publicar isso segue melhor do que não publicar
nada; o que mudou é só o piso de legibilidade.

### 1b) Shopee sem foto: a resolução do short link estourava sob carga

Medição em produção (2026-08-26): das últimas 2000 buscas de foto de Shopee,
**780 voltaram sem URL nenhuma** — e os nulos estavam concentrados no worker
mais movimentado, enquanto os MESMOS links resolviam 8/8 num teste isolado.

Causa: a Shopee tem uma fonte de foto só (a API de afiliado), e ela precisa de
`(shopId, itemId)` — que só existem depois de resolver o short link. Essa
resolução é uma cadeia de vários redirects, cada hop com seu próprio timeout, e
ela roda **três vezes por mensagem** (conversão, título/preço, foto). Quando um
hop estoura, `resolveShopeeShortLink` devolve a URL curta como veio; sem ids, a
busca de foto vira `null` **silencioso** e a oferta sai com a miniatura da
mensagem de origem — 500 bytes nas origens que geram card próprio.

Conserto: cache da resolução **bem-sucedida** (`SHOPEE_SHORTLINK_CACHE_TTL_MS`,
6h; `0` desliga). Short link da Shopee é imutável, e a conversão já resolve o
link antes da foto — então a foto passa a reaproveitar. **Fracasso não é
cacheado**: guardar um timeout de rede transformaria falha pontual em "esse link
não tem produto" pelas horas seguintes. O cache é pulado quando `fetchImpl` é
injetado (stub de teste). Testes: `test/shopee-shortlink-resolve.test.js`.

⚠️ **Armadilha de diagnóstico que custou horas:** o passo "teste ao vivo" de
`scripts/diag-preview-sem-imagem.mjs` chamava `fetchProductImage(plat, url, {})`
— **sem credencial**. Para a Shopee isso pula o único caminho que funciona, e o
script reportava `shopee 0/N com foto` para QUALQUER conta, sugerindo bloqueio da
loja que não existia. Amazon e ML não denunciavam o defeito porque têm fontes que
funcionam sem credencial. Corrigido: o script carrega as credenciais reais da
conta. Ao ler "a loja não devolveu foto", confirme sempre com
`scripts/diag-shopee-foto.mjs`, que usa a credencial e separa chave recusada de
item fora do catálogo.

### 1c) Miniatura da origem varia MUITO por grupo de origem

Também medido em 2026-08-26, por grupo de origem, no mesmo log:

| Origem | miniatura (menor / mediana / maior) |
|---|---|
| Ofertas da Gio | 332 / 500 / 654 bytes |
| OFERTAS BABY #2 | 355 / 525 / 722 bytes |
| Achadinhos da Cabeleireira | 1.148 / 35.761 / 65.532 bytes |
| DUDA INDICA | 2.240 / 9.405 / 21.256 bytes |

Origens que geram o próprio card (com marca d'água) mandam miniatura de ~500
bytes; outras mandam 10-60KB. É isso — e não configuração de grupo, conta ou
credencial — que faz "esse grupo manda foto e aquele não" quando a foto da loja
falha. Ferramenta: `scripts/diag-thumb-por-origem.mjs`.

### 2) Espelhamento para destino não escolhido: `GroupTarget` some por cascata

A regra era `targetPostJids.length ? targetPostJids : todos os destinos` — "sem
vínculo" significava "manda para TODO MUNDO". Só que `GroupTarget` tem
`onDelete: Cascade` no destino: **apagar um grupo de destino apaga os vínculos
que apontavam para ele**. Uma origem amarrada explicitamente a N destinos, ao
ficar com zero vínculos por causa dessas exclusões, deixava de ser explícita e
passava a espelhar para todos os destinos da conta. O painel piorava: `GET
/:id/targets` devolvia `mode:'all'` com TODOS os destinos marcados, então a tela
dizia que estava tudo certo.

`Group.targetsMode` ('explicit' | 'all', migration
`20260826180000_group_targets_mode`) guarda a **intenção** da cliente. Decisão
inteira em `core/destinationRouting.js` (`resolveMonitorDestinations`):

- `explicit` → usa a lista escolhida; **lista vazia = nenhum destino**, nunca
  "todos" (melhor não enviar do que enviar errado — envio errado é irreversível);
- `all` (quem nunca escolheu) → comportamento histórico preservado, agora com
  aviso no log e sinal `ops_mirror_fallback_all_destinations`.

Salvar destinos no painel grava **sempre `explicit`, inclusive com a lista
vazia**. A migration marca como `explicit` toda origem que já tem vínculo hoje.

⚠️ **Corrigido em 2026-09-13 — não regredir.** Até aqui, salvar sem nenhum
marcado gravava `all`, "porque é como a tela sempre se comportou". O efeito era
o relato da cliente: ela desmarcava todos, salvava, voltava e **encontrava tudo
marcado de novo** — `all` faz o `GET /:id/targets` devolver TODOS os destinos da
conta, e a tela obedientemente marcava todos. Pior que o incômodo visual: a
origem continuava espelhando para grupos que ela acabara de desmarcar, que é
exatamente o que o RCA acima existe para impedir. Desmarcar tudo e salvar é a
cliente dizendo "não mande para ninguém" — a origem para de enviar até ela
escolher de novo, e a tela avisa isso antes do salvamento. `all` ficou valendo
só para quem **nunca** salvou destino nenhum naquela origem. Guardas:
`test/groups-route-targets-mode.test.js` (reabrir a tela depois de salvar
vazio), `test/painel-destinos-editor.test.js` (texto do aviso e `mode` gravado
pela tela).

### 3) Job já enfileirado não era cancelado

Os destinos são calculados quando a mensagem CHEGA; o job só sai no dequeue, que
pode ser muito depois (preservação do destino, freio de fila). Uma entrega saiu
**1,5s depois** de a cliente apagar o destino no painel. Agora o job `converted`
carrega `sourceJid` e `processSendJob` **revalida o destino no dequeue**
(`shouldDropUnlinkedDestination`), antes do descarte por idade: destino que não
está mais na lista atual vira `skip:dest_unlinked` (`skip:source_unlinked` se a
origem sumiu), categoria `CONFIG_BLOCK`, com tradução leiga no painel. Fail-safe:
sem foto confiável da config, **envia** (descartar por dúvida perderia oferta
legítima). `status@broadcast` nunca é descartado por essa checagem.

### 4) `configReloaded: {}` no log da API não confirmava nada

`reloadConfig` é assíncrono no modo `remote` e as rotas de grupo **não davam
`await`** — a Promise ia crua para o logger e virava `configReloaded: {}`.
Parecia confirmação e não era: não dizia se o supervisor recebeu o comando nem
se o worker invalidou o cache, e foi o que impediu de separar "job antigo ainda
saindo" de "worker nem recarregou". Hoje as quatro rotas usam
`reloadWorkerConfig` (await + `configReloadError` no log).

**Não regredir:** não voltar a decidir destino fora de `resolveMonitorDestinations`;
não tratar lista explícita vazia como "todos"; não remover a revalidação no
dequeue nem movê-la para depois do envio; não voltar a publicar miniatura sem
piso; não chamar `reloadConfig` sem `await` nas rotas. Testes:
`test/destination-routing.test.js`, `test/thumbnail-quality-policy.test.js`,
`test/groups-route-targets-mode.test.js`.

⚠️ Em modo `remote` o deploy da API **não** recarrega os bot-workers — nada disso
vale nos bots antes de `pm2 restart bot-supervisor --update-env` (reconecta TODAS
as sessões: avisar antes). Ver "código novo não carregado pelos bots".

## Marca d'água do concorrente: origem que ANEXA foto própria (RCA 2026-08-27)

Depois do conserto de 26/08, duas origens da mesma cliente voltaram a receber a
foto limpa da loja e outras duas continuaram com a marca d'água do concorrente.
A diferença **não** era conta, destino nem configuração: era o que cada origem
manda.

`resolveMonitoredImage` (modo `original`) tinha um atalho: foto cheia da origem
(acima do limiar de miniatura) era republicada **direto**, sem nem tentar a
loja. Origem que manda só a miniatura do card passava pelo upgrade e ganhava a
foto oficial; origem que **anexa foto de verdade** nunca chegava lá — e essa
foto é a do concorrente, marca d'água queimada em cima.

Medido em produção (mesmas contas, mesmo minuto):

| Origem | fotos de verdade | só miniatura |
|---|---|---|
| Ofertas da Gio | 0 | 1.746 |
| OFERTAS BABY #2 | 0 | 679 |
| Ofertas Mamãe Bebê #3 | 372 | 0 |
| PROMO DO BEBÊ #12 | 100 | 0 |

`core/storePhotoPreference.js` (`shouldPreferStorePhoto`) decide a troca, e ela
é **conservadora de propósito** — buscar foto da loja para qualquer link já
publicou produto ALEATÓRIO antes (camiseta branca 2026-06; banner em produto
#1205/#1208). Só troca quando:

- `linkKind === 'product'` — o conversor resolveu ASIN/MLB/(shopId,itemId)
  antes de gerar o link curto. É a afirmação mais forte de que o link aponta
  para UM produto, e cobre a Shopee, que não tem detector por regex mas marca
  `linkKind` no próprio converter;
- a mensagem não é de cupom (ali a ausência de produto é o normal);
- `titleOverlap !== 'mismatch'`. `'unknown'` **não** bloqueia — a garantia vem
  do `linkKind`, não do título, e Shopee cai sempre em `'unknown'`.

**A troca é best-effort e nunca perde imagem**: loja sem foto mantém a foto da
origem (foto com marca d'água > oferta sem foto). Sem preferência, o atalho
histórico continua valendo e **não** custa rede a mais. Sinal durável
`ops_store_photo_over_origin`; escape hatch `STORE_PHOTO_OVER_ORIGIN=false`.

**Não regredir:** não afrouxar a trava para trocar sem `linkKind === 'product'`;
não fazer a troca em mensagem de cupom; não deixar a oferta sair sem foto quando
a loja falhar. Teste: `test/store-photo-over-origin.test.js`.

## Oferta que chega pelo SITE PRÓPRIO do grupo de origem (RCA 2026-09-13)

Cliente (`raelysouza98@gmail.com`) reportou "o robô não espelha". Não havia
defeito: o grupo monitorado publica a oferta pelo **domínio próprio do dono
dele** (`https://dicasdeamigas.com.br/p/yaQ4mlRhfU`), nunca pelo link da loja.
`detectLinks` só conhece os domínios das lojas suportadas, então a mensagem
chegava "sem link", o sanitizador apagava a URL de terceiro (corretamente — ela
credita o concorrente) e a oferta morria em `skip:policy:...:nolink` /
`skip:no_valid_conversions`.

**Medido no link real antes de escrever o código** (não é suposição): NÃO é
redirect HTTP — responde **200 com HTML** (Next.js), e o corpo traz **as duas**
URLs: o short link de afiliado do concorrente (`https://link.amazon/...`) e a
**URL limpa do produto** (`https://www.amazon.com.br/dp/B088PNBKTR/`).

| Peça | Onde |
|---|---|
| Decisão + resolução (puro + I/O injetado) | `src/core/customDomainLinkResolver.js` |
| Gancho no robô | `unwrapCustomDomainOfferLinks` em `src/bot-worker.js` |
| Sinal durável | `ops_custom_domain_link_resolved` |

O módulo devolve o **texto** com a URL de domínio próprio trocada pela da loja.
Por rodar **antes** do sanitizador, o resto do pipeline (sanitizador, detector,
conversor, dedup, imagem) segue byte a byte como já era — nenhum deles mudou.

### Oferta com 3+ links chegava com só dois (RCA 2026-09-17 — não regredir)

Cliente reportou: oferta com três ou quatro produtos chegava ao grupo com **dois
links convertidos e, do terceiro em diante, nenhum link — só o texto do
produto**.

Não era limite de quantidade, nem conversão falhando: era o desembrulho de
domínio próprio **desligando-se pela mensagem inteira**. `findCandidateLinks`
abria com `if (cleaned.some(isOfferUrl)) return []` — um único link de loja no
texto bastava para nenhuma URL ser desembrulhada. Numa oferta **mista** (os
primeiros produtos com link direto da Amazon/ML e os seguintes pelo site do dono
do grupo, como `clubedoachadinho.com.br/p/…`, `compre.link/…` ou
`dicasdeamigas.com.br/p/…` — os três já medidos em produção), os links
embrulhados nunca viravam link de loja, `removeNonOfferUrls` os apagava na linha
seguinte (corretamente: eles creditam o concorrente) e a cliente via a linha do
produto sem URL nenhuma. Os dois primeiros saíam porque já eram link de loja.

⚠️ **Nada disso aparecia no painel**: a mensagem era gravada como `success` (ela
saiu), e o desembrulho nem chegava a rodar, então também não havia linha de
falha no `bot.log`. "Some o link e fica só o texto" era o único sinal.

**Não regredir:**

- Não voltar a desligar a varredura inteira quando existe link de loja no texto
  — é literalmente o bug. Guardas em `test/custom-domain-link-resolver.test.js`
  ("oferta MISTA").
- O teto de candidatos por mensagem (`MAX_CANDIDATES_PER_MESSAGE`, 2) continua
  valendo: grupo que despeja dez links embrulhados não pode virar dez idas à
  rede dentro da fila serial.

**Não regredir:**

- **A decisão é POR LINK, nunca pela mensagem inteira** (corrigido em
  2026-09-17 — não regredir). Candidato é a URL que NÃO é de loja suportada:
  é ela que o sanitizador vai apagar em seguida. Link que já é de loja fica
  fora dos candidatos, então mensagem só com link de loja (ou sem link) segue
  sem gastar rede — o custo continua zero onde já era zero.
- **Mensagem MISTA gasta um orçamento menor** (`CUSTOM_DOMAIN_MIXED_BUDGET_MS`,
  6s, contra os 13s de `CUSTOM_DOMAIN_TOTAL_BUDGET_MS`). Ali o desembrulho é um
  ganho — recupera o link que seria apagado —, nunca a diferença entre espelhar
  e não espelhar: a oferta sai de qualquer jeito pelos links de loja que já
  existem. Gastar o orçamento cheio arriscaria estourar os 25s de preparo da
  mensagem (`MSG_QUEUE_TIMEOUT_MS`) e derrubar uma oferta que hoje funciona.
- **Roda ANTES de `sanitizeInviteLinks`.** Invertido, a URL de domínio próprio já
  foi apagada e não há o que desembrulhar — é exatamente o estado anterior ao
  fix. Guarda estrutural no teste.
- **O link de terceiro NUNCA é publicado.** Ele é substituído pelo da loja (que
  ainda passa pela conversão com a credencial da cliente) ou fica como estava, e
  aí o sanitizador o remove como sempre removeu. Falha aqui não vaza comissão.
- **Preferir a URL com ID de produto** (`urlHasProductId`), não a primeira do
  HTML. A limpa converte melhor (o conversor lê o ASIN direto) e não carrega a
  etiqueta do concorrente.
- ⚠️ **Não extrair do HTML com `PATTERNS` do detector.** O `[^\s]*` de lá foi
  feito para TEXTO CORRIDO; em JSON minificado não há espaço, e — medido — o
  primeiro link engolia milhares de caracteres e **escondia** a URL limpa do
  produto, fazendo a preferência acima nunca ver a melhor opção. A URL é
  recortada nos delimitadores de HTML/JSON **antes** de ser classificada.
- **Anti-SSRF obrigatório** (`isSafeCandidateUrl`): o link vem de grupo de
  TERCEIROS, é entrada hostil. Sem isso o robô viraria buscador de rede interna
  para quem publicasse `http://169.254.169.254/...` no grupo monitorado. Recusa
  IP literal (v4/v6), host sem ponto, sufixo de rede local, credencial embutida
  e porta fora de 80/443.
- **Fracasso não é cacheado** (mesma lição do short link da Shopee); sucesso vale
  6h. **Fail-safe é não mexer no texto**: qualquer erro devolve o original.
- **O teto de links por mensagem NÃO é mais 2 — ele ERA a queixa** (RCA
  2026-09-19). A cliente dizia, com estas palavras, "não está convertendo mais
  de 2 links": o grupo de origem publica **todos** os produtos pelo site próprio
  do dono, então numa oferta de 3-4 produtos os dois primeiros eram
  desembrulhados e o terceiro em diante **nem chegava a ser tentado** — o
  sanitizador apagava o link embrulhado e sobrava a linha do produto sem URL
  ("Link do Livrinho :"). O número 2 nunca foi medição: veio de "2 candidatos de
  4s cabem com folga". Hoje são **6** (`CUSTOM_DOMAIN_MAX_LINKS`), porque o
  guarda de tempo passou a ser o orçamento da mensagem dividido entre os links
  (item acima) — o teto virou "quantos produtos uma oferta real tem", não um
  número escolhido pelo relógio. ⚠️ **O que vigiar depois de subir:**
  `timeout:incoming` em mensagem com muitos links. O desembrulho e a conversão
  dividem os mesmos 25s de `MSG_QUEUE_TIMEOUT_MS`, e a conversão é serializada
  por loja — 6 links da MESMA loja podem chegar perto do teto. Se aparecer, o
  assunto é o teto de 25s, não o número de links.
- **Tempo generoso por link E teto na mensagem
  inteira.** Medido em staging (2026-09-13): o MESMO endereço respondeu em
  **568ms** numa chamada e **estourou 4s** na seguinte — o site oscila muito a
  partir do servidor. Confirmado em produção (2026-09-14): os DNS IPv6 da
  Hetzner falharam de forma intermitente, uma tentativa estourou os 8s e a
  seguinte resolveu em 2,6s. Por isso há no máximo 2 tentativas, mas a segunda
  só ocorre para `tempo_esgotado`/`erro_de_rede:*`; 403, HTML sem loja e recusas
  de segurança nunca repetem. Por tentativa o teto segue 8s
  (`CUSTOM_DOMAIN_FETCH_TIMEOUT_MS`); na mensagem inteira são 13s
  (`CUSTOM_DOMAIN_TOTAL_BUDGET_MS`), preservando ~12s dos 25s de preparo para
  converter e buscar a foto. O teto é da mensagem inteira, qualquer que seja o
  número de links — não multiplicar por candidato. O log traz `attempts` e
  `recoveredByRetry`, para medir recuperação sem esconder a primeira falha.
- **O orçamento da mensagem é DIVIDIDO entre os links, nunca gasto por ordem de
  chegada** (RCA 2026-09-18). Sem divisão, o PRIMEIRO link embrulhado consumia o
  orçamento inteiro e o segundo nem chegava a ser tentado
  (`sem_tempo_no_orcamento`) — a oferta chegava ao grupo com dois **"Compre
  aqui:" vazios**, que é exatamente o que o desembrulho por link (fix anterior)
  existia para impedir. Cada link recebe agora "o que sobra dividido pelos links
  que ainda faltam"; link rápido devolve a sobra ao seguinte (resolveu em 600ms
  → o próximo volta ao teto cheio de 8s), então o caso comum não fica mais
  lento. **E o orçamento da mensagem MISTA precisa caber ao menos UMA tentativa
  cheia**: ele nasceu em 6s com o teto por link em 8s, ou seja, um site lento
  não tinha como terminar nem a primeira tentativa. Hoje são 10s
  (`CUSTOM_DOMAIN_MIXED_BUDGET_MS`) — não baixar sem medir. Guarda estrutural e
  funcional em `test/custom-domain-link-resolver.test.js`.
- **A falha NUNCA pode ser só `null`.** Foi assim que uma investigação inteira
  precisou de quatro rodadas de comando em staging: código no ar, rede boa (200
  em 568ms), página trazendo o link e cada peça acertando isoladamente — e a
  única informação disponível era `null`.
  `resolveStoreUrlFromCustomDomainDetailed` devolve `{ store, reason, detail }`
  (`tempo_esgotado`, `recusado_http_<status>`, `pagina_sem_link_de_loja`,
  `endereco_recusado`, `sem_tempo_no_orcamento`, `erro_de_rede:<nome>`…) e o
  robô loga `Link de domínio próprio NÃO resolveu até a loja`. Mesma lição de
  "o caminho do card de preview era MUDO".

Envs (todas opcionais): `CUSTOM_DOMAIN_LINK_RESOLVE` (default LIGADO; só o valor
exatamente `false` desliga), `CUSTOM_DOMAIN_FETCH_TIMEOUT_MS` (8000),
`CUSTOM_DOMAIN_TOTAL_BUDGET_MS` (13000), `CUSTOM_DOMAIN_MAX_LINKS` (6),
`CUSTOM_DOMAIN_MAX_ATTEMPTS` (2),
`CUSTOM_DOMAIN_MAX_BYTES` (512KB),
`CUSTOM_DOMAIN_CACHE_TTL_MS` (6h). Ajustar o tempo **não exige deploy** — é
`.env` + `pm2 delete`/`start` (pegadinha #1).
**Custo: nenhum processo novo, zero impacto de RAM** (cache em memória podado em
500 entradas).

⚠️ Em modo `remote` o deploy da API **não** recarrega os bot-workers — isto só
passa a valer nos bots depois de `pm2 restart bot-supervisor` (reconecta TODAS
as sessões: anunciar antes). Ver "código novo não carregado pelos bots".

Teste: `test/custom-domain-link-resolver.test.js` (com fixture do HTML real em
`test/fixtures/custom-domain-offer-page.html`).

### Oferta ENCERRADA virava produto aleatório; formatação e retry (RCA 2026-09-18, 2ª rodada)

Cliente reportou que uma oferta que **convertia** passou a aparecer na aba
Envios como "ainda não fazemos conversão para essa loja"
(`skip:policy:...:unsupported_store` — ou seja, **nenhum** link virou link de
loja). Três defeitos no mesmo caminho, os três medidos ao vivo contra o site
real (`dicasdeamigas.com.br`), não deduzidos:

| Defeito | Medição |
|---|---|
| **Oferta encerrada vira produto aleatório** | `/p/<slug>` de oferta encerrada (ou slug inválido) responde **307 → `/promocao-encerrada`**, página com **13 produtos DIFERENTES**. O robô pegava o primeiro e publicava no grupo um item sem relação com o texto — gravado como `success` |
| **Marcador do WhatsApp entrava na URL** | `*https://site/p/abc*` virava candidato `.../p/abc*`, endereço que não existe → cai no 307 acima → produto errado. O detector removia esse marcador desde 15/09 (`normalizeDetectedUrl`); o desembrulho não, e as duas pontas discordavam sobre onde a URL termina |
| **A fatia por link matou o retry** | com 2 candidatos a fatia (6,5s) fica igual ao teto da tentativa, então a 2ª tentativa nascia com prazo zero. Reproduzido: link 1 estoura → 1 resolvido de 2 no código antigo, 2 de 2 no novo, **no mesmo tempo de parede** |

**Não regredir:**

- **Na dúvida sobre QUAL produto é o da oferta, não publica.**
  `isListingPageAfterRedirect` recusa quando um **redirect** levou a uma página
  com **mais de um produto diferente** (`countDistinctProducts`, que conta
  produto e não URL — short link e URL limpa do mesmo item contam como um). A
  página de oferta de verdade traz 1 produto em 2 endereços; a de lista trazia
  13. Vale a regra canônica: oferta não enviada é recuperável, oferta enviada
  com o link errado não é (mesma família da "camiseta branca" e de #1205/#1208).
- **A trava exige o REDIRECT de propósito.** Sem ele, página que entrega a
  oferta em 200 com produtos relacionados continua resolvendo como antes —
  apertar isso mudaria o comportamento dos 8 sites que hoje funcionam.
- **O desembrulho usa `normalizeDetectedUrl`, a MESMA regra do detector.** Duas
  regras para "onde a URL termina" é como um link formatado vira endereço
  inexistente em silêncio.
- **O retry roda em DUAS PASSADAS.** Passada 1: cada candidato ganha uma
  tentativa dentro da sua fatia (link lento continua sem poder zerar a chance
  dos outros). Passada 2: quem falhou por motivo **transitório** tenta de novo
  com o que sobrou do orçamento da mensagem. Uma passada só era o que fazia um
  blip de DNS (medido em 14/09) derrubar os dois links da mesma oferta.
- Motivo próprio no log: `pagina_de_lista_apos_redirect`, com quantos produtos
  e em qual endereço — "não resolveu" e "resolveu no produto errado" pedem
  ações opostas.

Teste: `test/custom-domain-link-resolver.test.js`.

### "Não fazemos conversão para essa loja" numa oferta da AMAZON (RCA 2026-09-19)

Cliente mandou print da aba Envios: oferta de Palmolive, cinco links do site do
dono do grupo, marcada como **ignorada** com o texto *"ainda não fazemos
conversão automática de afiliado para essa loja"*. A loja era a **Amazon**, que
convertemos desde sempre.

**Medido nos cinco links reais, um a um:** todos respondem **307 →
`/promocao-encerrada`**. A promoção tinha saído do ar no site de quem publicou
antes de o robô abrir o link. Ou seja: o robô agiu **certo** ao não publicar
(a guarda de página de lista impediu que saísse um produto aleatório). O que
estava errado era o que a cliente LIA.

**Não regredir:**

- **"A oferta acabou" tem motivo próprio** (`:offer_ended_at_source`), decidido
  por `allCandidatesFailedBecauseOfferEnded` — exige que **TODOS** os links
  tenham caído na página de encerrada; um único link com outra falha significa
  que a oferta não acabou. As duas frases pedem ações opostas: uma manda
  esperar por um suporte de loja que **já existe**, a outra diz que não há nada
  a fazer. Mesma família do RCA de 13/09, em que o motivo genérico mandava a
  cliente mexer na configuração que estava certa.
- **O motivo precisa CHEGAR ao painel, não só ao log.**
  `unwrapCustomDomainOfferLinks` devolve `{ text, failures }` por isso. Guarda
  estrutural no teste.
- ⚠️ **Esta sessão e outra corrigiram o MESMO teto de candidatos em paralelo**
  (pegadinha #10). O teto vencedor é o de `CUSTOM_DOMAIN_MAX_LINKS` (6), da
  outra sessão — não reintroduzir uma segunda env para a mesma coisa.

Testes: `test/custom-domain-link-resolver.test.js`, `test/painel-logs-copy.test.js`,
`test/mobile-logs.test.js`.

### Nem todo site de domínio próprio entrega o link (medição antes de investir)

Em produção o desembrulho passou a atender **oito sites diferentes** nas quatro
lojas (clubedoachadinho, meli.ofertasluan, temdetudotchelo, centraldapromoo,
compre.link, magazineluiza.onelink, dicasdeamigas, achadosdetenis). Os que
falham caem em três motivos, e **cada um pede uma ação diferente** — por isso o
motivo é registrado em vez de virar um "não deu" genérico:

| Motivo | Exemplo medido | O que é |
|---|---|---|
| `pagina_sem_link_de_loja` | `oasisdeofertas.com.br` | **casca de 1.994 bytes**, idêntica em páginas diferentes: app React (Lovable) que monta tudo por JavaScript e busca de um backend próprio. O link não existe no HTML |
| `recusado_http_403` | `pechin.co` | o site **barra o nosso servidor** (mesma família do muro do Mercado Livre) |
| `tempo_esgotado` | `centraldapromoo.com.br` | lentidão pontual — o mesmo endereço resolveu depois |

⚠️ **Renderizar a página num navegador de verdade (Playwright) está DESCARTADO**
por memória: cada instância custa ~300 MB e o servidor já opera com folga zero
pela política (`evaluateCapacity` dá limite seguro de 35 robôs com 36 ligados).
É a REGRA #1 da política de memória — se alguém reabrir isso, precisa vir com
estimativa e OK explícito.

**Antes de investir em qualquer um desses caminhos, MEDIR** — a resposta muda
conforme quantos sites e quantas clientes cada motivo afeta:

```bash
cd ~/wabot && node scripts/diag-dominio-proprio.mjs --horas=72
```

Read-only, lê o `bot.log` em stream (nunca carrega o arquivo na memória) e
agrega por site, por motivo e por **quantas contas** cada site afeta — "3 sites
falhando" pode ser uma cliente ou trinta, e as duas situações pedem decisões
opostas. Falha ao cruzar com o banco é **impressa**, nunca engolida (lição do
`diag-assinatura-recusada.mjs`, onde `.catch(() => [])` virou "nenhuma conta
encontrada"). Teste: `test/diag-dominio-proprio.test.js`.

### O motivo no painel culpava a configuração da cliente (mesma investigação)

"Mensagem fora das regras de encaminhamento que **você** configurou para este
grupo" era o que a cliente lia — e a causa não tinha nada a ver com a
configuração dela. `skip:policy:...` só ganha o sufixo `:unsupported_store`
(que vira "ainda não fazemos conversão para essa loja") quando sobrou URL no
texto, e o teste era feito no texto **já sanitizado** — de onde o sanitizador
acabara de REMOVER toda URL que não é de loja suportada. Ou seja: exatamente a
mensagem que deveria ganhar o sufixo chegava sem URL nenhuma e caía na frase
genérica, mandando a cliente mexer em "Lojas aceitas" e no modo de
encaminhamento, que estavam certos.

**Não regredir:** o sufixo é decidido sobre o texto de ANTES do sanitizador
(`findCandidateLinks(textoParaEspelhar)`) — a MESMA regra do desembrulho, para
que as duas pontas nunca discordem sobre o que é "link de loja desconhecida"
(ela ignora convite de grupo e rede social, que não são loja). `hasGenericUrl`
segue como está no outro uso (o descarte silencioso de `messageKind === 'other'`)
— ampliá-lo ali transformaria ruído de protocolo em linha no painel.

## Links da mesma loja disputavam UMA sessão de afiliado (RCA 2026-09-17)

O espelhamento convertia todos os links da mensagem com `Promise.all` puro. O
comentário original justificava: "conversores fazem 4-5 chamadas HTTP
sequenciais cada; processar N links em série estoura o teto da fila". Está certo
entre lojas DIFERENTES — e errado dentro da MESMA loja, porque ali os
conversores não são independentes: dividem **uma** sessão de afiliado.

Medido, loja por loja:

| Loja | Sessão compartilhada | Tinha serialização? |
|---|---|---|
| Mercado Livre | cookie `ssid` **rotacionado** a cada `createLink` | sim — `withMercadoLivreCredentialLock`, timeout de 12s |
| **Amazon** | cookie do SiteStripe **rotacionado** a cada `getShortUrl` | **nenhuma** |
| SHEIN | token de sessão por etiqueta | nenhuma |
| AliExpress | cookie do portal de afiliado | nenhuma |

- **ML**: 4 links disparados juntos, ~4s por chamada → um já estoura a trava
  (`ML_AFFILIATE_LOCK_TIMEOUT`) e cai no fallback `partner_id`, e o conjunto
  ainda come 12s dos 25s de preparo (`MSG_QUEUE_TIMEOUT_MS`). O paralelismo não
  acelerava nada — a trava já serializava — e só trocava espera por falha.
  Reproduzido e depois confirmado corrigido: 4 conversões boas em 16s, nenhuma
  falha.
- **Amazon**: em paralelo, todas as chamadas saem com o cookie VELHO e disputam
  a persistência do novo — a última escrita vence e as demais rotações se
  perdem. O sintoma é a parede "Acessar Amazon" no meio de uma sessão viva, e a
  oferta sai com o link longo `?tag=` em vez do `amzn.to` (some a comissão
  curta, não o link).

`src/core/conversionScheduler.js` (`convertPerPlatformSerially`) resolve:
**links da MESMA loja convertem um de cada vez; lojas diferentes seguem em
paralelo.**

**Não regredir:**

- **Não voltar a `Promise.all(links.map(...))` sobre a lista inteira de links** —
  guarda estrutural em `test/conversion-scheduler.test.js` falha se voltar.
- **Não serializar TUDO numa fila só**: aí uma loja lenta atrasaria as outras,
  que é o problema que o paralelismo original resolvia de verdade.
- **A ordem de saída é a ordem do TEXTO**, não a de conclusão — a eleição do
  link primário (`first`/`last`) e os logs dependem disso.

⚠️ **O tempo de parede da mensagem com muitos links da MESMA loja sobe** (4
links de ML: ~12s antes com uma falha, ~16s agora sem nenhuma), dentro dos 25s
de `MSG_QUEUE_TIMEOUT_MS`. Não é overhead novo — a trava do ML já serializava;
o que mudou é o 4º link ser convertido de verdade em vez de falhar. Ao validar,
vigiar `timeout:incoming` no painel: se aparecer em mensagem com muitos links,
o teto de 25s é que precisa de conversa, não o agendador.

## Espelhamento absorveu a tela de Grupos (2026-09-19 — não regredir)

`/painel/grupos` **deixou de existir** e virou redirecionamento para
`/painel/espelhamento`. O endereço antigo continua respondendo porque está em
e-mail já enviado, no tutorial, no checklist de ativação e em link que a
cliente guardou — caçar cada um é mais caro que redirecionar.

**Princípio da tela: ver no nível 1, configurar no nível 2.** A lista e o mapa
mostram o FLUXO; toda configuração vive num painel lateral que abre ao clicar
no card do grupo. **Nada de formulário aberto dentro da lista** — era isso que
fazia a tela de Grupos crescer sem fim e sumir para baixo no celular.

| Onde ficava (tela de Grupos) | Onde fica agora |
|---|---|
| Abas Monitorar / Publicar | as duas colunas da aba "Grupos" |
| Carregar do WhatsApp / Adicionar canal | modal "+ Adicionar" de cada coluna |
| Para onde esse grupo envia | painel da ORIGEM, aba **Destinos** (e pelo mapa de Conexões) |
| Lojas, palavras bloqueadas, sem link | painel da ORIGEM, aba **Captura** |
| Formato da mensagem, link principal, texto adicional | painel da ORIGEM, aba **Publicação** |
| Imagem, marca d'água, boas-vindas, botão "Ver canal", anti-ban | painel do DESTINO |
| Excluir grupo | rodapé do painel, com confirmação |

⚠️ **As duas colunas VOLTARAM e isso é decisão de produto, não regressão.** Em
2026-09-19, de manhã, as colunas tinham virado um cartão por ORIGEM
("LÊ DE → PUBLICA EM") com um assistente de dois passos. O desenho de cartões
não tem porta de entrada para o DESTINO — e é no destino que moram imagem,
marca d'água, boas-vindas, botão "Ver canal" e anti-ban. Sem a coluna de
destinos, metade da tela de Grupos não teria onde ser absorvida. O que o cartão
entregava de bom **não se perdeu**: quantas ofertas saíram hoje, as lojas
aceitas e "envia para" vivem dentro do card da coluna de origem, montados pela
MESMA regra pura (`buildMirrorCards`).

**O assistente "Criar novo espelhamento" saiu** — dois caminhos para a mesma
coisa confundem. Os avisos dele, porém, continuam valendo e foram para a aba
Destinos do painel, ANTES de salvar: quem deixa de receber ao sair do padrão
`all` (RCA 2026-08-26), origem que fica sem destino nenhum e destino removido.

**Não regredir:**

- **A lista salva NUNCA vai crua ao endpoint.** `saveTargets` passa por
  `planMirrorCreation({ modo: 'editar' })` — o `PUT /groups/:id/targets`
  SUBSTITUI a lista da origem, e gravar o rascunho da tela sem a regra apaga
  vínculo em silêncio.
- **A origem destacada da aba Conexões é DERIVADA no render**
  (`resolveInitialOrigin`), nunca gravada por efeito.
- **`targetsState` é a fonte ÚNICA dos vínculos** — cards, mapa e o seletor de
  destinos leem o mesmo registro. Por isso salvar no painel atualiza a lista e o
  mapa atrás dele na hora, sem recarregar, e sem um GET por abertura de gaveta.
- **Fechar o painel com mudança não salva pede confirmação**, e o card mostra
  "destinos não salvos" enquanto isso.
- **A escolha de contas do Instagram mora na aba Destinos da origem** — é
  destino como os outros (`instagramMirrorTargetsUpdate`, atrás de
  `hasInstagramStoriesAccess`).
- **Linguagem:** a tela diz "origem" e "destino". Onde o código usa
  `role: 'monitor'` a tela diz origem; `role: 'post'`, destino. Nunca monitor,
  post, jid, imageMode, template key, relay ou preview na tela.
- **No celular** as colunas viram uma lista só com seletor Origens|Destinos, e
  a gaveta vira folha de tela cheia **sem largura fixa** (RCA 2026-09-05).
- Nenhuma rota ou contrato de API novo: a tela usa exatamente as chamadas que as
  duas telas já faziam.

### O celular: o que foi MEDIDO em 375px (2026-09-19 — não regredir)

A tela subiu com "frases quebradas" e toque ruim no celular. Os números são de
renderização real em 375px, não de leitura de código:

| Onde | Antes | Depois |
|---|---:|---:|
| largura de texto do card (nome, "envia para", lojas) | **108px** | **215px** |
| altura da seção de destinos na gaveta | 257px para 398px de conteúdo (**cortava no meio de um nome**) | 476px, nada cortado |
| rótulo do "+ Adicionar" da coluna | quebrava ("Adicio/nar") | uma linha |
| papéis do modal "Adicionar" | 429px de conteúdo em 315px — **"Destino" nascia fora da tela** | duas linhas inteiras |

Os 108px saíam da soma: avatar 38 + pílula de contagem + engrenagem 36 + três
paddings comiam quase tudo que havia. **Não regredir:**

- **No celular a ENGRENAGEM e a PÍLULA saem, o card não.** O card inteiro já é
  o alvo de toque (`aria-label="Configurar <nome>"`); dois alvos lado a lado em
  36px só produziam toque errado, e a pílula "3→" repete o que a linha de fluxo
  logo abaixo diz por extenso. A seta que entra no lugar vive **dentro** do
  botão do card, `aria-hidden`, para não virar um segundo alvo.
- **`overflow-wrap: break-word`, nunca `anywhere`, no nome do grupo.**
  `anywhere` parte a palavra assim que ela não cabe na SOBRA da linha — era o
  que produzia "Cabeleireir/a Profissional". E o nome precisa de `font-size`
  próprio: sem ele herdava 16px, maior que o card antigo (14.5px), gastando a
  largura que já era pouca.
- **O corpo da gaveta é FLEX em coluna, nunca grid.** `.cfg-section` tem
  `overflow: hidden`, então o tamanho mínimo automático dela vira zero e num
  grid de altura definida a linha encolhe — foi assim que a lista de destinos
  saiu cortada. Cada filho leva `flex: 0 0 auto`: o que não cabe rola.
- **"Excluir grupo" não fica ao lado de "Salvar" no celular.** O rodapé empilha
  com `column-reverse`, que inverte só a pintura — a ordem do DOM (e do leitor
  de tela) continua Excluir → Salvar.
- **Uma rolagem só.** A lista do modal "Adicionar" perde o teto de 240px no
  celular: duas rolagens encaixadas fazem a de dentro roubar o gesto da de fora.
  No computador o teto continua valendo.
- **`<div>` não vale dentro de `<button>`.** A linha de fluxo do card é `<span>`
  com `display:block` pelo CSS.

⚠️ **Medir, não deduzir.** A tela toda cabe num arquivo HTML com o `painel.css`
de verdade, e o Chromium do ambiente tira a foto em 375px
(`headless_shell --window-size=375,1500 --force-device-scale-factor=2
--screenshot`). Foi isso que separou defeito real de artefato do teste — o
recuo de 40px do `<ul>` parecia bug e era só o reset do Tailwind faltando no
harness.

### Segunda rodada de celular: sobreposição, "Salvar" mudo, uma aba a menos

Quatro relatos da cliente no mesmo print (2026-09-19, noite). **Não regredir:**

- **A gaveta é coluna flex com as pontas travadas e o meio rolando.** O corpo é
  `flex: 1` e, com `min-height: auto`, ele se recusa a ficar menor que o
  conteúdo, empurra os irmãos — que encolhem, porque `flex-shrink` nasce 1 — e
  o cabeçalho acaba escrito por cima do texto da primeira seção. A cura são
  `flex-shrink: 0` em cabeçalho/abas/rodapé **e** `min-height: 0` no corpo.
  Reproduzido em 375×667 impedindo o corpo de rolar: sem as duas regras o texto
  sobe de y132 para y91, dentro das abas.
- **`position: sticky` saiu do cabeçalho.** Ele vive FORA do que rola (o corpo é
  que tem `overflow-y: auto`), então nunca grudou em nada — e era o único
  elemento posicionado ali, o que deixava o empilhamento com surpresa.
- **Botão desligado precisa ter cara de desligado.** `.pnl-btn` não tinha
  `:disabled`, então o "Salvar" da gaveta ficava idêntico a um botão ativo: a
  cliente clicava e não acontecia nada, sem nenhum sinal do porquê.
- **O "Salvar" do rodapé é o "pronto" da gaveta: salva o que está pendente e
  FECHA.** Os outros campos do painel já gravam sozinhos (modo da imagem,
  boas-vindas ao sair do campo, botão do canal), então com nada pendente ele era
  um botão desligado no lugar mais óbvio da tela. Só continua aberto quando o
  salvamento **falha** — fechar por cima do erro esconderia que nada foi
  gravado; por isso `saveTargets` e `saveWatermarkText` devolvem `true`/`false`.
- **A aba "Anti-ban" do destino saiu** (pedido da dona do produto). Para um
  GRUPO ela era uma frase e um link para outra tela — aba que não configura nada
  é só mais um lugar para procurar. A **saúde do CANAL**, que é configuração de
  verdade, foi para a aba "Mensagens", junto do resto que só existe em canal.
  `drawerTabSafe` cai na primeira aba quando a guardada não existe mais, senão o
  painel abriria em branco.
- **No celular o seletor Origens|Destinos ocupa a largura toda**, metade para
  cada lado, com alvo de toque de 44px. Como régua `inline-flex` encostada à
  esquerda ele parecia enfeite, e é a navegação entre as duas listas.
- **Janela alta no celular usa `dvh`, nunca só `vh`.** `100vh` e o `inset: 0`
  de um elemento fixo **não** descontam a barra de endereço nem a barra de
  baixo do navegador: a janela nasce por baixo delas e o topo fica ilegível
  (relato com a lista de grupos do WhatsApp). A linha em `vh` fica antes, como
  plano B — ⚠️ **corrigido em 2026-09-20:** medido no CSS gerado pelo build, o
  minificador DESCARTA a linha em `vh` quando todos os navegadores-alvo
  entendem `dvh`. O plano B é intenção de código, não proteção em produção:
  quem sustenta a altura no celular é o `dvh` sozinho.
- **A janela "Adicionar" é folha com cabeçalho preso e corpo rolando**, mesma
  receita da gaveta. Com a lista de grupos inteira ali dentro era o modal todo
  que rolava, e o título e o "fechar" saíam da tela. Medido em 375px com 10
  grupos: depois de rolar 662px o cabeçalho continua em y12.

### Janela abrindo ATRÁS de outra janela (RCA 2026-09-20 — não regredir)

Relato da cliente: *"quando clico em adicionar canal a janela de canal abre
atrás da outra e não consigo vê-la."*

**Causa: duas escalas de sobreposição que não se conheciam.** O painel tem a
sua em `painel.css` (gaveta **90**, janela "Adicionar" **80**), e os diálogos
compartilhados (`ConfirmDialog`, `AddChannelModal`, `SelectChannelModal`)
nasciam com o `z-50` do Tailwind — ou seja, **abaixo das duas camadas que os
abrem**. Reproduzido em navegador a 375×667 com o CSS real: o elemento no
centro da tela era o véu da janela "Adicionar grupo", não a janela do canal.
Pior que ficar atrás: o véu escurece o que está embaixo **e** recebe o toque,
então tocar na janela do canal fechava a outra.

⚠️ **Eram TRÊS portas, não uma.** Além de "Adicionar canal", saem de dentro de
camadas do painel: **"Escolher canal do botão"** (`SelectChannelModal`, aberto
de dentro da gaveta, z 90) e os avisos **"Descartar alterações?"** e **"Remover
grupo?"** (`ConfirmDialog`, idem) — os três abriam atrás.

| Peça | Onde |
|---|---|
| Camada canônica dos diálogos | `.ui-dialog-layer` em `dashboard/app/globals.css` |
| Folha com cabeçalho preso | `.ui-dialog-sheet`, idem |

**Não regredir:**

- **Um diálogo que NASCE de dentro de outra camada precisa ficar ACIMA dela.**
  Os três são diálogos-folha (nada abre por cima deles), então moram no topo da
  pilha: **95**, acima da gaveta (90) e da janela (80).
- **O aviso passageiro (`ToastProvider`, 100) continua acima do diálogo**, de
  propósito — confirmação que o diálogo esconde é confirmação que ninguém vê.
- **A camada mora em UM lugar**, nunca em utility por componente. Número
  espalhado por arquivo é exatamente como as duas escalas passaram a discordar.
  Teste falha se um `z-\d` voltar ao véu de qualquer um dos três.
- **A regra fica FORA de `@layer`**, então vence qualquer utility do Tailwind de
  mesma especificidade independente da ordem do arquivo.
- **Altura da folha não pode ser utility do Tailwind.** Duas utilities para a
  MESMA propriedade não garantem qual vence (quem decide é a ordem do CSS
  gerado, não a do `className`) — então o par `vh`/`dvh` mora no CSS.
- **A janela do canal virou folha** (cabeçalho preso, corpo rolando), como a de
  "Adicionar grupo". Medido a 375px com a lista cheia: na forma antiga, depois
  de rolar 928px o título e o **×** ficavam **857px acima do topo da tela**; na
  forma nova o título fica em y28, visível.
- **Uma rolagem só no celular** na lista de "Canais que sigo": o teto de 256px
  fazia a rolagem de dentro roubar o gesto da de fora. No computador o teto
  continua valendo.

Teste: `test/janela-atras-de-janela.test.js` (lê os z-index do CSS de verdade,
então bumpar a gaveta acima de 95 no futuro reprova).

Testes: `test/painel-espelhamento-cartoes.test.js`,
`test/painel-espelhamento-assistente.test.js`,
`test/painel-destinos-editor.test.js`, `test/painel-marca-dagua-salvar.test.js`,
`test/image-mode-policy.test.js`,
`test/painel-modelo-herdado-e-texto-adicional.test.js`.

## Texto adicional no fim da mensagem espelhada (`relayFooterText`, 2026-09-13)

Campo por grupo monitorado ("Adicionar texto ao final da mensagem"), anexado
depois do texto convertido, com dois saltos de linha. `src/core/relayFooter.js`
(puro), aplicado em `src/bot-worker.js`.

**Não regredir:**

- **Pertence EXCLUSIVAMENTE ao formato "Manter texto original convertido".**
  Com modelo ativo, o modelo controla o texto inteiro e o complemento é
  descartado.
- **Por isso a tela precisa saber qual é o modelo EFETIVO** (RCA 2026-09-16,
  abaixo) — oferecer o campo onde ele não vale é prometer algo que o robô joga
  fora, em silêncio.
- É texto da cliente: não passa por conversão de link nem por palavra
  bloqueada. Teto de 1.000 caracteres (`RELAY_FOOTER_MAX_CHARS`) — com foto, ele
  entra na legenda e soma com o texto da origem.

### "Escrevi o texto adicional e não sai nada" (RCA 2026-09-16 — não regredir)

`Group.templateKey` tem TRÊS estados e a tela só enxergava dois:

| Valor | O que o robô faz |
|---|---|
| `null` | **herda** `BotConfig.mirrorTemplateKeyDefault` (modelo padrão global) |
| `''` | manter texto original, explícito |
| chave | modelo fixo do grupo |

A tela lia `null` e `''` como a mesma coisa. Quem tinha modelo padrão global e
um grupo nunca tocado via "Manter texto original convertido" selecionado E o
campo de texto adicional oferecido — enquanto o robô aplicava o modelo e
ignorava o complemento. Ela escrevia, salvava, lia "Texto salvo", e a oferta
saía sem nada. Hoje a tela carrega o padrão global e mostra o modelo que de
fato vale. Teste: `test/painel-modelo-herdado-e-texto-adicional.test.js`.

## Sites que recusam a leitura do nosso servidor (2026-09-16 — não regredir)

O desembrulho de link de domínio próprio tem, além da lista de hosts que nunca
são oferta (rede social, convite de grupo), uma lista de **sites de oferta que
bloqueiam o nosso IP**: `BLOCKS_OUR_SERVER_HOST_RE` em
`src/core/customDomainLinkResolver.js`.

Medido em 72h de produção: `pechin.co` respondeu por **98 das 105** recusas
`recusado_http_403`. Ele redireciona 301 para `pechinchou.com.br/oferta/<id>`,
que está atrás de Cloudflare e devolve 403 para o nosso servidor em TODOS os
cabeçalhos testados (navegador, celular, WhatsApp, `facebookexternalhit`) — a
recusa é por endereço de servidor, e nenhum cabeçalho a contorna.

**Não perde oferta nenhuma**: essas mensagens já não eram espelhadas (sem o
desembrulho não existe link de loja para converter). O que muda é parar de
bater num "não" garantido — economia de rede e, principalmente, de reputação do
nosso IP, que é compartilhada com a busca de foto nas lojas.

⚠️ **Critério para entrar na lista: bloqueio MEDIDO e reprodutível, nunca
suspeita.** O teste é bater direto na página final com quatro cabeçalhos
diferentes; só entra se os quatro derem 403. Se o bloqueio cair, remover a
linha. Anti-teste junto: a lista é ancorada, `pechinchou.net` e `pechin.com.br`
continuam passando.

⚠️ **Não confundir com `pagina_sem_link_de_loja`** (~45 casos, em
`go.promozone.ai`, `clubedoachadinho.com.br`, `grupos.garimpeiros.com.br`):
ali a página abre normalmente e o link da loja só aparece depois que o
JavaScript roda. Ler isso exigiria navegador de verdade (Playwright) — processo
novo e memória, regra #1 da política de memória. **Não atacado de propósito.**

E não repetir tentativa de erro definitivo: `isRetryableCustomDomainFailure` só
repete `tempo_esgotado` e `erro_de_rede:` — 403, 404 e `pagina_sem_link_de_loja`
saem na primeira. Ao ler o log, lembre que o motivo aparece DUAS vezes por
falha (uma no resumo, uma dentro da tentativa): contar `"reason"` cru dá o dobro
do número de falhas reais.

## "Espelhamento não funciona, só o Criar oferta" — era a TELA assustando (RCA 2026-09-24)

Conta (PRO) com só Shopee e Mercado Livre cadastrados; os 2 grupos monitorados
com `allowedPlatforms=shopee,mercadolivre` (escolha dela, bate com o cadastro).
24 h medidas no banco: **169 espelhadas com sucesso**, 112
`skip:no_valid_conversions:store_disabled` (109 Amazon, 2 SHEIN, 1 Magalu), 78
`error:worker_restart:requeued`, 56 `skip:queue_expired`, 16 `Bot não conectado`.
O robô funcionava; a aba Envios mostrava ~190 linhas VERMELHAS:

1. `store_disabled` dizia "Seu cadastro está certo… ligue essa loja" — sem
   cadastro nenhum de Amazon. Novo motivo `store_not_used` (loja desligada no
   grupo **e** sem cadastro): etiqueta cinza "loja que você não usa", texto
   sem "cadastro certo", precedência mais baixa. `store_disabled` ficou só para
   loja cadastrada. Decisão no `bot-worker.js` (ramo "Plataforma desabilitada").
2. `error:worker_restart:requeued` é a linha ORIGINAL de uma oferta que o
   `reprocessRestartFailures` já recolocou na fila (linha nova). Aparecia como
   "falhou"; agora etiqueta "reenviada" (`statusTagForLog` em `logsCopy.js`).
3. `diag-envios-vazios.mjs` contava o `bot.log` da FROTA inteira em prod e
   acusava "todas as mensagens vieram de chats não monitorados". Agora filtra
   pelo `pid` do robô da conta (`BOT_USER_ID` em `/proc/<pid>/environ`) e
   imprime o resumo **por motivo** da janela toda (antes só 15 linhas).

Não regredir: não pintar de vermelho o que é escolha da cliente; não afirmar
"cadastro certo" sem olhar o cadastro. Teste: `test/loja-nao-usada-e-reenviada.test.js`.
Perdas reais restantes (reinício em massa + fila > 5 h) são de sessão/fila —
ver `envio-e-filas.md` e `memoria-e-capacidade.md`.

### Adendo (2026-09-24, mesma investigação): o relato do cliente estava CERTO

O texto acima foi escrito antes de olhar hora a hora. Somando 24h parecia que
"o robô funcionava"; hora a hora, **das 21h BRT de 23/09 até 13:40 BRT de
24/09 nenhuma oferta espelhada saiu** — e o "Criar oferta" seguia, porque ele
só envia (não depende de receber mensagem nem da fila do espelhamento). Três
causas somadas, nenhuma exclusiva da conta:

| # | Causa | Onde está tratada |
|---|---|---|
| 1 | Horário de envio 8h–22h no modelo padrão + limite de espera de 5h: a oferta da noite esperava até as 8h e era descartada por idade (547 descartes em 23/09, 855 em 24/09; 45 de 48 modelos padrão da frota) | `envio-e-filas.md`, "Horário de envio × limite de espera" (descarte na hora com motivo próprio + aviso na tela) |
| 2 | Portão de entrada de 5 min (`incomingFreshness.js`) descartando mensagem que o WhatsApp entregou 27–58 min depois de uma queda (196 descartes de 10–60 min na frota, 47 robôs) | adendo da seção "Mensagem espelhada N vezes" acima, quando fechado |
| 3 | Quedas 500 crônicas (~600/dia há ≥10 dias, 85% com `stuckMsg:true`, 60 ids diferentes — a quarentena, que exige o mesmo id 2×, nunca dispara) | `whatsapp-sessao.md` — causa de fundo em investigação, não trocar biblioteca por palpite |

O 408 em massa de 24/09 (1.019 quedas, 10h–12h UTC) foi bloqueio da VPS e
zerou sozinho; memória (swap 0) e a mudança jemalloc/semi-space de 22/09 foram
descartadas com dado.

**Erros de método desta investigação (não repetir):** afirmar "está
espelhando" somando 24h sem olhar hora a hora; consultar a preservação só pelo
modelo atribuído ao grupo em vez da ordem real (override do grupo → modelo
atribuído → **modelo padrão da conta** → padrão do sistema); filtro de data em
SQL comparando `sentAt` inteiro com texto (devolve vazio e parece ausência de
dado — usar `CASE typeof(x) WHEN 'integer' THEN datetime(x/1000,'unixepoch') ELSE x END`).
