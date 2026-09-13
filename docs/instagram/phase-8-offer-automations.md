# Fase 8 — ofertas automáticas multicanal

As ofertas automáticas agora aceitam `instagramDestinationIds` além do grupo
WhatsApp legado. Os vínculos vivem em `OfferAutomationDestination`; IDs de
conta Meta nunca são gravados em `destGroupJid`.

Uma automação pode ser exclusivamente Instagram e, nesse caso, não depende de
sessão WhatsApp online. O cron carrega destinos tipados, revalida o entitlement
`canUseInstagramStories` a cada execução e remove destinos Instagram da rodada
após downgrade, sem impedir o destino WhatsApp permitido.

Cada oferta/destino recebe chave idempotente estável com automação, destino,
produto e preço. Falhas são isoladas por canal: um Story com erro não cancela
os irmãos; a oferta só entra em `sentItemIds` quando todos os canais previstos
foram aceitos. A publicação efetiva continua a cargo da fila BullMQ da fase 6.

## API

- `GET /api/offer-automations` devolve `instagramDestinationIds`;
- `POST /api/offer-automations` aceita grupo, Instagram ou ambos;
- `PUT /api/offer-automations/:id` substitui atomicamente os vínculos Instagram;
- planos abaixo do futuro Premium recebem o gate estruturado da feature.
