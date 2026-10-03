# Contrato — rotas do painel (`src/api/routes/telegramConta.js`)

Prefixo `/api/telegram-conta`. Todas com `app.authenticate`. Todas passam por
`requireTelegramOrigin(user)`: `TELEGRAM_ORIGIN_ENABLED=1` **e** conta na
`TELEGRAM_ORIGIN_ALLOWLIST` (ou `*`) **e** `canUseMultiNetwork` (`src/billing/plans.js:149`,
Premium com acesso em dia). Fora da liberação → 404 (a tela nem mostra a opção — US7.1).
Sem Premium → 403 `FEATURE_REQUIRES_PREMIUM` no padrão existente (`plans.js:247`).

Nenhuma resposta contém sessão, senha, QR em texto, `api_id/api_hash`, telefone ou
id numérico do usuário do Telegram (T-E6). Textos de erro em linguagem leiga (T-E7).

| Rota | Corpo | Resposta | Notas |
|---|---|---|---|
| `GET /` | — | `{ estado: 'nao_conectada'|'conectando'|'conectada'|'desconectada'|'com_problema'|'pausada_plano'|'leitura_parada', nome?, conectadaEm?, ultimaLeitura?, aviso? , consentimentoVersao }` | `leitura_parada` = heartbeat > 3 min |
| `POST /consentimento` | `{ versao }` | `{ ok }` | grava `consentAcceptedAt` + `consentVersion` (FR-003) |
| `POST /conectar` | — | `{ loginId, qrImagem (data:image/png;base64), expiraEm }` | 409 sem consentimento; 409 já conectada |
| `GET /conectar/:loginId` | — | `{ estado: 'aguardando_qr'|'aguardando_senha'|'concluido'|'expirado'|'erro', qrImagem?, dica?, mensagem? }` | tela consulta a cada 2 s |
| `POST /conectar/:loginId/senha` | `{ senha }` | `{ estado }` | corpo **nunca** logado (Fastify `redact`/serializer próprio) |
| `POST /desconectar` | — | `{ ok }` | apaga origens/fila/fotos na hora; revoga via leitor (research R10) |
| `GET /conversas` | — | `{ conversas: [{ id, nome, tipo, jaEhOrigem, jaEhDestino }] }` | `jaEhDestino` = a mesma conversa já é destino pelo robô → a tela bloqueia (FR-023) |
| `POST /origens` | `{ ids: ['tg:-100…'] }` | `{ criadas: [...], recusadas: [{ id, motivo }] }` | limites (FR-013); cria `Group role='monitor' deliveryNetwork='telegram'`; recarrega config do worker (`reloadWorkerConfig`) para a revalidação de destino |
| `DELETE /origens/:groupId` | — | `{ ok }` | |

Configurações de cada origem (destinos, palavras bloqueadas, lojas, modelo, rodapé)
usam as **rotas existentes** de `src/api/routes/groups.js` (FR-024). Mudanças nelas:
`POST /` mantém a recusa de `tg:` digitado (origens do Telegram só entram por `POST /origens`);
a trava "mesmo grupo origem e destino" passa a comparar `canonicalDestinationId`;
`PUT /:id/targets` ganha `detectRoundTrip` com resposta 400
`{ error: 'Isso faria as ofertas irem e voltarem sem parar entre o WhatsApp e o Telegram. …', code: 'CAMINHO_IDA_E_VOLTA' }`.

Rota pública auxiliar: `GET /api/tg-midia/:token` — serve a foto (image/jpeg), 404 se
expirada; sem autenticação (o robô do WhatsApp e o Telegram precisam baixar), token
de 128 bits, sem listagem, `Cache-Control: private, max-age=3600`.
