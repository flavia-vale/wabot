# credenciais-e-seguranca — regras e RCAs

> Movido do `AGENTS.md` em 2026-09-23 para economizar tokens. Conteúdo sem alteração.
> Leia este arquivo ANTES de mexer no assunto. Referências a "AGENTS.md" em
> comentários de código/testes apontam para as seções abaixo.

## D-3 — Criptografia de credenciais em repouso (canônico)

As credenciais de afiliado (cookie de sessão ML/Amazon, tokens OAuth, secret da
Shopee) ficam no campo `Credential.data` (SQLite). Antes ficavam em **texto
puro**; hoje são cifradas com **AES-256-GCM** na camada de aplicação
(`src/credentialCrypto.js`).

**Formato armazenado** (texto puro, compatível com campo `String` do Prisma, sem
migration de schema): `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`. O prefixo
`v1` permite rotação futura de chave/algoritmo.

**Chave:** env `CREDENTIAL_ENCRYPTION_KEY` = 64 chars hex (32 bytes). **Diferente
por ambiente** (NÃO reaproveitar staging em prod). `validateEncryptionKey()` no
boot (`src/api/server.js`) mata o processo se ausente/malformada.

**Migração graciosa (não regredir):**
- `decryptCredential` devolve a string original quando ela **não** tem prefixo
  `v1:` — leituras de dados legados em texto puro continuam funcionando antes/
  durante a migração.
- Sem a env configurada (dev/test), encrypt/decrypt viram **no-ops** — mantém os
  testes db-free. A exigência de chave é só no boot da API.
- `encryptCredential` é **idempotente**: não recifra valor já cifrado.

**Pontos acoplados (todos precisam decifrar/cifrar):**
- Leitura: `parseCredentialData` em `src/credentialHealth.js` (cobre painel,
  `offerEngine`, `offerAutomation` automaticamente).
- Leitura direta (único bypass): `src/bot-worker.js` (~linha 353) — decifra antes
  do `JSON.parse`. Por isso o worker tem `import 'dotenv/config'` no topo (precisa
  da env).
- Escrita: `src/api/routes/credentials.js` (PUT) e `src/api/routes/mlOAuth.js`
  (merge OAuth).
- **Chave PIX de afiliado (`AffiliateProfile.pixKey`)** também é cifrada com o
  MESMO esquema (pode ser CPF/telefone/e-mail). Escrita: `applyAffiliate` em
  `src/domain/affiliate/service.js` e `PUT /affiliate/me` em
  `src/api/routes/affiliate.js` chamam `encryptCredential`. Leitura: as rotas
  admin e `getAffiliateMeData` decifram via `presentAffiliateProfile` /
  `decryptCredential`; o antifraude (`pixMatchesReferredUser`) decifra antes de
  comparar. Migração das linhas existentes:
  `scripts/migrate-affiliate-pixkey-encrypt.mjs` (idempotente, mesmas precauções
  de parar API + backup).

**Migração das linhas existentes:** `scripts/migrate-credentials-encrypt.mjs`
(idempotente). **Parar a API antes** (`pm2 stop api`) para evitar SQLITE_BUSY
(pegadinha #8), rodar, religar. Em prod, rodar `scripts/backup_prod.sh` antes.

```bash
# staging
pm2 stop api-staging && cd ~/wabot-staging && node scripts/migrate-credentials-encrypt.mjs && pm2 start ecosystem.config.cjs --only api-staging
# prod (backup antes!)
scripts/backup_prod.sh && pm2 stop api && cd ~/wabot && node scripts/migrate-credentials-encrypt.mjs && pm2 start ecosystem.config.cjs --only api && pm2 save
```

**Rollback:** como `decryptCredential` tolera texto puro, reverter o código
mantém leituras funcionando em ambos os formatos. Testes:
`test/credential-crypto.test.js`.

## Credenciais de afiliado: linguagem e apagamento (canônico)

Cliente reportou desconforto em cadastrar o **SSID do Mercado Livre** ("expõe
muito os dados pessoais de quem utiliza"). Foi implementado um "modo sem
cookie" (guardar só a etiqueta) e **removido a pedido da própria cliente** após
teste: sem o código de acesso o link nunca sai curto, e a expectativa do produto
é "SSID cadastrado → link curto sempre". **Não reintroduzir sem pedido
explícito**: o código de acesso volta a ser obrigatório na validação
(`REQUIRED_FIELDS` + a exigência de portador `ssid`/`cookie` no ML), e o painel
não oferece opção de operar sem ele. Guarda de regressão em
`test/painel-ids-afiliada-privacy.test.js`.

**Resíduo em contas que chegaram a ligar a opção:** os campos de sessão foram
apagados no momento em que o modo foi ligado e **não há como recuperá-los** — a
cliente precisa colar um código novo (o painel já mostra "Falta preencher").
`sanitizeCredentialBody` descarta a flag `cookielessMode` em todo save, para o
resíduo não sobreviver, e `scripts/cleanup-cookieless-flag.mjs` limpa as linhas
antigas (dry-run por padrão, `--apply` para gravar; lista quem precisa
recadastrar). Rodar em staging e em produção (com backup antes) após o deploy.

O que ficou dessa rodada:

- `DELETE /credentials/:platform` — apaga a credencial da loja, invalida o cache
  de sondagem, recarrega a config do worker e é **idempotente** (200 +
  `deleted:false` quando não havia nada). Evento `credential_deleted` na
  allowlist de `src/analytics.js`. Botão "Apagar meus dados" no painel.
- Explicação "o que fazemos com esse código" junto do campo
  (`CookiePrivacyDetails`, renderizada nas lojas cujos campos têm
  `cookieField: true`) e FAQ pública em `/seguranca-credenciais-afiliado`.

### Linguagem para a usuária (obrigatório nesta superfície)

Nome técnico de campo **não pode chegar à tela**. Toda mensagem de credencial
passa por `friendlyFieldName` / `describeMissingCredentials`
(`src/credentialHealth.js`) — consumidas também por `missingCredentialMessage`
(`offerEngine.js`) e pelo `recordConversionIssue` do `bot-worker.js`, para a
cliente ler a MESMA frase em qualquer lugar. Vocabulário canônico: "etiqueta de
afiliada" (nunca "tag"), "código de acesso" (nunca "cookie de sessão"/"SSID"
solto), "link mais comprido" (nunca "?tag=/amzn.to/partner_id"), "venceu" (nunca
"sessão expirada"). `test/painel-linguagem-leiga.test.js` falha se jargão voltar
aos rótulos/dicas/avisos.

Correção de fato importante aplicada junto: o aviso de código vencido do ML
dizia "a geração de ofertas do ML está pausada" — **era falso** (o fallback
segue enviando) e assustava à toa.

**Não regredir:** não voltar a imprimir `missing` cru na tela; não voltar a
dizer que o envio "está pausado" quando o código vence (o fallback continua
enviando). Testes: `test/painel-ids-afiliada-privacy.test.js`,
`test/painel-linguagem-leiga.test.js`.

## A-1 — Proteção contra brute-force no login (canônico)

`src/api/routes/auth.js` rastreia tentativas de login em **dois** mapas
in-memory (funciona sem Redis):
- `loginAttempts` por `(email|ip)` — limite `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
  (default 8) na janela `LOGIN_RATE_LIMIT_WINDOW_MS` (default 15min). Pega força
  bruta de um IP.
- `loginAttemptsByEmail` só por email — limite
  `LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS` (default 20). Pega ataque
  **distribuído** (mesma conta de vários IPs), que o limite por IP e o rate
  limit global do servidor não cobririam.

A tentativa é contada **antes** do lookup do usuário (evita enumeration via
timing de rate limit). Bloqueio retorna 429 + `Retry-After`. Tentativas falhadas
e bloqueios geram eventos `login_failed`/`login_blocked` em `AnalyticsEvent`
(com hash curto do email — `acct` — sem PII em claro). Cleanup periódico via
`startLoginAttemptsCleanup()` (top-level, `unref()`). Testes:
`test/auth-rate-limit.test.js`.

## Clareza da falta de cadastro da loja + vídeo tutorial (2026-09-02)

Quatro buracos da mesma conversa: a cliente não descobria sozinha por que a
oferta não saiu, e o vídeo que explica isso estava colado na mão em três
lugares.

| Peça | Onde |
|---|---|
| Vídeo tutorial (endereço + capítulos por loja) — FONTE ÚNICA | `src/tutorialVideo.js` |
| Texto do bloqueio por falta de cadastro (etiqueta, diálogo, aviso global) | `src/credentialBlockAlert/message.js` |
| Garantias da tela de conexão do WhatsApp | `src/domain/painel/whatsappSafety.js` |
| Aviso de fim de teste com prova de valor | `src/domain/painel/trialNotice.js` |

**Não regredir:**

- **"Ignorado" não é resposta.** A linha do histórico com
  `skip:no_valid_conversions` agora sai com a etiqueta **"faltou cadastrar a
  loja"** (`statusTagForLog`, `dashboard/lib/painel/logsCopy.js`) e um botão de
  ajuda que abre o diálogo com o vídeo já no trecho DAQUELA loja. O motivo real
  vivia atrás de "Ver motivo", que quase ninguém clicava — a cliente mandava
  print escrito "falhou" e o suporte descobria na mão.
- **O diálogo NÃO pode dizer "as ofertas continuam saindo".** Esse texto
  (`buildSessionAlert`) é verdade para ML/Amazon/Magalu quando o código de
  acesso VENCEU — e mentira nesta linha, onde a oferta comprovadamente não foi
  publicada. `buildCredentialBlockHelp` separa os dois; o mesmo conserto foi
  aplicado ao `explainErrorMsg`, que reaproveitava o `body` errado.
- **Sem NENHUMA loja cadastrada, o aviso é global** (`NoCredentialBanner` no
  `PainelShell`, todas as abas): o robô recebe as ofertas e não publica nada,
  o painel fica verde, e a cliente conclui que o produto não funciona.
  `hasAnyCredential === null` (carregando ou falha de rede) **não** mostra
  nada — acusar falta de cadastro por causa de um blip mandaria refazer um
  cadastro que já existe.
- **A tela de conexão diz o que o robô faz com o WhatsApp dela**
  (`WHATSAPP_SAFETY_POINTS`, mesmo texto no e-mail
  `onboarding_conecte_whatsapp`). ⚠️ **É PROIBIDO escrever que "não temos
  acesso às suas mensagens"** — as mensagens dos grupos chegam ao robô, é assim
  que o espelhamento funciona. O que é verdade e tranquiliza: só os grupos
  escolhidos são usados, o resto é descartado na hora e não fica guardado; ele
  não responde ninguém; ela desconecta quando quiser; pode usar outro chip.
  Guarda: `test/painel-whatsapp-seguranca.test.js`.
- **O aviso de fim de teste sempre carrega a PROVA** ("o robô já publicou N
  ofertas"). Com N = 0 ele **muda de assunto**: leva ao checklist, não ao
  pagamento — cobrar de quem nunca viu o produto funcionar é o jeito mais
  rápido de perder a cliente. Não aparece para trial já vencido (quem avisa
  ali é o banner de plano vencido, que tem outra ação).
- **O endereço do vídeo mora em `src/tutorialVideo.js`**, com capítulo por
  loja. Estava colado na mão em `painel/tutorial`, `painel/checklist` e em
  `src/email/layout.js` — três cópias é como um vídeo regravado passa a existir
  só em parte do produto. `layout.js` re-exporta para os consumidores antigos.
  Teste falha se `https://youtu.be/` voltar a aparecer numa tela do painel.

**Custo:** duas chamadas a mais no shell (`/credentials` sempre,
`/logs/summary` só em trial), nenhum processo novo, zero impacto de RAM.
Testes: `test/painel-credencial-clareza.test.js`,
`test/painel-whatsapp-seguranca.test.js`.

## Código de acesso do ML vence em ~75–95 min (investigação 2026-09-29 — EM ABERTO)

Cliente de produção (`cmu4jtqzs00dhan9xwgoh7po2`) relata "toda hora o cookie
do ML expira". Pedido da dona do produto: **não** resolver com "cole de novo".

**FATOS (banco de prod, 21–29/09):** 46% dos envios de ML da conta recusados
(`ml_ssid_expired`); 10 contas com ⚠ em 3 dias (não é só ela). Cada código
colado viveu **76, 94 e ≥75 min** (1º→último `meli.la`), em horários e volumes
diferentes (11, 27 e 89 links). `diag-ml-cookie-poisoning.mjs`: jar e campo
`ssid` iguais (sem envenenamento), sondagem viva, **createLink não devolve
Set-Cookie** (patch vazio). Spec 005 (refresh OAuth + cache da sondagem) está em
`main` desde 13/07 e **não toca o eixo do cookie** — não é a causa.

**Verificado no código (2026-09-29):** o cookie da cliente vai em DUAS rotas ao
ML, sempre do IP do VPS com UA de iPhone: (1) `POST createLink`
(`mercadolivre.js`, guarda rotação de `Set-Cookie`); (2) **`GET` da página do
produto para montar o card** (`fetchHtml` em `productInfoScraper.js`, com
`redirect: 'follow'`) — essa rota **ignora qualquer `Set-Cookie`**. Um jar
colado tem ~3 cookies; um navegador logado manda ~15–25 (aparelho/fingerprint).
`createAffiliateLink` tenta `no-csrf` primeiro e um 401 ali é terminal (não
tenta `with-csrf`) — conferir no `bot.log` em qual `attempt` cai o 401.

**HIPÓTESES (nenhuma confirmada), em ordem de plausibilidade pelos dados:**
- H1/H6 prazo fixo do ML para sessão sem renovação de navegador — encaixa na
  vida quase constante (75–95 min) independente de volume/hora.
- H7 o robô recebe rotação do `ssid` na rota (2) e descarta — corrigível.
- H3 falta de cookies de aparelho no jar → o ML tolera um tempo e derruba.
- H2 uso do ML no navegador da cliente rotaciona/invalida a cópia — daria vidas
  espalhadas, não constantes; testar com as outras 9 contas.
- H4 volume (50–60 chamadas/h) — contradito: 11 links viveram o mesmo que 89.
- H5 código velho no `bot-supervisor` / staging com credencial de prod — não
  explica a vida fixa, mas conferir (`pm2 describe bot-supervisor | grep -E
  'uptime|created'`; `COUNT(*) FROM Credential WHERE platform='mercadolivre'`
  no `staging.db`).

**Diagnósticos (read-only, nunca imprimem código de acesso):**
- `scripts/diag-ml-vida-codigo.mjs [--days=7] [--email=]` — vida de cada
  "geração" do código por conta, por volume. Só banco. **Decide H1/H6 × H2 × H4.**
- `scripts/diag-ml-rotacao-cookie.mjs --email= [--url=<produto>]` — até 3
  requests com a credencial real: quais cookies (só nomes) o ML devolve no
  createLink, na página do gerador de links e na página do produto; formato
  do `ssid` (segmentos com data?). **Decide H7 e alimenta H3.** Rodar em prod
  só com OK.
- `scripts/exp-ml-manter-viva.mjs --email= --modo=so-sondagem|manter-viva`
  — só staging/conta de TESTE (recusa `prod.db`): sonda a cada 5 min e, no
  modo `manter-viva`, faz o GET do gerador de links guardando o `Set-Cookie`
  em memória. Sobreviveu bem além de ~95 min = renovação vem dessa rota.
  Custo: 12–24 requests/h ao ML, zero RAM (processo avulso).
- `bot.log` das recusas agora traz `setCookieNames` (nomes, `(del)` = o ML
  apagou) — vale após `pm2 restart bot-supervisor --update-env` em `remote`.

**Se confirmar renovação por rota (H1/H7):** fazer no robô o que o navegador
faz — um `GET` autenticado periódico (ou aproveitar o GET do card, persistindo
`Set-Cookie` via `buildCredentialPatchFromSetCookie` + `__onCredentialPatch`)
— e persistir. Sinalizar antes (REGRA #1): +1 request/conta a cada N min; RAM
desprezível. Alternativa mais leve: só persistir a rotação que já chega no GET
do card (zero request extra). Não há API oficial de afiliados do ML (confirmado
2026-09-29); OAuth do ML não gera link de afiliado.
