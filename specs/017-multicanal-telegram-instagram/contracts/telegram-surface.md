# Contrato: superfície do Telegram (API e painel)

**Feature**: 017

## Rotas novas (API)

| Rota | Faz | Guardas |
|---|---|---|
| `GET /api/delivery-networks` | lista os aplicativos, com disponibilidade e capacidades | direito de plano decide o que aparece habilitado; Instagram sempre `available:false` (FR-034) |
| `GET /api/delivery-networks/telegram/status` | estado da ligação da conta: não adicionado / sem permissão / pronto | `readiness` do adaptador; cache curto |
| `GET /api/delivery-networks/telegram/destinations` | destinos disponíveis para escolher | lista vazia é **estado normal com explicação**, nunca erro (US2 cenário 2) |
| `GET /api/delivery-networks/telegram/sources` | origens disponíveis | só se `capabilities.canReadSource` |
| `POST /api/delivery-networks/telegram/disable` | desliga o Telegram da conta | destinos param; WhatsApp intacto; **nada é apagado** (FR-019) |

As rotas de grupo existentes (`POST`/`PUT /groups`) passam a aceitar `deliveryNetwork` e recusam **troca de aplicativo** de um destino já criado (US3 cenário 5).

## Guardas obrigatórias em toda rota nova

1. **Direito de plano**, com `buildFeatureGateError(FEATURE_CODES.MULTI_NETWORK)` — explicação leiga e caminho para mudar de plano, nunca "seu plano não permite" (FR-048).
2. **Interruptor**: rede desabilitada responde como indisponível, não como erro.
3. **Nenhum segredo** de robô no corpo, no erro ou no log (FR-016).
4. **Nenhum campo** de dado de acesso é aceito ou exibido — a cliente não informa nada (FR-017/US2 cenário 7).

## Painel

- **Nova tela "Aplicativos"** (`dashboard/app/painel/aplicativos/`): passo a passo de adicionar **o robô do Espelha Grupos** ao grupo e torná-lo administrador com permissão de publicar. Sem QR, sem código, sem nada para copiar.
- **Configuração do destino**: mostra o aplicativo; opções exclusivas do WhatsApp (botão "Ver canal") **não aparecem** em destino de outra rede, decidido pela capacidade (FR-008/US6 cenário 1).
- **Histórico**: cada linha diz o aplicativo; linha antiga aparece como WhatsApp; reduções e falhas com motivo próprio, em linguagem leiga.
- **Painel de operação** (`/admin`): estado do robô único, com "?" explicando, no padrão dos demais cartões.

## Vocabulário travado (teste falha se voltar)

| Proibido na tela | Use |
|---|---|
| canal, plataforma, rede de entrega, adaptador, driver, transporte | **aplicativo** |
| Bot API, Graph API, webhook, token, chat_id, bot | **o robô do Espelha Grupos**, **seu grupo** |
| "seu plano não permite" | explicação do que o recurso faz + caminho para mudar de plano |

## Variáveis de ambiente

| Env | Default | Efeito |
|---|---|---|
| `DELIVERY_NETWORKS_ENABLED` | `whatsapp` | lista de aplicativos habilitados. **Lida na API, nunca no worker** — por isso ligar/desligar não reinicia o supervisor. |
| `TELEGRAM_BOT_TOKEN` | ausente | segredo de infraestrutura. Ausente = Telegram indisponível, sem erro e sem passada rodando. **Nunca** entra em credencial de cliente. |
| `DELIVERY_FAIR_SHARE_PER_USER` | a calibrar | teto por conta por tick no rodízio |
| `DELIVERY_OUTBOX_SWEEP_INTERVAL_MS` | a calibrar | intervalo da drenagem |

⚠️ Aplicar qualquer uma destas exige `pm2 delete` + `start` da API (pegadinha #1), **não** `restart --update-env`.
