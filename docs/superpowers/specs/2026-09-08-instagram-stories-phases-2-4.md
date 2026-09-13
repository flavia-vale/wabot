# Instagram Stories — Fases 2, 3 e 4

## Resultado

Estas fases entregam a persistência, o renderizador vertical e o storage
temporário necessários antes de OAuth e publicação pela Meta. Ainda não existe
chamada à Graph API nem tela: a funcionalidade permanece invisível e protegida
pelo entitlement exclusivo `canUseInstagramStories` do plano técnico
`premium`, acima do Pro.

## Fase 2 — persistência

- `Destination` inaugura destinos tipados sem reutilizar JIDs.
- `InstagramConnection` guarda somente token cifrado e metadados de saúde.
- `StoryTemplate` usa `scopeKey` não nulo para garantir unicidade também em
  templates globais no SQLite.
- `StoryTemplateVersion` é imutável; conteúdo novo exige nova versão.
- `StoryPublication` congela oferta, contrato, template e idempotência.
- `StoryPublicationAttempt` preserva cada tentativa e decisão de retry.
- `RenderedAsset` registra hash, dimensões, tamanho, expiração e exclusão.

A migração é somente aditiva: tabelas e fluxos WhatsApp existentes não mudam.
`createStoryPublication` revalida tenant, destino habilitado e acesso ao
template, além de reconciliar concorrência pela chave idempotente.

## Fase 3 — renderização

O contrato de saída é JPEG sRGB de 1080 × 1920, abaixo de 8 MB. O renderer:

1. recebe a imagem como `Buffer` — download e SSRF ficam fora desta fronteira;
2. limita entrada a 15 MB e 40 milhões de pixels;
3. corrige orientação, enquadra o produto e compõe textos por SVG escapado;
4. limita linhas e mantém preço/cupom/CTA em áreas previsíveis;
5. devolve hashes SHA-256 do JPEG e da versão do template.

O template padrão é validado e versionado. `ensureDefaultStoryTemplate` nunca
sobregrava o JSON de uma versão existente: mudança visual exige incrementar
`version`, preservando jobs e auditoria anteriores.

## Fase 4 — storage temporário

O backend local grava com `open(..., 'wx')`, chave opaca e permissão `0640`.
A expiração faz parte da chave e da assinatura HMAC; a rota pública aceita
somente o padrão canônico, bloqueia path traversal, usa comparação constante e
devolve sempre JPEG com `nosniff`.

Variáveis de ambiente:

```env
# URL completa da rota pública; HTTPS é obrigatório fora de testes.
STORY_ASSET_PUBLIC_BASE_URL=https://app.exemplo.com/api/public/story-assets
# Mínimo 32 caracteres e diferente entre staging/produção.
STORY_ASSET_SIGNING_SECRET=<segredo aleatório>
# Opcional; default ./data/story-assets
STORY_ASSET_DIR=/home/deploy/wabot-shared/story-assets
```

Sem ambas as variáveis, a rota não é registrada e nenhum diretório é criado;
configuração parcial bloqueia o boot para não produzir URLs quebradas. A
limpeza roda de hora em hora somente quando o storage está configurado; remove
primeiro o arquivo e só então marca `deletedAt`. Falha mantém a linha elegível
para a próxima tentativa.

## Próxima fronteira

OAuth, fila BullMQ, Graph API, integração dos fluxos e dashboard pertencem às
fases posteriores. Eles devem consumir estes contratos, sem acessar o arquivo
diretamente nem copiar a lógica de renderização.
