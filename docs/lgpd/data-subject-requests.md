# LGPD — solicitações do titular (processo manual)

Atendimento mínimo viável para o beta B2B: **processo manual operado por admin**.
Endpoints automatizados (self-service no painel) ficam para a Onda 2.

## Ferramenta

`scripts/lgpd_data_request.mjs` — exportação e exclusão (anonimização).

### Exportação (direito de acesso/portabilidade)
```bash
cd ~/wabot && node scripts/lgpd_data_request.mjs export <userId> export-<userId>.json
```
Gera um JSON com os dados pessoais e operacionais do titular. PII sensível é
redigida (hash de senha; credenciais cifradas ficam fora do pacote). Entregar o
arquivo ao titular por canal seguro e apagar a cópia local depois.

### Exclusão (direito de eliminação)
```bash
# 1. backup defensivo (prod)
scripts/backup_prod.sh
# 2. parar a API para evitar SQLITE_BUSY e novos dados durante a operação
pm2 stop api
# 3. anonimizar
node scripts/lgpd_data_request.mjs anonymize <userId> --confirm
# 4. religar
pm2 start ecosystem.config.cjs --only api && pm2 save
# 5. apagar o auth_info da sessão do titular (fora do banco)
rm -rf "$AUTH_INFO_DIR/<userId>"
```

## Por que anonimização in-place (e não hard-delete)

A linha `User` é **anonimizada** (nome, email, telefone, IP, user-agent e hash
de senha removidos; `status='deleted'`), não apagada. Motivo: `Payment` e
`AffiliateCommission` têm FK obrigatória para `User` e precisam ser **retidos por
obrigação fiscal/contábil**. Hard-delete quebraria o ledger financeiro. Após a
anonimização, esses registros deixam de apontar para uma pessoa identificável.

Os dados operacionais que contêm PII de conteúdo são **apagados de fato**:
`MessageLog` (texto das mensagens), `ScheduledMessage`, `Credential`, configs,
grupos, automações, filas, logs de follow, eventos de analytics e a `WaSession`
(lista em `src/domain/lgpd/dataRequest.js → PURGED_MODELS`). O `auth_info` da
sessão vive em disco e é apagado manualmente no passo 5.

## Política de privacidade (coerência)

Os dados tratados e a base de retenção devem estar descritos na política pública
(`dashboard/app/privacidade/page.js`) e nos termos (`src/legalTerms.js`, seção
"Dados, privacidade e segurança"). Pontos que a política precisa refletir:

- **Dados de conta**: nome, email, telefone (verificação/opt-in), senha (hash bcrypt).
- **Dados operacionais**: grupos, configurações, logs de envio (incluindo o texto
  das mensagens enviadas), automações e filas. Retenção de `MessageLog` = 90 dias
  (default, `MESSAGE_LOG_RETENTION_DAYS`).
- **Credenciais de afiliado** (cookie ML, tokens, secret Shopee): cifradas em
  repouso com AES-256-GCM (`src/credentialCrypto.js`).
- **Dados financeiros** (pagamentos, comissões): retidos por obrigação legal
  mesmo após pedido de exclusão (anonimizados quanto ao titular).
- **Sub-operadores**: Mercado Pago (pagamentos), provedor de SMTP (e-mail),
  provedor de VPS, destino de backup externo (cifrado).
- **Direitos do titular**: acesso, portabilidade e eliminação atendidos por este
  processo manual; prazo de resposta e canal de contato
  (`SUPPORT_EMAIL` em `dashboard/lib/marketing-content.js`).

## Resposta a incidente (mínimo)

Em caso de vazamento: conter, avaliar escopo (quais titulares/dados), registrar,
e notificar conforme prazo da ANPD. O backup cifrado (`age`) e a cifragem das
credenciais limitam a exposição de um vazamento do banco/backup.
