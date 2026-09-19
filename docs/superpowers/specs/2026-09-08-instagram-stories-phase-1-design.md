# Instagram Stories — Fase 1: contratos e arquitetura multicanal

## Escopo

Esta fase cria somente a fronteira de domínio que permitirá incorporar Stories
sem fingir que uma conta Instagram é um JID. Não inclui banco, OAuth, renderer,
fila BullMQ, rotas, telas ou chamadas à Meta.

## Regra comercial inegociável

Instagram Stories pertence exclusivamente ao plano futuro acima do Pro. O ID
técnico reservado é `premium`; o nome comercial pode ser trocado antes do
lançamento alterando `PLAN_IDS.PREMIUM`. Basic, Pro e Trial — inclusive Trial
ativo — recebem `canUseInstagramStories: false`.

Nenhuma integração futura deve conferir o nome do plano diretamente. Rotas,
crons e workers devem usar `getPlanAccess(...).entitlements.canUseInstagramStories`
e devolver `buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES)` quando o
acesso for negado.

## Contratos

### `CanonicalOffer`

Snapshot imutável e independente de canal. Contém identidade da oferta, texto,
preços em centavos, moeda, cupom, CTA, loja, URLs e atributos adicionais. O
snapshot viaja no job: um adaptador não volta à fonte para reinterpretar uma
oferta que pode ter mudado desde o agendamento.

### `DestinationRef`

Referência interna `{ id, type }`. Tipos iniciais:

- `whatsapp_group`;
- `whatsapp_channel`;
- `instagram_story`.

O `id` será a chave de uma futura entidade `Destination`. JID, ID externo da
Meta e token não pertencem ao contrato público e serão resolvidos pelo adaptador
sob autorização do tenant.

### `DeliveryRequest`

Envelope versionado que liga tenant, origem, snapshot da oferta, destino,
template, agendamento e chave idempotente. Origens cobertas desde o primeiro
contrato: manual, agendamento, fila de ofertas, automação e espelhamento.

`fanOutDeliveryRequests` materializa uma solicitação por destino. A chave de
idempotência incorpora tipo e ID do destino, permitindo que WhatsApp tenha
sucesso enquanto Instagram aguarda retry, sem colisão nem bloqueio cruzado.

### `DeliveryResult`

Resultado comum aos adaptadores. Separa status (`accepted`, `published`,
`skipped`, `failed`) da decisão de recuperação (`none`, `retryable`,
`reconcile`, `permanent`). `reconcile` existe para o caso crítico em que o
provedor pode ter publicado, mas a resposta se perdeu: repetir às cegas criaria
um Story duplicado.

### `DeliveryAdapter`

Porta abstrata da infraestrutura. Implementações futuras de WhatsApp e Instagram
receberão o mesmo `DeliveryRequest`; detalhes de Baileys, Graph API, credenciais,
renderer e filas ficam fora do domínio.

## Fluxo alvo

```text
manual | scheduled | offer_queue | offer_automation | mirror
                              |
                              v
                       CanonicalOffer
                              |
                              v
                    Destination resolver
                              |
                              v
                  1 DeliveryRequest / destino
                       /              \
          WhatsApp adapter       Instagram adapter
```

## Restrições para as próximas fases

1. Não salvar Instagram em `Group.waJid`, `targetJids` ou `destGroupJid`.
2. Não importar Graph API, Baileys, Prisma ou BullMQ em `src/domain/delivery`.
3. Não deixar falha de um adaptador cancelar destinos irmãos.
4. Revalidar tenant, entitlement e vínculo do destino no dequeue.
5. Persistir `contractVersion`, snapshot e idempotency key antes do envio.
6. Nunca colocar access token em request, resultado, metadata ou log.
7. Toda superfície Instagram deve usar o entitlement, mesmo em rotas internas,
   crons, retries e ações administrativas.

## Próxima fase

Desenhar as tabelas `Destination`, `InstagramConnection`, `StoryTemplate`,
`StoryTemplateVersion`, `StoryPublication`, `StoryPublicationAttempt` e
`RenderedAsset`, incluindo migração progressiva dos JIDs legados.
