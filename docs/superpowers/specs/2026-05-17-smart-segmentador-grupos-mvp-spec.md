# Smart Segmentador de Grupos (MVP) — Especificação Funcional

Data: 2026-05-17  
Escopo: Aba **Envio de Mensagens** com destino exclusivo para **grupos e canais**.

## 1) Objetivo do MVP

Permitir que o operador selecione com segurança e rapidez **quais grupos/canais receberão uma campanha**, combinando:

- seleção manual;
- seleção por filtros;
- recomendação automática “Top N” baseada em score.

O MVP deve reduzir seleção “no olho”, evitar saturação e aumentar previsibilidade de performance por destino.

---

## 2) Escopo funcional (MVP)

### Incluído

1. Listagem de grupos/canais conectados.
2. Seleção manual com checkbox por item.
3. Filtros de seleção (atividade, tamanho, score, cooldown, tags).
4. Modo “Selecionar Top N recomendados”.
5. Resumo pré-envio com contagens e estimativa.
6. Validações de bloqueio (sem destino, cooldown, score mínimo opcional).

### Fora de escopo (pós-MVP)

1. IA generativa de copy por cluster.
2. A/B automático completo (winner autopromote).
3. Benchmark externo entre contas.
4. Predição de conversão com modelo supervisionado.

---

## 3) Definições e entidades

### Destino
Representa um grupo ou canal elegível para envio.

### Campos do destino (MVP)

- `id` (string, obrigatório): identificador único interno.
- `platformId` (string, obrigatório): id do grupo/canal na plataforma.
- `type` (enum: `group` | `channel`, obrigatório).
- `name` (string, obrigatório).
- `participantsCount` (number, opcional; default `0`).
- `lastActivityAt` (datetime, opcional).
- `lastSentAt` (datetime, opcional).
- `sendsLast7d` (number, default `0`).
- `score` (number 0-100, default `50`).
- `cooldownUntil` (datetime, opcional).
- `tags` (array string, default `[]`).
- `status` (enum: `active` | `warm` | `cold`, derivado).
- `isEligibleNow` (boolean, derivado: fora de cooldown e não bloqueado).

### Campanha (recorte necessário para seleção)

- `campaignId` (string).
- `objective` (enum: `awareness` | `traffic` | `conversion`).
- `scheduledAt` (datetime opcional).
- `scoreThreshold` (number opcional, default vazio).
- `maxDestinations` (number opcional).

---

## 4) Regras de negócio

1. **Elegibilidade mínima**: destino só pode ser selecionado se estiver conectado e não bloqueado por regra rígida do sistema.
2. **Cooldown**: se `cooldownUntil > now`, destino aparece com estado “em cooldown”.
   - Comportamento padrão MVP: permitir visualizar, mas não selecionar por default.
3. **Score mínimo opcional**: quando definido (`scoreThreshold`), remover da seleção automática itens com `score < threshold`.
4. **Limite de destinos**: se `maxDestinations` definido, impedir seleção acima do limite com feedback imediato.
5. **Top N recomendado**:
   - Ordenação primária: `score desc`.
   - Desempate: `lastActivityAt desc`, depois `participantsCount desc`.
   - Sempre respeita elegibilidade e filtros ativos.
6. **Filtros são cumulativos (AND)**, exceto tags com modo configurável:
   - `tagsMode = any` (padrão) ou `all`.
7. **Persistência de rascunho**: filtros e seleção ficam salvos durante a sessão da campanha.
8. **Resumo obrigatório pré-envio**: exibir total selecionado, quantos foram excluídos por cooldown/score e alcance potencial (soma de `participantsCount`).

---

## 5) Critérios de score (MVP simplificado)

Score inicial simples, determinístico:

- Base: 50 pontos.
- +20 se atividade recente (última atividade <= 7 dias).
- +15 se resposta/engajamento histórico acima da mediana interna (quando dado existir).
- -20 se alta saturação (`sendsLast7d` acima do limite configurado).
- -15 se tendência de queda (2 campanhas seguidas abaixo da mediana).
- Clamp final entre 0 e 100.

> Observação: no MVP, se faltarem dados históricos, manter score base e aplicar apenas sinais disponíveis.

---

## 6) Estados de UI

## 6.1 Estados da tela

1. **Loading inicial**
   - Skeleton para lista e filtros.
2. **Lista carregada**
   - Tabela/cards com paginação virtual/infinita.
3. **Sem resultados (empty por filtro)**
   - Mensagem contextual + ação “limpar filtros”.
4. **Erro de carregamento**
   - Banner com retry.

## 6.2 Estados por destino

- `selected`
- `unselected`
- `disabled_cooldown`
- `disabled_blocked`
- `recommended` (badge)

## 6.3 Estados das ações

- Botão “Selecionar Top N”:
  - habilitado quando há elegíveis;
  - desabilitado quando zero elegíveis.
- Botão “Continuar/Enviar”:
  - desabilitado com zero selecionados;
  - habilitado com >=1 selecionado e sem erro bloqueante.

## 6.4 Feedbacks de UX

- Toast de sucesso: quantidade adicionada/removida.
- Aviso não bloqueante: destinos ignorados por cooldown/score.
- Erro bloqueante: excedeu `maxDestinations`.

---

## 7) Campos de filtro (MVP)

1. **Tipo de destino**: Todos | Grupos | Canais.
2. **Busca textual**: nome contém.
3. **Tamanho mínimo/máximo**: `participantsCount`.
4. **Atividade recente**: últimos 7/14/30 dias.
5. **Score mínimo**: slider 0-100.
6. **Saturação**: envios últimos 7 dias <= X.
7. **Cooldown**: ocultar em cooldown (toggle).
8. **Tags**: multi-select + modo any/all.

---

## 8) Fluxo principal do usuário

1. Usuário abre aba de envio e cria/edita campanha.
2. Sistema carrega destinos e aplica filtros default.
3. Usuário pode:
   - selecionar manualmente; ou
   - aplicar filtros; ou
   - usar Top N recomendado.
4. Sistema mostra resumo (selecionados, excluídos, alcance estimado).
5. Usuário confirma e avança para revisão/envio.

---

## 9) Eventos de tracking (analytics)

Padrão: `snake_case`, com `campaign_id`, `user_id`, `ts`.

1. `group_selector_viewed`
   - Disparo: ao abrir o segmentador.
   - Props: `campaign_id`, `defaults_applied`, `total_destinations_loaded`.

2. `group_filter_changed`
   - Disparo: cada alteração de filtro.
   - Props: `filter_name`, `from_value`, `to_value`, `result_count`.

3. `group_selected`
   - Disparo: seleção manual de 1 item.
   - Props: `destination_id`, `destination_type`, `score`, `in_cooldown`.

4. `group_unselected`
   - Disparo: remoção manual de 1 item.
   - Props: `destination_id`, `reason` (`manual` | `bulk_clear` | `rule_enforced`).

5. `group_bulk_selected`
   - Disparo: ação de “selecionar todos visíveis” ou operação em lote.
   - Props: `selected_count`, `source` (`visible_list` | `filter_result`).

6. `group_top_n_requested`
   - Disparo: clique em Top N.
   - Props: `requested_n`, `eligible_count_before`, `filters_snapshot`.

7. `group_top_n_applied`
   - Disparo: após aplicação com sucesso.
   - Props: `requested_n`, `applied_count`, `skipped_cooldown_count`, `skipped_score_count`.

8. `group_selection_blocked`
   - Disparo: tentativa inválida (cooldown, bloqueado, limite).
   - Props: `destination_id`, `block_reason` (`cooldown` | `blocked` | `max_limit`).

9. `group_selector_reviewed`
   - Disparo: usuário abre/atualiza resumo pré-envio.
   - Props: `selected_count`, `estimated_reach`, `excluded_cooldown_count`, `excluded_score_count`.

10. `group_selector_confirmed`
    - Disparo: usuário confirma seleção.
    - Props: `selected_count`, `selection_mode_mix` (`manual_only` | `filters_only` | `top_n_only` | `mixed`).

11. `group_selector_abandoned`
    - Disparo: saiu da tela sem confirmar após interações.
    - Props: `time_on_screen_sec`, `selected_count`, `last_action`.

---

## 10) Critérios de aceite QA (prontos para desenvolvimento)

## 10.1 Funcional

1. **Seleção manual básica**
   - Dado lista carregada, quando marco um destino elegível, então ele entra na seleção e contador incrementa.

2. **Bloqueio por cooldown**
   - Dado destino com `cooldownUntil > now`, quando tento selecionar, então sistema impede e mostra motivo.

3. **Filtros cumulativos**
   - Dado múltiplos filtros aplicados, então resultados obedecem interseção (AND).

4. **Top N respeita regras**
   - Dado `N=20`, quando aciono Top N, então seleciona até 20 elegíveis já filtrados e ignora inaptos.

5. **Limite máximo de destinos**
   - Dado `maxDestinations=100`, ao tentar exceder, bloqueia ação adicional com feedback.

6. **Resumo pré-envio consistente**
   - Totais no resumo devem bater com estado real da seleção.

7. **Persistência de sessão**
   - Ao navegar ida/volta na campanha, manter filtros e seleção (enquanto sessão ativa).

## 10.2 Tracking

8. **Evento de view único por abertura**
   - `group_selector_viewed` dispara 1x por entrada de tela.

9. **Evento por mudança real de filtro**
   - `group_filter_changed` só dispara se valor mudou.

10. **Paridade top_n_requested vs top_n_applied**
    - Para cada requisição válida deve existir evento de aplicação (ou erro registrado).

11. **Evento de bloqueio com razão correta**
    - `group_selection_blocked.block_reason` deve refletir a regra acionada.

## 10.3 UI/UX

12. **Estados visuais corretos**
    - Badge “recomendado”, ícone/label de cooldown e checkbox desabilitado quando aplicável.

13. **Empty state com recuperação**
    - Sem resultados por filtro deve oferecer ação clara de limpar filtros.

14. **Acessibilidade mínima**
    - Navegação por teclado em seleção e botões principais; labels associados aos campos de filtro.

## 10.4 Não-funcional

15. **Performance com lista grande (mínimo aceitável)**
    - Até 5.000 destinos carregados com paginação/virtualização sem travamento perceptível (> 2s em interações críticas).

16. **Resiliência a falha de API**
    - Em erro de carga, exibir estado de erro + retry sem quebrar a página.

---

## 11) Riscos e mitigação (STRICT)

1. **Breaking change de payload de campanha**
   - Mitigação: versionar contrato (`v1` compatível) e adicionar campos novos como opcionais.
2. **Efeito cascata em agendamento/relatórios**
   - Mitigação: normalizar seleção final em estrutura estável (`destinationIds[]`).
3. **Risco de saturação por bug de filtro**
   - Mitigação: resumo pré-envio obrigatório + limites por campanha.
4. **Isolamento de ambiente**
   - Mitigação: validar MVP apenas em `develop`/staging (3006/3004) antes de qualquer promoção.

---

## 12) Definição de pronto (DoR/DoD)

### DoR (antes de implementar)

- Contrato de API da seleção aprovado.
- Lista de eventos validada com time de dados.
- Regras de cooldown e limite alinhadas com operação.

### DoD (para considerar entregue)

- Todos os critérios de aceite acima validados.
- Eventos chegando no analytics com propriedades corretas.
- Homologado no staging com campanha de teste fim-a-fim.
