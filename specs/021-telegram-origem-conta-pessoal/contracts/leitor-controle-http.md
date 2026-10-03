# Contrato — controle local API → `telegram-leitor`

- Escuta **só** em `127.0.0.1:${TELEGRAM_LEITOR_PORT}` (proposto: prod 3021, staging 3024; registrar em `docs/rca/deploy-e-infra.md`).
- Toda requisição exige `x-leitor-token: ${TELEGRAM_LEITOR_INTERNAL_TOKEN}`; sem ele → 401, sem corpo.
- JSON. Respostas **nunca** contêm sessão, senha, token de login cru, `api_hash` ou telefone (T-E6). O QR vai como `qrPayload` (o texto `tg://login?token=…`) **só** para a API, que o transforma em imagem; a API nunca o devolve como texto à tela.
- Timeout do cliente (`src/telegramOrigin/leitorClient.js`): 10 s (QR/senha), 20 s (lista de grupos). Leitor fora do ar → a API devolve à tela um estado leigo ("a leitura do Telegram está parada no momento").

| Método e caminho | Corpo | Resposta 200 | Erros |
|---|---|---|---|
| `POST /login` | `{ userId, accountId }` | `{ loginId, qrPayload, expiresAt }` | 409 `ja_conectada`, 429 `espera` `{ retryAfterSec }` |
| `GET /login/:loginId` | — | `{ state: 'aguardando_qr'|'aguardando_senha'|'concluido'|'expirado'|'erro', qrPayload?, expiresAt?, passwordHint?, displayName?, errorCode? }` | 404 |
| `POST /login/:loginId/senha` | `{ password }` | `{ state }` — senha mantida só em memória até o SRP terminar | 400 `senha_incorreta`, 404 |
| `DELETE /login/:loginId` | — | `{ ok: true }` (cancela; descarta sessão parcial) | — |
| `GET /contas/:accountId/conversas` | — | `{ conversas: [{ id: 'tg:-100…', nome, tipo: 'grupo'|'canal', membros? }] }` — **só** grupos e canais; cache 60 s | 409 `nao_conectada`, 429 `espera` |
| `POST /contas/:accountId/desconectar` | — | `{ ok: true, revogada: boolean }` (`auth.logOut`) | — (falha de rede → `revogada:false`, a API mantém `desiredState='revogar'`) |
| `POST /cutucar` | `{ accountId? }` | `{ ok: true }` — releia `TelegramAccount`/origens agora | — |
| `GET /saude` | — | `{ instanceId, contas: { conectada, com_problema, pausada_plano }, rssMb }` | — |

`errorCode` usa só o vocabulário interno (`revogada`, `restrita`, `banida`, `senha_incorreta`, `qr_expirado`, `ja_usada_em_outra_conta`, `espera`); a tradução para texto leigo mora no painel.

Assíncrono (não passa por aqui): mensagens das origens → `TelegramInboxMessage`; estado das contas → `TelegramAccount`; vida → `TelegramLeitorHeartbeat`.
