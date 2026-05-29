# Bot de ofertas no Telegram

Este bot disponibiliza no Telegram o fluxo de **Gerar oferta** usando o link colado pelo usuário.
Ele busca título/preço via scraper de produto, tenta baixar a imagem da oferta no próprio marketplace, monta a copy com o template cadastrado **Simples** e **não converte o link**.

## Variáveis de ambiente

Adicionar no `.env` do ambiente onde o bot será executado:

```bash
TELEGRAM_OFFER_BOT_TOKEN=<token criado no BotFather>
# Opcional: limita o uso a chats específicos, separados por vírgula.
# Se ficar vazio, qualquer chat que falar com o bot pode usar.
TELEGRAM_OFFER_BOT_ALLOWED_CHAT_IDS=123456789,-1001234567890
```

## Processos PM2 (canônico)

O bot agora tem entradas dedicadas no `ecosystem.config.cjs`:

| App                          | Ambiente | Diretório no VPS  |
|------------------------------|----------|-------------------|
| `telegram-offer-bot`         | prod     | `~/wabot`         |
| `telegram-offer-bot-staging` | staging  | `~/wabot-staging` |

> **⚠️ Um único poller por token.** O bot usa long-polling (`getUpdates`).
> Duas instâncias com o **mesmo** `TELEGRAM_OFFER_BOT_TOKEN` causam
> `409 Conflict` e **ambas param de responder**. Use tokens **diferentes**
> em prod e staging. Se o bot parar de enviar, esse é o primeiro suspeito —
> confira `getWebhookInfo` (URL deve estar vazia) e `pm2 list`.

```bash
# staging
cd ~/wabot-staging
pm2 start ecosystem.config.cjs --only telegram-offer-bot-staging
pm2 save

# produção (só após validar staging)
cd ~/wabot
pm2 start ecosystem.config.cjs --only telegram-offer-bot
pm2 save
```

Para um teste pontual em foreground (sem PM2): `npm run telegram:offer-bot`.

> Pegadinha #1 (PM2 cacheia env): ao trocar o token, faça
> `pm2 delete telegram-offer-bot && pm2 start ecosystem.config.cjs --only telegram-offer-bot`.
> Um `pm2 restart --update-env` pode não recarregar o token do `.env`.

## Comportamento

- `/start` ou `/help` retorna instruções de uso.
- Uma mensagem com exatamente 1 link `http(s)` gera a oferta.
- Para links suportados de marketplace, o bot tenta enviar a foto do produto junto com a oferta. Se a imagem não puder ser baixada ou o Telegram recusar a mídia, a oferta ainda é enviada em texto.
- Mensagens sem link, com mais de um link ou grandes demais recebem orientação de correção.
- O link final da oferta é sempre o link colado no Telegram; `finalUrl` do scraper é ignorado para não substituir o afiliado/manual.
- Quando o scraper não encontrar título nem preço, o bot responde: `⚠️ Nenhum produto encontrado para o link enviado!`
- **Em caso de sucesso**, após enviar a oferta o bot envia uma segunda mensagem — `Quer enviar essa mensagem para o WhatsApp?` — com um botão inline **Sim** que abre `https://wa.me/?text=<oferta-codificada>`, encaminhando a oferta pronta ao WhatsApp. O botão não aparece no caminho "produto não encontrado" nem em erro.
