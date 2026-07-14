# Phase 0 — Research: Fallback de vitrine do ML não usado

Objetivo: resolver os pontos "NEEDS CLARIFICATION" da spec **com evidência real**
(FR-008), não com suposição. A causa raiz só é declarada após a investigação em
produção. Este documento consolida (a) o que já está confirmado por leitura do
código no repo e (b) os comandos de investigação que DEVEM rodar contra a VPS de
produção, com as hipóteses que cada um confirma/refuta.

## Achados por leitura de código (confirmados no repo, sem prod)

### Decisão: mapear o fluxo real do fallback de vitrine

- **O quê**: `convert()` em `src/converters/mercadolivre.js` (linha ~986) chama
  `resolveToCleanProductUrl(url)`. Sem produto (`cleanTarget` nulo) e não
  `resolveOnly`, cai em `convertMlCouponWithoutProduct(url, creds)` (~919).
- Lá, ao pegar `err.mlFailureType === 'unsupported_url'` (ML recusou createLink),
  chama `buildVitrineFallback(creds)` (~958). Se a usuária tem `vitrineUrl` válida,
  retorna `{ url: vitrineUrl, linkKind: 'coupon', warning: 'ml_vitrine_fallback_used' }`.
- Sem vitrine cadastrada, só afirma "é vitrine, cadastre a sua" quando
  `isDirectVitrineShare(url)` é `true` (link original já era `/social/`); senão,
  descarta em silêncio (recusa ambígua — RCA 2026-07-08).
- **Rationale**: o fallback só dispara no ramo `unsupported_url`. Se a recusa do ML
  no incidente NÃO carregou `mlFailureType='unsupported_url'` (ex.: SSID expirado,
  403, 429), `buildVitrineFallback` nunca é alcançado → oferta descartada por outro
  motivo. Precisa ser confirmado no log.

### Decisão: identificar a origem da mensagem contraditória

- **O quê**: a copy "A oferta saiu usando o link da SUA vitrine…" vem de
  `dashboard/lib/painel/logsCopy.js` (linha ~40-42), acionada pelo prefixo
  `warning:ml_vitrine_fallback_used`.
- Em `src/bot-worker.js` (~2599-2612), quando uma conversão traz
  `warning='ml_vitrine_fallback_used'`, é gravada uma **linha `MessageLog`
  separada** com `destGroup:'warning'` e `errorMsg='warning:ml_vitrine_fallback_used'`
  — uma **notificação**, independente do status do envio real da oferta.
- **Hipótese principal (D — desalinhamento)**: a linha de warning é escrita assim
  que o conversor devolve o fallback, mas o **envio real** ainda pode ser barrado a
  jusante no pipeline (title mismatch, dedup, política de grupo, fila) e gravar uma
  linha `status='skipped'` = "ignorado". Resultado: a cliente vê as duas linhas
  contraditórias (o "na fila" 21:14 + o "ignorado" 21:14 do relato batem com esse
  cenário de duas linhas para a mesma mensagem).
- **Rationale**: essa é a explicação mais consistente com o sintoma exato relatado
  (mensagem "saiu usando sua vitrine" + status "ignorado" no MESMO minuto). Mas
  alternativas (a/b/c) não estão descartadas sem o log.

### Decisão: confirmar onde `vitrineUrl` é persistido e como chega em `creds`

- **O quê**: `vitrineUrl` é lido/validado em `src/credentialHealth.js` (~49-51) a
  partir de `Credential.data` (blob JSON cifrado AES-256-GCM, D-3). `parseCredentialData`
  em `credentialHealth.js` decifra. Precisa confirmar que o caminho que monta as
  `creds` entregues a `convert()` inclui `vitrineUrl` decifrado (hipótese A: "vitrine
  não chega nas creds").
- **Rationale**: se o carregamento de credenciais que alimenta o worker não propaga
  `vitrineUrl`, `buildVitrineFallback` recebe `creds.vitrineUrl` vazio e retorna
  `null` mesmo com vitrine cadastrada no banco → oferta ignorada. Confirmar no banco
  (campo presente e válido) + no caminho de leitura.

## Investigação obrigatória em produção (a executar na VPS — FR-008)

> **Ambiente**: `~/wabot`, banco `prisma/prod.db`, log
> `/home/deploy/BOTinho-shared/logs/bot.log`. Ajustar identificadores conforme o
> caso real. Estes comandos ainda **não** foram executados neste ambiente de plano
> (sandbox sem acesso SSH à VPS); são o roteiro obrigatório do agente com acesso à
> produção antes de escrever qualquer linha de correção.

1. **Registro do evento ignorado (`MessageLog`, 12/07 21:14, canal mercadolivre)** —
   confirma `status`, `errorMsg` (prefixo da taxonomia), `originalUrl`, `convertedUrl`,
   `userId`, `destGroup`; e revela se há **duas** linhas (warning + skipped) para a
   mesma mensagem/minuto (comprova/refuta hipótese D):
   ```bash
   sqlite3 ~/wabot/prisma/prod.db "SELECT id, createdAt, userId, destGroup, status, errorMsg, substr(originalUrl,1,80), substr(convertedUrl,1,80) FROM MessageLog WHERE createdAt >= '2026-07-12 21:10' AND createdAt <= '2026-07-12 21:20' ORDER BY createdAt;"
   ```
   - Interpretação: `errorMsg='warning:ml_vitrine_fallback_used'` numa linha
     `destGroup='warning'` **junto** de outra linha `status='skipped'` (ex.:
     `skip:title_mismatch`, `skip:dedup*`) → hipótese D confirmada. Uma única linha
     `skipped` com motivo de credencial/ambíguo → hipóteses A/B/C.

2. **Credencial ML da usuária — `vitrineUrl` presente e válido?** (`Credential.data`
   cifrado; usar o caminho de leitura da aplicação que decifra, NÃO presumir texto
   puro):
   ```bash
   sqlite3 ~/wabot/prisma/prod.db "SELECT id, userId, provider, length(data) FROM Credential WHERE userId='<USERID>' AND provider LIKE '%mercadolivre%';"
   # Decifrar via script da app (reusa src/credentialCrypto.js + parseCredentialData):
   cd ~/wabot && node -e "import('./src/credentialHealth.js').then(async m => { /* carregar Credential do userId, decifrar, imprimir se data.vitrineUrl existe e passa em isValidMlVitrineUrl */ })"
   ```
   - Confirmar tanto `Credential` quanto `AffiliateProfile` (a spec deixa em aberto o
     modelo real — o código atual lê de `Credential.data`, campo `vitrineUrl`).
   - Interpretação: campo ausente/vazio → hipótese A/B. Campo presente e válido →
     A refutada; foco em C/D.

3. **Linhas de `bot.log` do ramo executado** (recusa do ML, createLink, fallback,
   isDirectVitrineShare):
   ```bash
   grep -niE "vitrine|createLink|error_code|mlFailureType|unsupported_url|usando vitrine cadastrada|descartando|recusa ambígua" /home/deploy/BOTinho-shared/logs/bot.log | grep -i "2026-07-12 21:1" | tail -80
   ```
   - Interpretação: presença de `usando vitrine cadastrada da própria afiliada` →
     fallback FOI acionado (então o "ignorado" é a jusante = D). Presença de
     `recusa ambígua … descartando` → C. `unsupported_url` ausente → recusa foi
     outra (SSID/403/429), fallback nunca alcançado.

4. **Caminho de leitura das `creds`** — confirmar (por leitura de código no clone de
   prod, casada com o achado #2) se o objeto `creds` passado a `convert()` inclui
   `vitrineUrl` decifrado. Mapear a função que monta `creds` no worker.

## Decisão de causa raiz (CONFIRMADA em produção, 2026-07-13)

**Hipótese D confirmada — com uma precisão importante em relação ao enunciado
original.** Evidência coletada via `sqlite3 ~/wabot/prisma/prod.db` na VPS de
produção, para `userId='cmouds6zi000013s5z1p3bbkh'` (cliente do relato), link
original `https://www.mercadolivre.com.br/social/gatuna/lists`:

```
sqlite3 ~/wabot/prisma/prod.db "SELECT id, sentAt, destGroup, status, errorMsg, dedupHits, substr(originalUrl,1,90), substr(convertedUrl,1,90) FROM MessageLog WHERE userId='cmouds6zi000013s5z1p3bbkh' AND (originalUrl LIKE '%gatuna%' OR convertedUrl LIKE '%1Psi79H%' OR convertedUrl LIKE '%sec/%') ORDER BY sentAt;"
```

Trecho relevante da saída (12/07/2026):
```
cmrih07vr075lcoq6em1ggzqs|1783901688039|warning|skipped|warning:ml_vitrine_fallback_used|0|https://www.mercadolivre.com.br/social/gatuna/lists|
cmrih08ea075tcoq63kmy90ag|1783902529040|120363409241456540@g.us|success||0|https://www.mercadolivre.com.br/social/gatuna/lists|https://mercadolivre.com/sec/1Psi79H
```

1. **A oferta FOI ENTREGUE COM SUCESSO usando a vitrine cadastrada.** A segunda
   linha acima (`sentAt=1783902529040` → 2026-07-12 21:28:49 BRT), ~14 minutos
   depois do processamento inicial, tem `destGroup` real
   (`120363409241456540@g.us`), `status='success'` e `convertedUrl` = a vitrine
   cadastrada da própria cliente. O atraso de ~14min é consistente com o
   "Preservação por destino" (rate-limit de envio por janela) já existente no
   pipeline — não é bug.

2. **`vitrineUrl` presente e válida na credencial** (refuta Hipóteses A/B):
   ```
   Credential.data decifrado (via parseCredentialData, src/credentialHealth.js)
   → vitrineUrl: 'https://mercadolivre.com/sec/1Psi79H'
   ```

3. **A linha que a cliente viu como "ignorado" (primeira linha acima,
   `sentAt=1783901688039` → 21:14:48 BRT, mesmo minuto do relato) é uma segunda
   linha `MessageLog`, puramente informativa**, escrita pelo bloco de `warning`
   do `bot-worker.js` (linhas 2599-2617): `destGroup='warning'` (marcador
   sintético, não é destino real), `status='skipped'` **hardcoded para
   QUALQUER warning** (linha 2611), `convertedUrl=''` (nunca carrega o link
   realmente enviado).

**Causa raiz precisa**: não há desalinhamento entre decisão e envio — ambos
corretos, a oferta saiu. O bug é que a linha de **notificação/aviso** (mecanismo
compartilhado por TODOS os `warning:*`: `ml_ssid_expired`,
`amazon_cookies_expired`, `ml_affiliate_forbidden`, `ml_affiliate_rate_limited`,
`ml_affiliate_busy`, `ml_vitrine_fallback_used`) é gravada com `status:
'skipped'` hardcoded, e o painel (`dashboard/lib/painel/logsCopy.js`,
`STATUS_TAG.skipped = { label: 'ignorado' }`) renderiza QUALQUER linha com esse
status com o badge "Ignorado" — inclusive essa linha de aviso, que não é uma
decisão de descarte de oferta. Resultado visível: duas linhas próximas no
painel, uma com o texto (corretamente) dizendo "a oferta saiu usando sua
vitrine" e essa MESMA linha com o badge "Ignorado" ao lado — contraditório,
mesmo a oferta real tendo sido entregue com sucesso (em outra linha, ~14min
depois).

**Hipóteses A/B/C: refutadas.** Vitrine presente e válida (refuta A/B); a
recusa foi de fato `unsupported_url` de uma vitrine direta
(`/social/gatuna/lists` é `isDirectVitrineShare`) — o fallback FOI corretamente
acionado e a substituição ficou restrita a vitrine de verdade, exatamente como
deveria (nenhuma regressão do RCA 2026-07-08, nenhum falso positivo em link de
produto). Hipótese C (recusa ambígua descartada por design) não se aplica a
este incidente.

**Correção**: as linhas de notificação (`destGroup='warning'`) precisam de
status distinto de um skip real — nunca devem herdar o badge "Ignorado".
- `src/bot-worker.js` (~2599-2617): a linha de aviso não deve ser
  contada/exibida como "ignorado". Introduzir um status não-skip dedicado a
  notificações (ex.: `status: 'info'`) para essas linhas, preservando
  `errorMsg='warning:<kind>'` para a taxonomia existente.
- UI (`dashboard/lib/painel/logsCopy.js` `STATUS_TAG`/`STATUS_TABS`,
  `dashboard/app/painel/envios/SendHistory.js`, `dashboard/lib/mobileLogs.js`,
  endpoint `/api/logs/summary`) precisa reconhecer o novo status sem inflar a
  contagem de "Ignorados" reais nem quebrar os filtros existentes.
- **Não** é necessário mudar a lógica de decisão de conversão/fallback em
  `src/converters/mercadolivre.js` — ela já está correta. T019 de `tasks.md`
  permanece como guarda de regressão (confirma que nada mudou ali), não como
  fix.

### Correções condicionais por hipótese (histórico da investigação — mantido para rastreabilidade, não é mais o plano de ação)

- **A/B (vitrine não chega / reprovada)**: garantir propagação de `vitrineUrl`
  decifrado até `creds` de `convert()`, e/ou revisar `isValidMlVitrineUrl`. Risco:
  baixo; não toca caminho de produto.
- **C (recusa ambígua descartada)**: comportamento **correto por design** (RCA
  2026-07-08 — não regredir). Se a causa for C, o fix é de **copy/UX** (mensagem
  orientando cadastrar/checar vitrine), não forçar o fallback num link ambíguo.
- **D (desacoplamento warning×status)**: alinhar a escrita da linha de warning ao
  desfecho real — só emitir a copy "saiu usando sua vitrine" quando o envio da
  oferta com o link de vitrine efetivamente ocorreu (status success), e nunca em
  paralelo a um `skipped`. Preferir mover a emissão do warning para depois da
  confirmação de envio, ou suprimir a copy de sucesso quando a mesma mensagem
  resultou em skip.

**Rejeitado**: forçar o fallback de vitrine para qualquer recusa do ML (incluindo
ambígua) — reintroduz a regressão do RCA 2026-07-08 (produto legítimo de loja
oficial diagnosticado como "vitrine de terceiro"). Viola FR-002/FR-006.
