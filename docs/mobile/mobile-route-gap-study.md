# Estudo de paridade das rotas `/m` vs. dashboard não-mobile

Data da análise: 2026-06-01.

## Protocolo de risco aplicado

- **Erros fatais:** este estudo é somente documental; não altera código executável, API, schema, build ou estado global.
- **Breaking changes:** nenhuma rota, contrato de API, componente, migration ou prop foi alterado.
- **Efeito cascata:** a análise compara chamadas e fluxos já existentes; qualquer implementação futura deve ser feita em PRs pequenos por área funcional.
- **Isolamento de ambiente:** nenhum comando tocou `.env`, banco SQLite, PM2, staging ou produção.
- **Bloqueio:** não há bloqueio para este documento. Para implementar lacunas P0/P1, validar primeiro em `develop` e staging (`http://178.105.54.0:3006`).

## Escopo e método

Foram inventariadas as rotas `dashboard/app/m/**` e comparadas com as rotas autenticadas `dashboard/app/dashboard/**`, além dos componentes compartilhados que carregam comportamento crítico. A comparação usou:

- inventário de arquivos `page.js`, `layout.js` e `route.js` em `dashboard/app`;
- extração das chamadas `api.*` usadas por cada página mobile e dashboard;
- leitura direcionada das páginas com diferenças funcionais relevantes;
- leitura dos componentes reutilizados pelo dashboard, principalmente `OfferBuilder`, `AddChannelModal`, `ChannelHealthPanel` e componentes de preservação.

## Mapa atual de rotas mobile (`/m`)

| Rota mobile | Papel atual | APIs usadas diretamente |
|---|---|---|
| `/m` | Home operacional mobile, métricas compactas, checklist e atalhos | `me`, `sessionStatus`, `groups`, `credentials`, `logsSummary`, `logs` |
| `/m/checklistespelhamento` | Checklist mobile de setup do espelhamento | `sessionStatus`, `groups`, `credentials` |
| `/m/op/converter` | Conversor manual de links com cópia individual/todos | `convertLinks` |
| `/m/op/offer` | Geração mobile de oferta, scraping, editor, bônus, envio e agendamento | `convertLinks`, `scrapeOffer`, `groups`, `broadcastSend`, `scheduledCreate`, `me` |
| `/m/op/logs` | Logs mobile com resumo, busca local, carregar mais, copiar links e limpar histórico | `logs`, `logsSummary`, `logsClear` |
| `/m/op/espelhar` | Estado do espelhamento e requisitos para operar | `me`, `sessionStatus`, `groups`, `getConfig`, `logsSummary` |
| `/m/op/scheduled` | Lista mobile de agendamentos e cancelamento | `scheduledList`, `scheduledCancel` |
| `/m/op/automations` | CRUD mobile de ofertas automáticas, toggle, disparo de teste e remoção | `offerAutomations`, `groups`, `offerAutomationCreate`, `offerAutomationUpdate`, `offerAutomationDelete`, `offerAutomationTrigger` |
| `/m/op/broadcast` | Broadcast manual mobile com segmentação de destinos | `groups`, `broadcastSend` |
| `/m/config/whatsapp` | Conexão WhatsApp via QR/código, parar, esquecer e reiniciar | `sessionStatusFast`, `sessionStart`, `sessionStop`, `sessionForget`, `sessionPairingCode`, `sessionQRTicket`, `sessionQRLatest`, `sessionTelemetry` |
| `/m/config/groups` | Cadastro/edição mobile de origens/destinos, filtros e alvos | `groups`, `sessionWAGroups`, `addGroup`, `updateGroup`, `deleteGroup`, `groupTargets`, `updateGroupTargets`, `channelHealth`, `followChannelNow`, `refreshChannelAdmin`, `me` |
| `/m/config/credentials` | Credenciais mobile de afiliados | `credentials`, `saveCredential` |
| `/m/config/preferences` | Preferências mobile persistidas no contrato mobile | `getConfig`, `saveConfig` |
| `/m/config/preservacao` | Preservação avançada mobile: acesso Pro, monitoramento e parte das configs | `me`, `preservationConfig`, `updatePreservationConfig`, `preservationHealth`, `preservationRiskScore`, `preservationFollows`, `preservationSnapshots`, `preservationClicks` |
| `/m/account` | Conta mobile, sessão e logout | `me`, `sessionStatus`, `logout` |
| `/m/account/subscription` | Assinatura mobile, checkout, PIX e recuperação por `payment_id` | `me`, `paymentsStatus`, `paymentsOverview`, `paymentsCheckout`, `paymentsRecover` |
| `/m/account/templates` | Modelos mobile de oferta salvos em `localStorage` | nenhuma API; usa `mobileTemplateStore` |
| `/m/account/variations` | Ganchos e CTAs persistidos no backend | `variationsGet`, `variationsUpdate` |
| `/m/tutorial` | Guia mobile de credenciais com imagens | nenhuma API |
| `/m/help/tutorial` | Redireciona para checklist mobile | nenhuma API |

## Mapa das principais rotas autenticadas não-mobile (`/dashboard`)

| Rota dashboard | Papel atual | Paridade mobile |
|---|---|---|
| `/dashboard/inicio` | Checklist de ativação + saúde da fila via `dashboardStatus` | Parcial em `/m` e `/m/checklistespelhamento` |
| `/dashboard` | Conexão WhatsApp | Alta em `/m/config/whatsapp` |
| `/dashboard/envio` | Broadcast manual, segmentação de destinos, templates rápidos e agendamentos | Alta para envio imediato em `/m/op/broadcast`; agendamentos em `/m/op/scheduled` |
| `/dashboard/converte-links` | Conversão + montador de oferta inline por link convertido | Parcial em `/m/op/converter`; geração fica separada em `/m/op/offer` |
| `/dashboard/gerar-oferta` | `OfferBuilder` compartilhado para gerar e copiar oferta | Parcial/diferente em `/m/op/offer` |
| `/dashboard/ofertas-automaticas` | CRUD, ativação e disparo manual de automações | Alta em `/m/op/automations` |
| `/dashboard/variacoes-de-texto` | Edição backend de ganchos/CTAs usados por automações | Alta em `/m/account/variations` |
| `/dashboard/logs` | Logs com resumo, filtros por status, busca/paginação e detalhes de erro | Alta/parcial em `/m/op/logs` |
| `/dashboard/grupos` | Grupos/canais, modal avançado de canais e painel anti-ban por canal | Parcial em `/m/config/groups` |
| `/dashboard/credenciais` | Credenciais de afiliados | Alta em `/m/config/credentials` |
| `/dashboard/credenciais/tutorial` | Tutorial compacto de credenciais | Coberto com mais detalhe em `/m/tutorial` |
| `/dashboard/configuracoes` | Delay, branding e aviso Pro | Parcial/diferente em `/m/config/preferences` |
| `/dashboard/preservacao/monitoramento` | Cards de saúde, score, follows, snapshots, probe e cliques | Parcial em `/m/config/preservacao` |
| `/dashboard/preservacao/configuracoes` | Configuração avançada de preservação, incluindo probe | Parcial em `/m/config/preservacao` |
| `/dashboard/assinaturas` | Planos dinâmicos, checkout e PIX manual | Parcial/diferente em `/m/account/subscription` |

Rotas `admin/**`, páginas públicas/SEO, landing pages, blog, materiais e comparativos não têm equivalente `/m`. Isso parece aceitável para páginas públicas/backoffice, mas deve ser uma decisão explícita de produto: a versão mobile autenticada cobre operação do cliente; o admin e marketing continuam desktop/public-first.

## Funcionalidades que faltam na versão mobile

### P0 — implementado no mobile após este estudo

1. **Ofertas automáticas:** implementadas em `/m/op/automations`, com listagem, criação/edição, ligar/desligar, disparo manual de teste e remoção usando as APIs `offerAutomations`, `offerAutomationCreate`, `offerAutomationUpdate`, `offerAutomationDelete` e `offerAutomationTrigger`.

2. **Ganchos e CTAs persistidos no backend:** implementados em `/m/account/variations`, usando `variationsGet`/`variationsUpdate` sobre `copyVariationPoolJson`. Isso é separado dos modelos locais de oferta em `/m/account/templates`.

3. **Broadcast manual completo:** implementado em `/m/op/broadcast`, com mensagem livre, templates rápidos, busca de destinos, filtro por mínimo de participantes, inclusão opcional de canais, selecionar/limpar visíveis e Top N.

4. **Cadastro avançado de canais:** `/m/config/groups` agora permite adicionar canais por link de convite, canais seguidos e JID resolvido, chamando `resolveChannelInvite`, `resolveChannelJid`, `waChannels` e `lintChannelCopy`, além do cadastro manual já existente.

### P1 — lacunas importantes, mas contornáveis pelo desktop

5. **Painel anti-ban por canal está reduzido no mobile.**
   `/dashboard/grupos` abre `ChannelHealthPanel`, que permite atualizar saúde, recalcular score, tirar snapshot agora e recriar canal. `/m/config/groups` mostra status/health e refresh de admin, mas não expõe snapshot manual, recomputar risco ou recriar canal.

6. **Preservação avançada mobile não expõe probe.**
   O dashboard de preservação inclui `ProbeStatus` no monitoramento e `ProbeToggle` na configuração, com iniciar/parar/selecionar sessão probe. `/m/config/preservacao` carrega saúde, risco, follows, snapshots e cliques, mas não usa `preservationProbe`, `preservationProbeSessionStart`, `preservationProbeSessionStop`, `preservationProbeSessionStatus` ou `preservationProbeSessionSelect`.

7. **Checklist mobile não valida o primeiro envio real.**
   O desktop usa `dashboardStatus` e exige `hasSuccessfulLog` como quinto passo. O mobile calcula o checklist a partir de sessão, grupos e credenciais e troca o passo final por “Ligar o espelhamento”, sem checar log de sucesso.

8. **Saúde operacional da fila não aparece no mobile.**
   `/dashboard/inicio` exibe `queueSize`, `maxSize`, latência média, sucessos, erros e último erro. A home mobile mostra métricas de logs recentes e resumo de envios, mas não consome `dashboardStatus` nem mostra a fila.

9. **Conversor mobile não oferece montador inline por resultado.**
   `/dashboard/converte-links` renderiza `OfferBuilderCard` para cada link convertido, permitindo transformar imediatamente um resultado em mensagem de oferta. `/m/op/converter` converte e copia links; para montar oferta, o usuário precisa ir para `/m/op/offer` e colar/gerar novamente.

10. **Assinaturas mobile não usa catálogo dinâmico de planos.**
    `/dashboard/assinaturas` busca `publicPlans`, mostra cards dinâmicos e permite escolher plano. `/m/account/subscription` inicia checkout direto para `pro` e adiciona recuperação por `payment_id`, mas não lista os planos dinâmicos.

### P2 — diferenças menores/UX e consistência

11. **Agendamentos têm UX dividida e sem destinos explícitos.**
    Desktop cria/cancela/lista agendamentos na mesma página de envio. Mobile agenda a oferta em `/m/op/offer` e lista/cancela em `/m/op/scheduled`. Ambos chamam `scheduledCreate(text, scheduledAt)` sem lista de destinos, então a seleção feita no envio imediato não é persistida no agendamento.

12. **Configurações básicas têm contratos diferentes.**
    Desktop salva delay, plataformas, palavras bloqueadas, `welcomeMsg`, `feedGlobal`, `postToStatus`, branding. A UI visível, porém, foca delay e branding. Mobile salva apenas o contrato `welcomeMsg`, `brandingGroupLink`, `brandingCtaText`, `delayMin`, `delayMax`, `blockedKeywords`, e declara explicitamente que só mostra campos com persistência segura.

13. **Logs têm filtros e busca com comportamentos diferentes.**
    Desktop filtra por status no servidor/paginação e mostra tabela em telas largas. Mobile carrega páginas de 30 itens, filtra/busca localmente nos itens carregados, agrupa por dia e adiciona ações de copiar link original/convertido.

14. **Templates mobile e variações desktop são conceitos diferentes.**
    Templates mobile personalizam a mensagem manual de oferta e ficam no navegador. Variações desktop editam grupos de ganchos/CTAs persistidos no backend para automações e preservação. Hoje o usuário pode configurar um sem afetar o outro.

15. **Navegação mobile expõe só cinco tabs principais.**
    O shell mobile fixa Início, Espelhar, Criar, Envios e Conta. Rotas como credenciais, preferências, grupos, preservação, assinatura, templates e tutorial existem, mas ficam como atalhos internos; automações e variações nem aparecem.

## Diferenças nas funcionalidades já existentes

### WhatsApp/conexão

Paridade alta. Desktop e mobile usam o mesmo conjunto principal de APIs de sessão (`sessionStatusFast`, QR ticket/latest, pairing code, start/stop/forget e telemetry). A diferença é de layout: desktop centraliza a rota em `/dashboard`; mobile coloca em `/m/config/whatsapp` com timeline compacta e foco em toque.

### Grupos e canais

Paridade parcial. As duas versões permitem listar grupos cadastrados, carregar grupos do WhatsApp, adicionar monitor/destino, editar filtros por grupo, configurar destinos de uma origem e remover. O desktop é mais completo para canais: resolução por convite/JID, lista de canais seguidos, lint de nome, painel de saúde, snapshot e recriação. O mobile é mais rápido para tarefas comuns, mas não cobre operações de recuperação/diagnóstico.

### Credenciais

Paridade alta para salvar credenciais. O mobile tem guia separado mais detalhado em `/m/tutorial`; o desktop tem `/dashboard/credenciais/tutorial` e link para tutorial geral. Diferenças esperadas são de conteúdo e navegação, não de contrato.

### Preferências/configurações

Paridade parcial. Delay e branding existem nos dois. Mobile adiciona `welcomeMsg` e palavras bloqueadas de forma visível; desktop mantém valores no payload, mas a UI atual não expõe todos eles. Desktop tem textos educativos sobre fila e “digitando...”; mobile é mais enxuto.

### Converter links e gerar oferta

Paridade funcional dividida. Desktop combina conversão e geração de oferta inline, além da página dedicada `OfferBuilder`. Mobile separa conversor e criador, mas o criador mobile é mais orientado a operação: permite scraping, edição, bônus de grupo/cupom, seleção de destinos e envio/agendamento.

### Envio e agendamento

Paridade parcial. Desktop é melhor para broadcast manual e segmentação; mobile é melhor para fluxo “criar oferta → enviar agora/agendar”. A listagem/cancelamento de agendamentos existe nos dois, mas em páginas separadas no mobile.

### Logs

Paridade parcial/alta. Ambos listam, filtram, paginam e limpam logs. Desktop tem tabela completa e detalhes de erro mais ricos; mobile tem timeline agrupada, resumo de 7 dias e ações rápidas de copiar links. A busca mobile é local sobre os itens carregados; a busca desktop anuncia consulta ao histórico filtrado no servidor, mas a função `api.logs` atual aceita apenas `status`, `page` e `limit`, então a busca passada como quarto argumento não entra na URL.

### Preservação avançada

Paridade parcial. Mobile une monitoramento e configuração em uma rota, respeita acesso Pro e cobre os dados principais. Desktop ainda é necessário para probe account/session, recomputar score global/por canal, snapshot manual por canal e recriação de canal.

### Assinaturas

Paridade parcial. Ambas fazem checkout e PIX. Desktop usa catálogo dinâmico de planos (`publicPlans`) e escolha de plano. Mobile mostra estado atual, checkout Pro direto, PIX e recuperação manual por `payment_id`.

## Recomendação de implementação por fases

### Fase 1 — fechar operação essencial mobile

1. Manter `/m/op/automations`, `/m/account/variations` e `/m/op/broadcast` alinhadas aos contratos desktop já existentes.
2. Adicionar à home/checklist mobile os dados de `dashboardStatus`: fila, latência, erros e primeiro envio validado.

### Fase 2 — fechar canais e anti-ban pelo celular

1. Evoluir `/m/config/groups` com cadastro de canal por convite, canais seguidos e JID resolvido.
2. Criar painel mobile de saúde do canal com snapshot agora, recalcular risco e recriar canal.
3. Adicionar controles probe em `/m/config/preservacao`.

### Fase 3 — consistência e refinamento

1. Unificar conceito de templates mobile com variações persistidas, ou deixar explícito no produto que são recursos diferentes.
2. Listar planos dinâmicos em `/m/account/subscription`.
3. Corrigir/confirmar busca de logs: ou enviar `query` no `api.logs`, ou alterar copy/UI para deixar claro que busca é local/página atual.
4. Decidir se agendamento deve aceitar destinos explícitos; se sim, mudar contrato backend com migração/compatibilidade e validar em staging.

## Observações de risco para implementação futura

- Alterar agendamento para armazenar destinos é mudança de contrato/API e possivelmente de schema; precisa de migration e compatibilidade com agendamentos existentes.
- Unificar templates locais mobile com variações backend pode afetar automações e preservação; tratar como produto novo, não simples refactor.
- Canais e preservação mexem em fluxos sensíveis a restrição/banimento; implementar primeiro em staging e validar com conta/canal de teste.
- Qualquer mudança em `/dashboard` e `/m` deve manter o proxy de API e portas existentes; não alterar portas sem atualizar os três pontos canônicos do AGENTS.md.


## Atualização 2026-06-02 — P1/P2 implementados

- P1.5: `/m/config/groups` agora expõe ações de saúde anti-ban por canal: atualizar saúde, recomputar risco, criar snapshot manual, carregar snapshots e recriar canal por JID.
- P1.6: `/m/config/preservacao` agora consome `preservationProbe`, `preservationProbeSessionStart`, `preservationProbeSessionStop`, `preservationProbeSessionStatus` e `preservationProbeSessionSelect`.
- P1.7/P1.8: o checklist mobile e a home usam `dashboardStatus.hasSuccessfulLog`; a home exibe a saúde operacional da fila quando `dashboardStatus.queue` está disponível.
- P1.9: o conversor mobile mantém o atalho por resultado para `/m/op/offer?url=...` e o montador mobile agora carrega esse link automaticamente.
- P1.10: assinaturas mobile usam o catálogo dinâmico de `publicPlans` e iniciam checkout/PIX com o plano selecionado.
- P2.11: destinos explícitos em agendamento seguem bloqueados pelo contrato atual `scheduledCreate(text, scheduledAt)`; a UI mobile agora deixa essa limitação clara para evitar falsa expectativa.
- P2.12: preferências mobile alinham o contrato com plataformas, feed global e status.
- P2.13: logs mobile enviam busca 3+ caracteres para o servidor e mantêm agrupamento mobile.
- P2.14: templates locais e variações globais persistidas continuam conceitos separados, mas agora a tela de templates direciona para as variações globais.
- P2.15: rotas avançadas aparecem como atalhos na home, preservando as cinco tabs fixas do shell mobile.
