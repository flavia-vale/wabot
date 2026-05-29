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

## Rodar em staging

Depois de configurar o token no `~/wabot-staging/.env`, valide primeiro em staging:

```bash
cd ~/wabot-staging
npm run telegram:offer-bot
```

Para manter rodando via PM2 em staging, usar um nome separado do core do Wabot:

```bash
cd ~/wabot-staging
pm2 start npm --name telegram-offer-bot-staging -- run telegram:offer-bot
pm2 save
```

## Comportamento

- `/start` ou `/help` retorna instruções de uso.
- Uma mensagem com exatamente 1 link `http(s)` gera a oferta.
- Para links suportados de marketplace, o bot tenta enviar a foto do produto junto com a oferta. Se a imagem não puder ser baixada ou o Telegram recusar a mídia, a oferta ainda é enviada em texto.
- Mensagens sem link, com mais de um link ou grandes demais recebem orientação de correção.
- O link final da oferta é sempre o link colado no Telegram; `finalUrl` do scraper é ignorado para não substituir o afiliado/manual.
- Quando o scraper não encontrar título nem preço, o bot responde: `⚠️ Nenhum produto encontrado para o link enviado!`
