# Fase 0 — POC real de Instagram Stories com a Meta

## Objetivo e estado

O harness reprodutível está pronto e foi validado contra respostas simuladas.
A execução real permanece **pendente de credenciais e acesso de rede**: o
ambiente atual não contém variáveis `IG_*` e o proxy bloqueou conexão a
`graph.instagram.com` com HTTP 403 antes de chegar à Meta.

Nunca cole access token em issue, PR, chat ou comando versionado. Configure-o
diretamente no ambiente efêmero que executará o POC.

## Pré-requisitos externos

1. Meta App de staging, separado de produção e em modo compatível com o tester.
2. Conta profissional Instagram Business; repetir depois com Creator se fizer
   parte do produto.
3. Usuário adicionado como tester/admin do app e da conta.
4. Token com permissão básica e de publicação do modelo de login escolhido.
5. JPEG 1080×1920 disponível numa URL HTTPS pública sem cookie/header.
6. Versão vigente e pinada da Graph API, confirmada no painel/documentação da
   Meta — o script não assume `latest` nem possui default silencioso.

Referências oficiais a conferir no dia da execução:

- <https://developers.facebook.com/docs/instagram-platform/content-publishing/>
- <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/>
- <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/>

## Configuração


```bash
export IG_LOGIN_METHOD=instagram_login # ou facebook_login
export IG_GRAPH_API_VERSION=vNN.N
export IG_ACCOUNT_ID='<instagram-professional-account-id>'
export IG_ACCESS_TOKEN='<token-do-tester>'
```

`instagram_login` usa `https://graph.instagram.com`; `facebook_login` usa
`https://graph.facebook.com`. O host não pode ser sobrescrito por variável de
ambiente, evitando que um erro de configuração envie o token a outro domínio.

## Execução progressiva e segura

### Gate A — somente leitura

```bash
IG_POC_MODE=inspect npm run poc:instagram-story > /tmp/instagram-poc-inspect.json
```

Aceite: identifica `id`, `username`, `account_type` e lê
`content_publishing_limit`. Falha 190/463 indica token vencido; ausência de
campo/permissão precisa ser resolvida antes de criar mídia.

### Gate B — cria container, não publica

```bash
export IG_STORY_IMAGE_URL='https://host-publico.example/story-poc.jpg'
IG_POC_MODE=container npm run poc:instagram-story > /tmp/instagram-poc-container.json
```

Aceite: retorna container e chega a `FINISHED` em no máximo cinco minutos. O
polling padrão é 10s. `ERROR` e `EXPIRED` encerram sem chamar `media_publish`.

### Gate C — publica de verdade

Este comando cria um Story visível na conta. Confirme conta e imagem antes:

```bash
IG_POC_MODE=publish npm run poc:instagram-story > /tmp/instagram-poc-publish.json
```

Aceite: `media.id` presente; Story visível no aplicativo; nenhum segundo Story
duplicado; conta e timestamp registrados no relatório sem token.

## Matriz mínima

| Cenário | Esperado |
|---|---|
| Instagram Login + Business | inspect/container/publish aprovados |
| Facebook Login + Business | repetir se será suportado |
| Creator | repetir se será prometido comercialmente |
| Token sem publish | erro permanente e legível, sem criar Story |
| URL privada/expirada | container `ERROR`, sem `media_publish` |
| Container lento | polling limitado a 5min |
| Resposta 429/5xx | erro marcado como `retryable` |

## Evidência e segurança

Guarde em ticket privado apenas os JSONs de `/tmp`, screenshot do Story e IDs
de conta/container/mídia. Antes de anexar, confirme:

```bash
! rg -n 'access_token|IG_ACCESS_TOKEN|EAA[A-Za-z0-9]+' /tmp/instagram-poc-*.json
```

Não commitar os relatórios. Revogue o token de POC ao terminar se ele não for
reutilizado pelo app de staging.
