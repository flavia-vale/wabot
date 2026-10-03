# Revisão crítica da integração Rakuten — 2026-10-03

> Escopo: tudo o que está no `develop` em 2026-10-03 — ofertas automáticas
> (V1) e conversão de links (V2, `afa37fe3`). Leitura de código + testes que
> reproduzem + medições na API real (conta SID 4640819).
> Regras da integração: `docs/rca/afiliados-rakuten.md`.
> **Restrição da dona do produto: nada pode impactar o que funciona hoje.**
> Shopee e Awin não mudam neste plano. A única exceção é o item A1, que é
> opcional e fica num PR separado.

Legenda: 🔴 trava, apaga ou para algo · 🟠 prejuízo ou envio errado · 🟡 desperdício ou risco baixo · 🟢 decisão de produto.
Evidência: **R** = reproduzido com teste · **M** = medido na API real · **C** = lido no código.

## 1. O que foi conferido e está OK

| Ponto | Evidência |
|---|---|
| Pedir token novo **não** derruba o anterior (staging e produção podem usar a mesma conta ao mesmo tempo) | M |
| Deep link: o `id` dos links do feed **é o mesmo** da API oficial `POST /v1/links/deep_links`, no mesmo formato que montamos (`deeplink?id=&mid=&murl=`). A hipótese (b) do RCA está confirmada | M |
| Formato do Link Locator (`<ns1:return>`, `<ns1:mid>`, `<ns1:name>`) bate com o leitor. A hipótese (a) do RCA está confirmada | M (2026-09-30) |
| Todo envio de oferta passa por `buildMonitoredMessagePayload`, inclusive o texto de reserva quando a foto falha → link Rakuten sai com `linkPreview: null` e o servidor não abre o link | C |
| O detector de "1º link da prévia" é **idêntico** ao `URL_REGEX` do Baileys instalado | C |
| Robô: nenhuma exceção sem tratamento na conversão. Carga de contexto com `try`, conversor só lança `stripFromMessage` e o matcher é puro | C |
| Cron de ofertas: o caminho Rakuten **não chama a Rakuten** (só lê o banco). Uma Rakuten lenta não atrasa as automações da Shopee e da Awin | C |
| Uma única API por ambiente (`instances: 1`), sem sync duplicado no mesmo banco | C |
| SQLite em WAL com `busy_timeout = 5000` | C |

## 2. Achados

### 🔴 R1 — Sync da Rakuten pode ficar parada para sempre (R)
- **O quê:** o tempo-limite (`AbortController`) é desligado **antes** de ler o corpo da resposta (`client.js`, `send()` limpa o timer no `finally`; depois vem `response.text()`). Se a Rakuten mandar o cabeçalho e travar o corpo, a chamada nunca termina.
- **Reproduzido:** servidor falso que trava o corpo → com tempo-limite de 0,5 s, a chamada seguia esperando depois de 4 s.
- **Efeito em cascata:**
  - `ticking = true` fica preso, e o agendador para de sincronizar **todas** as contas Rakuten até reiniciar a API;
  - `runningAccounts` segura a conta, e "Atualizar agora" passa a responder sempre "já está sendo atualizada";
  - a rota manual fica pendurada.
- **Não afeta:** robô, fila de envio, Shopee e Awin (o agendador é separado).
- **Mesmo padrão na Awin:** `awin/client.js` → item A1.

### 🔴 R2 — Um único 401 desliga a conta e a conversão de links da cliente (R)
- **O quê:** qualquer 401/403, inclusive num pedido de dados depois de um token recém-emitido (um soluço da Rakuten), vira `RakutenAuthError`. A conta fica `invalid_credential` e `nextSyncAt = null`, e **nunca mais sincroniza** sozinha.
- **Pior:** `loadRakutenConversionContext` ignora contas `invalid_credential`. A **conversão de links para** e os links das lojas Rakuten passam a ser apagados das ofertas espelhadas. Uma oferta que só tinha link Rakuten não sai. O deep link não precisa de credencial nenhuma: o `linkId` e as lojas guardadas continuam válidos.
- **Reproduzido:** um 401 no feed → conta `invalid_credential`, próxima atualização `null`, conversão desligada.
- **Caso real previsto:** trocar o Client Secret na Rakuten (recomendado nesta conversa) sem atualizar no painel dispara exatamente isso.

### 🔴 R3 — Feed vazio uma vez faz todas as promoções vencerem (R)
- **O quê:** uma leitura "completa" que volta com 0 itens (um soluço da Rakuten com `TotalMatches 0`) vence **todas** as promoções por ausência.
- **Reproduzido:** 4 ativas → feed vazio 1 vez → 0 ativas.
- **Efeito:**
  - automações ficam em "nenhuma promoção" por 1 h;
  - na fila de revisão, itens aprovados viram `expired` **para sempre**: `reviewDeliveryService` vê a promoção vencida e descarta;
  - "ofertas sumindo".
- **Mesmo padrão na Awin** (não mexer agora).

### 🔴 R4 — Lista de lojas vazia uma vez desliga a conversão (R)
- **O quê:** se o Link Locator responder a lista **vazia** (resposta válida, sem `<return>`), `syncProgrammes` apaga **todas** as lojas aprovadas.
- **Reproduzido:** 1 loja → lista vazia 1 vez → 0 lojas, contexto de conversão `null`.
- **Efeito:** por até 1 h, os links das lojas Rakuten são apagados das ofertas espelhadas, e ofertas que só tinham esse link não saem.

### 🟠 R5 — Link Rakuten de concorrente sem `https://` vai para o grupo (C)
- **O quê:** a rede de segurança final (`findUnconvertedStoreLinks`, `src/core/mirrorLinkGuard.js`) pega `tidd.ly`/`awin1.com` sem `https://` (correção F3 da Awin), mas **não** pega `click.linksynergy.com/...`.
- **Efeito:** o WhatsApp torna clicável e a comissão vai para o dono do link. Vale para **toda** cliente, com ou sem Rakuten.

### 🟠 R6 — Link de outra pessoa com loja aprovada e página de OUTRA loja sai quebrado (R)
- **Exemplo:** `deeplink?id=OUTRO&mid=43984(Netshoes)&murl=amazon.com.br/...` vira `deeplink?id=MEU&mid=43984&murl=amazon...`.
- **Efeito:** a loja (`mid`) não bate com a página. Provavelmente a Rakuten leva para um erro ou para a página inicial da Netshoes; isso é hipótese, não testamos o clique. Venda perdida, e o link da Amazon (que converteríamos) se perde.

### 🟠 R7 — Automação de promoção sem nada novo roda a cada minuto, para sempre (C)
- **O quê:** pulo (`all_offers_filtered`, `no_rakuten_promotions`) não atualiza `lastSentAt`. O cron roda a automação **todo minuto**, com 1 linha de log e leituras no banco a cada vez.
- **Por que pesa na Rakuten:** a conta medida tem 3 promoções, e as de "validade indeterminada" vão até 2029. Toda automação Rakuten entra nesse estado em minutos e fica nele. O mesmo comportamento já existe para Shopee e Awin; **não mexer neles**.

### 🟠 R8 — Falha de leitura no banco desliga a conversão daquele minuto (C)
- **O quê:** no robô, se `loadRakutenConversionContext` falhar (por exemplo, `SQLITE_BUSY`), a configuração daquele minuto vai **sem** Rakuten e os links dessas lojas são apagados até a próxima carga.
- **Correção:** guardar o último contexto bom no próprio robô (poucos KB).

### 🟡 R9 — Ninguém é avisado quando a conta Rakuten é recusada (C)
- **Efeito:** com R2, a conversão para em silêncio. A cliente só descobre abrindo "Minhas credenciais".

### 🟡 R10 — Resposta sem limite de tamanho (C)
- **O quê:** `response.text()` lê tudo para a memória.
- **Efeito:** uma resposta gigante por defeito da Rakuten ou do proxy derruba a **API** por falta de memória. Chance baixa, impacto alto.

### 🟡 R11 — Até 500 gravações numa única transação do SQLite (C, duração a medir)
- **O quê:** `upsertPage` grava a página inteira numa transação. Robôs que escrevem no mesmo banco esperam (até 5 s).
- **Hoje:** com 3 promoções, irrelevante. Vira risco com feed grande.

### 🟡 R12 — Sync continua para quem não tem mais acesso (C)
- **O quê:** o agendador não olha o plano. Cliente vencida ou cancelada continua gerando chamadas à Rakuten e gravações no banco de hora em hora.

### 🟡 R13 — "Atualizar agora" espera a sync inteira dentro da requisição (C)
- **O quê:** pode passar de 1 minuto (limite de 60 chamadas por minuto, mais as lojas novas). Com R1, fica infinito.

### 🟡 R14 — Cupom some com modelo da Shopee (C)
- **O quê:** o cupom vai em `{descrição}`. O modelo "Automático clássico" não tem essa variável, e a mensagem sai sem o código do cupom.

### 🟡 R15 — Seleção da Rakuten sem as correções F5/F6/F7 da Awin (C)
- **O que falta:**
  - revezamento entre execuções;
  - carga por loja, sem o teto global de 1.000;
  - limpeza dos "já enviados" pelo que ainda está ativo.
- **Hoje:** só pesa quando o feed crescer.

### 🟡 R16 — Logo aceito de qualquer endereço (C)
- **O quê:** `logoUrl` vem da Rakuten e o robô baixa a imagem. Falta restringir a `https` e a hosts públicos (evita o servidor baixar um endereço interno).

### 🟢 R17 — Promoção "indeterminada" sai uma vez e nunca mais (decisão)
- **O quê:** com 3 promoções válidas até 2029, a automação envia 3 vezes e para. Pela regra aprovada isso está certo, mas para a cliente parece "parou".
- **Opção:** reenviar a mesma promoção depois de X dias.

### 🟢 R18 — Conta sem promoção no feed nunca converte (melhoria)
- **O quê:** o `linkId` só sai do feed.
- **Opção:** a API oficial de deep link (medida e funcionando) devolve o mesmo `id` com 1 chamada.

### A1 — (Awin, opcional) R1 também existe em `awin/client.js`
- Correção de 3 linhas. **PR separado**, só depois de a Rakuten validar a mesma mudança em staging.

## 3. Plano de correção

Tudo na Rakuten. Nenhuma linha muda em Shopee/Awin, exceto o A1 (opcional).

### PR 1 — "Rakuten: nada trava, nada some" (API + robô, um só deploy)

| # | Correção | Arquivo | Teste novo |
|---|---|---|---|
| R1 | Tempo-limite cobre o corpo: limpar o timer **depois** de `text()`/`json()`. Prazo total por conta na sync (5 min). Agendador libera `ticking` por prazo | `src/integrations/rakuten/client.js`, `syncService.js`, `scheduler.js` | servidor que trava o corpo → erro em ≤ timeout; sync que estoura o prazo → `failed` e conta liberada |
| R10 | Teto de 10 MB por resposta (cabeçalho `content-length` + contagem na leitura) | `client.js` | resposta de 11 MB → erro, sem ler tudo |
| R2a | Só **`invalid_client` no pedido de token** marca a conta como recusada. 401/403 em pedido de dados depois de token novo → erro passageiro (tenta de novo em 15 min); recusada só com 3 seguidos (contados pelo histórico de execuções, **sem coluna nova**) | `client.js`, `syncService.js` | 1 e 2 erros 401 → `failed` + reagenda; 3 seguidos → `invalid_credential` |
| R2b | Conversão continua com conta recusada por até **7 dias** (o deep link não usa credencial). Depois disso, para | `conversionContext.js` | conta recusada há 1 dia → converte; há 8 dias → não |
| R3 | Vencer por ausência só se a leitura trouxe ≥ 1 item **ou** se a execução completa anterior também veio vazia (2 vazias seguidas) | `syncService.js` | feed vazio 1× → nada vence; 2× → vence |
| R4 | Mesma regra para a lista de lojas: vazia 1× → mantém; 2× seguidas → apaga | `syncService.js` | idem |
| R11 | Gravar em lotes de 100 por transação | `syncService.js` | 500 itens → 5 transações, mesmo resultado |
| R13 | "Atualizar agora" dispara em segundo plano e responde na hora (202). A tela acompanha pelo histórico | `src/api/routes/rakuten.js`, `RakutenCredentialsCard.js` | rota responde < 1 s; 2º clique → 409 |
| R5 | `click.linksynergy.com/...` sem `https://` entra na rede de segurança final (mesma linha da F3 da Awin) | `src/core/mirrorLinkGuard.js` | texto com `click.linksynergy.com/x` solto → bloqueado |
| R6 | Loja achada só pelo `mid`: a página (`murl`) precisa ser de um domínio daquela loja (quando a loja tem domínio). Senão o link é apagado | `src/integrations/rakuten/storeMatcher.js`, `src/converters/rakuten.js` | `mid` Netshoes + `murl` Amazon → apagado; `murl` Netshoes → converte |
| R8 | Robô guarda o último contexto Rakuten bom. Falha de leitura → usa o anterior (até 10 min) | `src/bot-worker.js` (só o bloco da Rakuten em `loadConfig`) | carga que falha → contexto anterior mantido |
| R16 | Logo só `https` e host público | `src/integrations/rakuten/translate.js` | `http://127.0.0.1/x` → descartado |
| R14 | Cupom que não aparece no texto renderizado é acrescentado (igual `ensureRenderedAutomationPrice`), **só para origem `rakuten`** | `src/offerAutomation/dispatcher.js` (ramo Rakuten) | modelo Shopee + cupom → linha do cupom presente |
| R7 | Automação **Rakuten** que pulou por falta de promoção só volta a ser tentada em 15 min (memória do cron, sem coluna nova). Shopee/Awin: **intocados** | `src/offerAutomation/cron.js` (condição `source === 'rakuten'`) | Rakuten pulada → não roda no minuto seguinte; Shopee pulada → roda como hoje |

Garantias de "não mexe no que funciona":
- todos os testes atuais da Shopee, Awin, ofertas automáticas, fila de revisão e `mirrorLinkGuard` rodam **sem mudar nenhum assert**;
- os testes novos ficam em `test/rakuten-*.test.js`;
- R5 é a única mudança que vale para quem **não** usa Rakuten. Ela só bloqueia um texto que hoje sairia com link de concorrente, o mesmo critério já aprovado na F3 da Awin.

**Memória:** nada novo em processo, fila ou Redis. O contexto guardado no robô (R8) ocupa poucos KB por cliente.

**Deploy:** ⚠️ mexe em `src/integrations/rakuten/`, `src/core/` e `bot-worker.js` → **reinicia o `bot-supervisor` e reconecta todas as sessões**. Anunciar antes. Um só deploy para todas as correções.

### PR 2 — melhorias (depois do PR 1 validado)
- R15: levar `rakutenOffers.js` para o núcleo `promotionSelection.js` (F5/F6/F7 da Awin).
- R12: o agendador pula clientes sem acesso nenhum. Precisa de decisão: qual plano mantém a conversão de links.
- R9: aviso para a cliente quando a conta for recusada, pelo canal de aviso de credencial que já existe.
- R18: `linkId` pela API oficial de deep link quando o feed está vazio.
- Ajuste opcional do deploy: listar no `WORKER_CODE_PATHS_RE` só os arquivos que o robô carrega (`storeMatcher.js`, `conversionContext.js`, `accountService.js`, `errors.js`). Assim, mudança só na sync deixa de reiniciar o robô. Precisa do teste `test/deploy-safe-dashboard.test.js` atualizado.

### PR 3 — A1 (Awin, opcional)
- Mesma correção do R1 no `awin/client.js`, só depois do PR 1 rodar uma semana em produção sem erro.

## 4. Decisões que dependem da dona do produto
1. R17: reenviar promoção "indeterminada" depois de quantos dias? (sugestão: 7)
2. R12: cliente sem plano ativo mantém a sync da Rakuten?
3. R9: o aviso de conta recusada vai por e-mail, por WhatsApp ou só no painel?
4. R2b: 7 dias de conversão com conta recusada está bom?

## 5. Ação imediata (sem código)
- **Ao trocar o Client Secret na Rakuten, atualizar no painel na mesma hora.** Até o R2 ser corrigido, a troca desliga a conversão de links dessa cliente.
