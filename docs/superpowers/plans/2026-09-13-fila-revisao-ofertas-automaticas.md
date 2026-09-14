# Plano de implementação — fila de revisão das ofertas automáticas

> Este plano executa a proposta de
> `docs/produto/fila-revisao-ofertas-automaticas.md`. Cada issue deve virar uma
> PR pequena contra `develop`; nenhum sprint autoriza pular staging.

**Status:** implementação concluída atrás de flags; ativação/piloto pendentes.
**Objetivo:** permitir revisão humana das ofertas encontradas sem alterar
nenhum envio automático existente.  
**Stack:** Node.js, Fastify, Prisma/SQLite, Next.js, `node:test`.

### Situação da entrega

- Sprints 0–4: código, migration, API, UI, isolamento, recovery e testes
  implementados.
- Sprint 5: diagnóstico read-only e runbook implementados; ativação em staging,
  observação e piloto com clientes continuam deliberadamente manuais.
- As duas flags permanecem desligadas por padrão. Portanto, o merge não muda o
  fluxo de nenhuma automação existente.

---

## 1. Contrato de segurança do projeto

Estas condições valem para todas as issues e bloqueiam merge quando violadas:

1. `publicationMode='direct'` continua percorrendo o mesmo pipeline e produzindo
   os mesmos efeitos observáveis de hoje.
2. Migration é somente aditiva. Nenhuma linha existente será reescrita,
   desativada ou convertida para revisão.
3. A coluna nova terá default `direct`; código também tratará `null`, valor
   desconhecido e flag desligada de maneira conservadora.
4. Item sem aprovação jamais chega a `sendBroadcast` ou ao runtime Instagram.
5. Desligar a feature não pode fazer uma automação `review` cair para `direct`.
   Ela fica pausada com conteúdo preservado.
6. `lastSentAt`, `sentItemIds` e `OfferAutomationSentLog` continuam descrevendo
   entrega, nunca descoberta ou aprovação.
7. Não criar processo PM2, cron independente ou fila Redis. O tick existente é
   estendido atrás de flags para preservar operação e consumo de RAM.
8. Toda mutação inclui `userId` e `automationId`; nenhuma entidade é carregada
   apenas por um ID recebido do navegador.
9. Listagens são paginadas e ações em lote têm teto.
10. Nenhuma PR mistura refatoração, schema, API, UI e ativação. Cada camada
    precisa poder ser revertida sozinha.

### Flags e estados seguros

Usar duas flags independentes:

```text
OFFER_AUTOMATION_REVIEW_ENABLED=false
OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED=false
```

- A primeira libera domínio, APIs e descoberta somente para usuários da
  allowlist do piloto.
- A segunda libera a entrega de aprovados. Ela só pode ser ligada depois de a
  descoberta e a UI estarem validadas em staging.
- Ausência, valor inválido ou erro ao ler configuração significam `false`.
- A allowlist deve ser persistida/configurada pelo mecanismo já usado pelo
  produto; se não houver mecanismo apropriado, criar uma lista de IDs em env
  apenas para o piloto, nunca uma regra baseada em e-mail no código.

### Gate obrigatório de cada PR

```bash
git diff --check
npm test
npm run arch:check
```

Quando a PR tocar dashboard, acrescentar os guards específicos existentes e
teste de responsividade aplicável. Quando tocar Prisma, acrescentar validação de
migration em cópia do banco e `prisma validate`.

---

## 2. Estratégia de entrega

O trabalho é dividido em **seis sprints**, cada um com saída utilizável e
rollback independente. Estimativas são esforço de engenharia, não calendário.

| Sprint | Resultado | Issues | Esforço |
|---|---|---|---:|
| 0 | baseline e contratos do fluxo atual | OA-R01–R03 | 3–4 dias |
| 1 | dados e domínio, ainda sem runtime | OA-R04–R07 | 4–5 dias |
| 2 | descoberta persistida, impossível enviar | OA-R08–R11 | 5–6 dias |
| 3 | API e interface de revisão | OA-R12–R16 | 6–8 dias |
| 4 | entrega aprovada resiliente | OA-R17–R21 | 6–8 dias |
| 5 | piloto, operação e liberação opt-in | OA-R22–R26 | 5–7 dias + observação |

Não começar Sprint 4 apenas porque o código da Sprint 3 foi mergeado. A saída
da Sprint 3 deve passar por validação manual em staging: gerar, visualizar,
aprovar e remover, comprovando nos logs que **nenhum envio ocorreu**.

---

## Sprint 0 — congelar o comportamento atual

### OA-R01 — Caracterizar `runAutomation` antes da extração

**Objetivo:** transformar o comportamento atual em contrato automatizado antes
de refatorar o dispatcher.

**Arquivos previstos:**

- `test/offer-automation.test.js`;
- fixtures locais do próprio teste, sem acesso à Shopee ou WhatsApp reais.

**Trabalho:**

- cobrir busca normal e AMS, rotação de página, dedup por produto e grupo/preço;
- verificar texto, template, variação, foto, referer e opções passadas para
  `sendBroadcast`;
- cobrir WhatsApp, Instagram e sucesso/falha parcial por canal;
- afirmar exatamente quando mudam `lastSentAt`, `sentItemIds`, `page` e o log;
- cobrir `no_offers_found`, `all_offers_filtered`, bot offline e credencial
  ausente/inválida;
- congelar a ordem sequencial do lote e o limite `offersPerSend`.

**Aceite:** os testes passam no commit anterior à feature e falhariam se um dos
efeitos acima mudasse.

**Impacto/rollback:** somente testes. Se revelar comportamento ambíguo, abrir
decisão separada; não “corrigir junto” com a fila.

---

### OA-R02 — Criar matriz de compatibilidade e fixtures douradas

**Objetivo:** comparar automaticamente o resultado do caminho legado antes e
depois da refatoração.

**Arquivos previstos:**

- `test/fixtures/offer-automation/`;
- `test/offer-automation-compatibility.test.js`.

**Trabalho:**

- criar ofertas determinísticas para preço cheio, desconto, sem nota, sem
  vendidos, imagem ausente e títulos semelhantes;
- salvar expectativas estruturadas, não snapshots gigantes frágeis;
- executar o dispatcher com relógio e aleatoriedade injetados;
- comparar chamadas externas e writes no DB fake, não apenas retorno da função.

**Aceite:** uma mudança de copy, destino, dedup ou bookkeeping no modo direto
gera uma falha legível.

**Dependência:** OA-R01.

---

### OA-R03 — Definir flags fail-closed e telemetria de baseline

**Objetivo:** criar o interruptor antes de criar qualquer caminho funcional.

**Arquivos previstos:**

- `src/offerAutomation/reviewFlags.js`;
- `src/analytics.js` apenas se novos eventos exigirem allowlist;
- `test/offer-automation-review-flags.test.js`.

**Trabalho:**

- parser puro para flags e allowlist;
- default `false` para ausência, typo ou exceção;
- helper separado para `canDiscoverReview` e `canDeliverReview`;
- contadores de baseline sem dados de produto: duração, quantidade bruta,
  filtrada e enviada do fluxo atual;
- não alterar seleção, frequência ou envio do cron.

**Aceite:** com env atual, todas as decisões da feature são `false`; testes
cobrem valores inválidos e garantem que a telemetria não contém texto/URL.

**Impacto/rollback:** módulo novo sem call site funcional; revert simples.

### Saída e gate do Sprint 0

- suíte verde em `develop`;
- resultado de automação direta conhecido e protegido;
- flags presentes e desligadas;
- observar staging por pelo menos 24 horas para confirmar que a instrumentação
  não aumentou erros, duração do tick ou volume de logs de forma relevante.

---

## Sprint 1 — persistência e máquina de estados isoladas

### OA-R04 — Migration aditiva da automação e dos itens de revisão

**Objetivo:** adicionar armazenamento sem ativar nenhum produtor/consumidor.

**Arquivos previstos:**

- `prisma/schema.prisma`;
- `prisma/migrations/<timestamp>_offer_automation_review_queue/migration.sql`;
- teste de schema/migration.

**Schema:**

- `OfferAutomation.publicationMode String @default("direct")`;
- `OfferAutomation.lastDiscoveryAt DateTime?`;
- `OfferAutomation.reviewTargetSize Int @default(10)`;
- relação `reviewItems`;
- `OfferAutomationReviewItem` com snapshot, estados, posição, auditoria,
  expiração, claim, tentativas, próxima tentativa e erro;
- índices `(automationId,status,position)`, `(userId,status,createdAt)` e
  `(automationId,productKey,priceCents)`.

**Cuidados:**

- SQL só com `ADD COLUMN`/`CREATE TABLE`/`CREATE INDEX` compatíveis com SQLite;
- não fazer `UPDATE OfferAutomation`;
- `onDelete: Cascade` apenas da automação/usuário para itens;
- não criar índice único que impeça histórico do mesmo produto depois de
  expiração ou mudança de preço.

**Aceite:** aplicar a migration numa cópia com automações existentes preserva
contagem e valores; todas aparecem como `direct`; rollback operacional é
reverter o código, deixando colunas/tabela inertes.

**Dependências:** Sprint 0 concluído.

---

### OA-R05 — Implementar máquina de estados pura

**Objetivo:** concentrar transições válidas fora das rotas e do Prisma.

**Arquivos previstos:**

- `src/offerAutomation/reviewState.js`;
- `test/offer-automation-review-state.test.js`.

**Trabalho:**

- constantes e predicados para `awaiting_review`, `approved`, `sending`,
  `sent`, `removed`, `expired`, `failed`;
- matriz explícita de transições;
- funções para aprovação, remoção, claim, retry, terminal e expiração;
- segunda operação idêntica deve ser idempotente;
- ação incompatível devolve código de domínio, não mensagem de UI.

**Aceite:** 100% das arestas permitidas/proibidas da matriz cobertas; módulo
puro sem imports de DB, rede, dashboard ou manager.

---

### OA-R06 — Criar repositório tenant-safe e claims condicionais

**Objetivo:** encapsular todas as queries para impedir acesso cruzado e corrida.

**Arquivos previstos:**

- `src/offerAutomation/reviewRepository.js`;
- `test/offer-automation-review-repository.test.js`.

**Trabalho:**

- criar em lote dentro de transação;
- listar por cursor, status e teto fixo;
- contar por estado com `groupBy`;
- aprovar/remover usando `updateMany` com estado anterior esperado;
- claim usando `updateMany` `approved -> sending`;
- calcular próxima posição sem permitir colisão em chamadas concorrentes;
- impedir duplicata viva de `productKey + priceCents` por automação dentro da
  mesma transação;
- nenhuma função pública aceita query sem `userId`.

**Aceite:** testes com dois usuários e IDs forjados; corrida simulada produz um
claim e uma única posição; não há N+1 na listagem.

**Dependência:** OA-R04 e OA-R05.

---

### OA-R07 — Incluir a entidade no ciclo LGPD e retenção

**Objetivo:** não criar um silo fora da exportação e exclusão do usuário.

**Arquivos previstos:**

- `src/domain/lgpd/dataRequest.js`;
- serviço de limpeza em `src/offerAutomation/`;
- testes LGPD e retenção.

**Trabalho:**

- exportar metadados necessários, sem duplicar conteúdo sensível inutilmente;
- garantir cascade/eliminação na exclusão;
- política inicial: expirar oferta viva por idade configurada e remover
  históricos `sent/removed/expired` após retenção documentada;
- limpeza limitada por lote para não bloquear SQLite;
- limpeza desligada até o piloto e executada pelo processo existente.

**Aceite:** usuário A nunca exporta item de B; exclusão remove tudo; limpeza de
milhares de fixtures trabalha em lotes.

### Saída e gate do Sprint 1

- migration validada em cópia de staging;
- nenhuma rota, cron ou UI usa a nova tabela;
- smoke de oferta automática atual obrigatório após deploy;
- comparar quantidade e horário de envios antes/depois.

---

## Sprint 2 — descoberta persistida sem capacidade de envio

### OA-R08 — Extrair descoberta/materialização/entrega mantendo `direct`

**Objetivo:** criar seams reutilizáveis sem alterar `runAutomation`.

**Arquivos previstos:**

- `src/offerAutomation/dispatcher.js`;
- novos módulos em `src/offerAutomation/` com responsabilidade única;
- testes OA-R01/R02.

**Trabalho:**

- extrair `discoverCandidates`, `materializeCandidate` e `deliverCandidate`;
- manter assinatura pública e injeção de dependências atual;
- não mudar ordem das chamadas externas ou formato dos writes;
- `runAutomation` direto continua orquestrando as três etapas;
- evitar importar módulos do dashboard em novos módulos de domínio quando uma
  extração compartilhada resolver a dependência sem ciclo.

**Aceite:** fixtures douradas e toda a suíte existente passam sem atualização
de expectativa; diff funcional do modo direto é zero.

**Rollback:** revert apenas da refatoração, pois schema segue inerte.

---

### OA-R09 — Implementar serviço de descoberta revisada

**Objetivo:** popular itens congelados sem qualquer possibilidade de publicar.

**Arquivos previstos:**

- `src/offerAutomation/reviewDiscoveryService.js`;
- testes unitários e de integração local.

**Trabalho:**

- calcular vagas com `awaiting_review + approved` até `reviewTargetSize`;
- reutilizar busca, filtros, rotação e dedup extraídos;
- excluir itens vivos, enviados e removidos na janela de rejeição;
- materializar `renderedText`, imagem, preço e destinos;
- atualizar `page` e `lastDiscoveryAt`, nunca campos de entrega;
- `expiresAt` configurável com default conservador;
- retorno estruturado para vazio, filtrado, fila cheia e credencial inválida;
- nenhuma importação de `manager.js` ou runtime do Instagram neste serviço.

**Aceite:** spy afirma zero chamadas de entrega; falha entre busca e transaction
não cria lote parcial nem avança relógio/página indevidamente.

**Dependências:** OA-R06 e OA-R08.

---

### OA-R10 — Integrar descoberta ao cron atrás da primeira flag

**Objetivo:** abastecer somente automações piloto sem tocar no ramo direto.

**Arquivos previstos:**

- `src/offerAutomation/cron.js`;
- `src/offerAutomation/schedule.js` ou scheduler específico de descoberta;
- testes do cron.

**Trabalho:**

- branch explícito: `direct -> runAutomation` atual; `review -> discover` apenas
  se flag + allowlist autorizarem;
- modo desconhecido é pausado e gera alerta, nunca cai para direto;
- separar vencimento de descoberta do vencimento de envio;
- manter trava do tick e processamento sequencial para não aumentar pressão no
  SQLite/Shopee;
- limitar quantidade de automações revisadas por tick e continuar no próximo;
- não exigir bot online para descobrir; exigir credencial/plano como hoje;
- flag desligada não executa query de itens de revisão no hot path direto.

**Aceite:** matriz flag/modo/allowlist prova que somente a combinação autorizada
descobre; em nenhuma combinação o ramo revisado envia.

---

### OA-R11 — Diagnóstico operacional read-only

**Objetivo:** saber se a descoberta está saudável antes de criar UI mutável.

**Arquivos previstos:**

- `scripts/diag-offer-review.mjs`;
- documentação operacional;
- teste do script com banco temporário.

**Saída:** contagens por estado/automação, idade, último garimpo, expiração,
duplicatas potenciais e modo/flag. Não imprimir texto, links, credenciais ou
segredos. Default estritamente read-only, sem opção de “corrigir” nessa issue.

**Aceite:** roda em staging sem writes e diferencia fila vazia saudável de
falha de descoberta.

### Saída e gate do Sprint 2

- em staging, uma automação allowlisted gera itens consultáveis apenas pelo
  diagnóstico;
- logs e mocks comprovam zero chamadas ao WhatsApp/Instagram;
- automações diretas continuam publicando no mesmo horário;
- observar pelo menos 48 horas, incluindo rotação e reposição.

---

## Sprint 3 — API e experiência de revisão, entrega ainda desligada

### OA-R12 — APIs de listagem, aprovação e remoção

**Objetivo:** expor a máquina de estados com autenticação e idempotência.

**Arquivos previstos:**

- `src/api/routes/offerAutomationReview.js`;
- registro em `src/api/server.js`;
- testes de rota.

**Rotas:**

- `GET /api/offer-automations/:id/review-items` paginada;
- `POST .../discover` com cooldown;
- `POST .../:itemId/approve`;
- `POST .../:itemId/remove`;
- `POST .../bulk-approve` e `/bulk-remove`, máximo 50 IDs;
- `POST .../:itemId/retry`, criado agora mas bloqueado até Sprint 4.

**Regras:**

- GET e remoção continuam disponíveis após downgrade para a cliente limpar;
- descobrir/aprovar exigem entitlement atual, flag e allowlist;
- validar IDs, status e limites antes do DB;
- respostas não expõem `lastError` técnico bruto; mapear código amigável;
- rate limit específico no discover;
- ações em lote são transacionais e retornam `changed`, `unchanged`, `invalid`.

**Aceite:** 401 sem token, 404 para recurso de outro tenant, 403 sem plano/flag,
paginação estável e chamadas repetidas idempotentes.

---

### OA-R13 — Estender CRUD de automação com modo de publicação

**Objetivo:** permitir optar por revisão sem conversões perigosas.

**Arquivos previstos:**

- `src/api/routes/offerAutomation.js`;
- `dashboard/lib/api.js`;
- testes de rota.

**Regras de transição:**

- `direct -> review`: permitido só com flag/allowlist e confirmação na UI;
- `review -> direct`: API exige confirmação explícita e arquiva/expira vivos;
- nunca enviar pendências durante a troca;
- mudança de template ou destinos em `review` expira itens vivos; nova
  descoberta gera snapshot coerente;
- mudança de filtros não altera item já revisado, somente próximas descobertas;
- validar `reviewTargetSize` entre 5 e 30;
- listagem retorna contadores agregados, não todos os itens.

**Aceite:** automação antiga sem o campo no payload continua válida e direta;
todos os cenários de troca cobertos.

---

### OA-R14 — Construir a tela de fila de revisão

**Objetivo:** permitir à cliente entender e decidir sem misturar com Filas.

**Arquivos previstos:**

- componentes dedicados em `dashboard/components/offerAutomation/`;
- `dashboard/app/painel/ofertas-automaticas/page.js`;
- estilos do painel apenas quando classes existentes não bastarem.

**Trabalho:**

- controle “Publicar automaticamente / Revisar antes de publicar”;
- contadores `Para revisar`, `Aprovadas`, `Enviadas`;
- cards com imagem, mensagem congelada, metadados, destinos, preparo/validade;
- aprovar/remover, seleção e ações em lote;
- “Buscar mais” com estado de cooldown e explicação de resultado;
- estados vazios e motivos traduzidos;
- nenhuma ação “Enviar agora”;
- no modo piloto, opção invisível para não allowlisted;
- acessibilidade por teclado, foco após ação e região viva moderada.

**Aceite:** o texto mostrado vem de `renderedText`; UI não recompõe template;
375 px sem overflow lateral; ações não dependem de hover.

**Dependências:** OA-R12 e OA-R13.

---

### OA-R15 — Blindar concorrência e experiência otimista

**Objetivo:** impedir duplo clique e duas abas de produzirem estado confuso.

**Arquivos previstos:** mesmos componentes/API client e testes de interação.

**Trabalho:**

- desabilitar ação por item enquanto request está ativa;
- reconciliar pelo estado retornado da API, nunca assumir sucesso local;
- item alterado em outra aba aparece como `unchanged` e é atualizado;
- bulk parcial mantém seleção apenas dos que falharam;
- retry de rede não duplica transição;
- polling moderado ou refresh explícito; não adicionar websocket no MVP.

**Aceite:** testes com promises controladas simulam clique duplo, resposta fora
de ordem e alteração concorrente.

---

### OA-R16 — Testes E2E da revisão sem entrega

**Objetivo:** provar o limite de segurança anterior à ativação do consumidor.

**Cenários:** criar opt-in, descobrir, recarregar, aprovar, remover, bulk,
expirar por mudança de destino/template, downgrade e mobile. Spy global deve
falhar o teste se qualquer função de entrega for chamada.

**Aceite:** evidência de staging com um produto aprovado visível e zero mensagem
recebida no grupo/canal controlado.

### Saída e gate do Sprint 3

- revisão funciona ponta a ponta como caixa de entrada;
- segunda flag permanece `false` em todos os ambientes;
- validação manual obrigatória em `http://178.105.54.0:3006`;
- aprovação humana registrada antes de iniciar Sprint 4.

---

## Sprint 4 — entrega exclusiva de itens aprovados

### OA-R17 — Dispatcher revisado com claim, lease e retry

**Objetivo:** entregar um aprovado exatamente uma vez dentro das garantias
práticas dos canais.

**Arquivos previstos:**

- `src/offerAutomation/reviewDeliveryService.js`;
- `src/offerAutomation/reviewRecovery.js`;
- testes intensivos de concorrência/falha.

**Trabalho:**

- selecionar por posição e `nextAttemptAt`;
- claim condicional `approved -> sending`;
- revalidar automação ativa, plano e flag após claim e antes de enviar;
- flag desligada/deativação devolve para `approved` sem gastar tentativa;
- WhatsApp/Instagram usam snapshot aprovado e pipelines existentes;
- idempotency key do Instagram inclui item de revisão/destino;
- sucesso atualiza item e bookkeeping atual em transação quando possível;
- falha transitória volta para `approved` com backoff;
- após teto, `failed`; watchdog recupera lease expirada;
- nunca reconstruir texto ou trocar destinos no consumo.

**Aceite:** dois consumidores concorrentes geram uma entrega; restart após
claim recupera; falha parcial não repete canal já aceito sem idempotência.

---

### OA-R18 — Resolver sucesso parcial por canal explicitamente

**Objetivo:** não reduzir resultado multicanal a um único booleano.

**Trabalho:** persistir estado de entrega por destino ou snapshot de resultados,
de forma que retry saiba o que falta; reutilizar idempotência do Instagram e
semântica comprovada do dispatcher atual. Para WhatsApp, só marcar aceito após
retorno bem-sucedido de `sendBroadcast`.

**Aceite:** WhatsApp sucesso/Instagram falha e inverso são testados; retry não
repete destino concluído; `sentItemIds` reflete a regra atual por canal.

**Dependência:** OA-R17. Pode exigir tabela filha; se exigir, fazer migration
aditiva em PR separada antes do serviço.

---

### OA-R19 — Integrar entrega ao tick existente com orçamento

**Objetivo:** consumir aprovados sem atrasar automações diretas.

**Arquivos previstos:**

- `src/offerAutomation/cron.js`;
- scheduler/testes.

**Trabalho:**

- ramo de entrega exige modo `review`, duas flags, allowlist e vencimento;
- limitar itens e automações revisadas por tick;
- processar automações diretas primeiro durante piloto, ou reservar orçamento
  explícito, garantindo que revisão não cause starvation;
- `offersPerSend`, intervalo e horário diário continuam válidos;
- sem aprovados: não atualizar `lastSentAt`, emitir motivo agregado com throttle;
- descoberta e entrega da mesma automação não rodam simultaneamente;
- medir duração do tick e atraso máximo.

**Aceite:** carga com muitas filas revisadas não muda horário de uma automação
direta fixture; flag delivery desligada torna o consumidor inerte.

---

### OA-R20 — Expor falhas e retry manual em linguagem leiga

**Objetivo:** permitir recuperação sem mostrar stack trace ou exigir suporte.

**Trabalho:** mapear categorias de erro para mensagens leigas; mostrar tentativas
e próxima tentativa; botão manual apenas para `failed`, devolvendo a `approved`;
retry continua respeitando cadência, não envia na request.

**Aceite:** prefixos técnicos e credenciais não chegam à UI; retry não contorna
plano, flag, horário ou automação pausada.

---

### OA-R21 — Suite de não regressão e teste de carga local

**Objetivo:** comprovar ausência de impacto no fluxo existente e no processo.

**Cenários:**

- 100% automações diretas com flags on/off;
- mistura direct/review, fila vazia/cheia e bot offline;
- dois ticks concorrentes, restart/lease, API lenta e SQLite ocupado;
- memória e duração do tick antes/depois;
- `npm test`, smoke, `arch:check` e guards de deploy.

**Limites iniciais sugeridos:** sem crescimento persistente de memória por tick;
p95 do ramo direto sem regressão material (>10% exige investigação); queries da
revisão proporcionais às automações revisadas, nunca ao histórico total.

### Saída e gate do Sprint 4

- habilitar delivery somente em staging e apenas para um usuário/grupo de teste;
- executar descoberta → aprovação → janela → entrega;
- testar pause, kill switch, restart da API e falha de canal;
- manter staging no modo canônico de supervisor definido pelo `AGENTS.md`;
- aprovação manual documentada antes do piloto real.

---

## Sprint 5 — piloto controlado e liberação

### OA-R22 — Painel operacional e alertas

**Objetivo:** detectar fila parada antes de a cliente reclamar.

**Métricas:** idade mais antiga, contagens por estado, descoberta vazia,
expiração, taxa de remoção, tempo até aprovação, retries, falha terminal, duração
do tick e automação sem aprovados na hora. Alertas agregados/throttled, sem
produto, mensagem ou URL.

**Aceite:** runbook associa cada alerta a diagnóstico e ação; alerta não
reinicia bot/supervisor nem envia conteúdo.

---

### OA-R23 — Runbook de rollout e rollback

**Objetivo:** tornar a ativação operacionalmente reversível.

**Deve conter:** pré-flight, flags por ambiente, allowlist, consulta read-only,
smoke direto, smoke revisado, monitoramento, critérios de abortar e passos de
rollback. Rollback desliga delivery primeiro, depois descoberta; itens ficam
preservados; nunca muda `publicationMode` em massa.

**Aceite:** outra pessoa executa o runbook em staging sem contexto oral.

---

### OA-R24 — Piloto com 1–3 clientes e coleta de decisão

**Objetivo:** validar comportamento e modelo mental, não só estabilidade.

**Janela sugerida:** 7–14 dias. Acompanhar quantos itens são aprovados/removidos,
tempo de revisão, fila vazia, repetição percebida e entrevistas. Suporte deve
saber que remover bloqueia reaparecimento apenas pela janela definida.

**Critérios de saída:** zero envio não aprovado, zero duplicação causada pela
fila, nenhuma regressão reportada em automações diretas e feedback de que a
prévia representa o post real.

---

### OA-R25 — Liberação opt-in geral

**Objetivo:** remover allowlist sem mudar defaults.

**Trabalho:** opção disponível para Pro/Trial; `direct` segue default; flags
continuam como kill switch; copy e ajuda explicam que revisão exige aprovação;
não alterar automações existentes.

**Aceite:** migration/ativação geral não muda `publicationMode` nem cria itens
para quem não optou.

---

### OA-R26 — Pós-lançamento e decisões adiadas

**Objetivo:** decidir próximos passos com dados.

Avaliar em issues separadas: edição de copy por item, reordenação, rejeitar para
sempre, aprovação automática por SLA, aprendizado de relevância e recomendação
de mais vendidos. Nenhuma delas entra como “ajuste rápido” no MVP.

### Saída do Sprint 5

- feature opt-in, observável e reversível;
- relatório do piloto e decisão registrada;
- flags mantidas por pelo menos um ciclo de estabilidade;
- somente depois discutir revisão como experiência padrão.

---

## 3. Dependências entre issues

```text
R01 -> R02 -> R08 -----------------------> R17 -> R18 -> R19 -> R21
  \              \                         \             /
   -> R03          -> R09 -> R10 -> R11      -> R20 -----+

R04 -> R05 -> R06 -> R09
  \            \-> R12 -> R14 -> R15 -> R16
   -> R07            \-> R13 --/

R21 -> R22 -> R23 -> R24 -> R25 -> R26
```

Issues sem dependência direta podem ser desenvolvidas em paralelo apenas se
ficarem em PRs separadas e não editarem simultaneamente o mesmo hot path.

---

## 4. Checklist padrão de cada issue/PR

### Antes de codificar

- [ ] Rebase/branch a partir de `develop` atualizado.
- [ ] Confirmar escopo e dependências concluídas.
- [ ] Identificar hot paths tocados e teste de caracterização correspondente.
- [ ] Confirmar que não há migration destrutiva nem mudança de default.

### Durante

- [ ] Escrever teste que falha antes da implementação.
- [ ] Injetar relógio, DB, rede e aleatoriedade nos testes.
- [ ] Não fazer chamadas reais a Shopee, WhatsApp ou Instagram.
- [ ] Toda query/mutação contém tenant.
- [ ] Erros técnicos são truncados no banco e traduzidos na UI.
- [ ] Caminho `direct` não consulta a fila quando a feature está desligada.

### Antes do merge

- [ ] Testes focados verdes.
- [ ] Suíte completa e arquitetura verdes.
- [ ] `git diff --check` verde.
- [ ] Plano de rollback descrito na PR.
- [ ] Evidência do comportamento direto preservado.
- [ ] PR contra `develop`, nunca `main`.

### Depois do deploy em staging

- [ ] Smoke da automação direta existente.
- [ ] Conferir cron, erros, tempo de tick e memória.
- [ ] Validar somente a capacidade liberada naquele sprint.
- [ ] Se houver qualquer envio inesperado, desligar ambas as flags e bloquear o
      rollout; não “corrigir em produção”.

---

## 5. Cenários de regressão que precisam permanecer na suíte

1. Automação criada antes da migration envia normalmente.
2. Flag ausente e flag inválida são indistinguíveis da feature desligada.
3. Automação `review` com flag desligada não envia e não vira `direct`.
4. Aprovação não envia dentro da request HTTP.
5. Descoberta não altera nenhum contador/data de entrega.
6. Troca de destino/template invalida snapshots vivos sem publicá-los.
7. Pausar ou perder plano impede entrega, mas preserva os itens.
8. Remover automação elimina seus itens por cascade, sem tocar em outra.
9. Duplo tick/duplo clique não cria ou envia duplicata.
10. Falha parcial multicanal retenta somente o destino pendente.
11. Restart entre claim e envio é recuperado por lease.
12. Fila revisada grande não bloqueia automações diretas nem carrega histórico
    inteiro em memória.
13. Usuário não consegue ler/mutar item de outro tenant.
14. Limpeza e LGPD não deixam órfãos.
15. Mobile 375 px permite ler o post inteiro e operar ações.

---

## 6. Definição de pronto da iniciativa

A iniciativa só está concluída quando:

- automações existentes seguem inalteradas e isso está coberto por testes;
- a cliente consegue optar por revisão, ver o post exato, aprovar e remover;
- nenhum item não aprovado pode alcançar os canais;
- a entrega aprovada respeita os mesmos gates e proteções atuais;
- concorrência, retry, restart, expiração e multicanal foram exercitados;
- suporte possui diagnóstico e rollback read-only/documentado;
- piloto em staging e piloto com clientes foram concluídos sem regressão;
- rollout geral permanece opt-in e reversível.

Até todos esses itens estarem cumpridos, a feature permanece “em implantação”,
mesmo que a interface já exista.
