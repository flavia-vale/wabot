# Fase 5 — Kickoff de implementação (contexto + plano)

> **Para a próxima sessão:** este documento é o ponto de entrada
> autocontido. Leia-o **antes** de abrir código. Ele explica a dor,
> a motivação, as decisões já tomadas e referencia os planos detalhados.

Status: planejamento concluído, **implementação não iniciada**.
Última revisão: 2026-05-18.
Branch de planejamento: `claude/whatsapp-api-research-onYp3`.

---

## 1. Dor e motivação

### 1.1. O contexto do produto

O BOTinho é um bot de espelhamento de ofertas de afiliado: monitora
grupos/canais de terceiros, extrai links, converte para a tag de
afiliado do cliente e republica nos grupos/canais próprios do cliente.

Em 2025–2026 o WhatsApp **vem banindo grupos de ofertas em massa**.
Donos desses grupos estão migrando para **Canais do WhatsApp**
(newsletter/broadcast unidirecional). As Fases 0–4 do plano principal
(`docs/whatsapp-channels-implementation-plan.md`) já cobriram a
adaptação técnica para canais — leitura, postagem, UI no dashboard.

### 1.2. A dor real que sobrou — anti-ban

Sem proteção, qualquer canal-destino que o BOTinho gerencie está a
poucos dias do banimento. Os motivos são objetivos, não paranoia:

1. **O ToS principal do WhatsApp proíbe explicitamente o que fazemos.**
   Cláusulas verbatim citam "create software or APIs that function
   substantially the same as our Services", "bulk messaging,
   auto-messaging, auto-dialing", "non-personal use of our Services
   unless otherwise authorized". A defesa não é jurídica — é
   **estatística**, ou seja, parecer humano o suficiente para não
   acionar os classificadores da Meta.

2. **Canal tem 1 único admin.** Se o chip cai, **o canal morre junto**
   e o cliente perde todos os seguidores acumulados. É o cenário mais
   caro para o cliente: meses de audiência perdidos.

3. **A Meta não notifica quando sua reputação cai.** O `quality
   rating` recalcula silenciosamente com base em block rate e spam
   reports. Quando o cliente percebe, o canal já está em shadowban
   ou banido. Sem detecção precoce, **a primeira notícia é o
   incidente**.

4. **Postagem em canal é vetor mais frágil que em grupo.** Em grupo
   tem várias pessoas conversando, replies, reactions — vida.
   Em canal só o admin posta, então **qualquer regularidade vira
   fingerprint óbvio**: mesmo texto, mesma hora, mesma imagem,
   replicado em N canais simultâneos.

5. **Já observamos canais caindo sem padrão claro**. Não temos
   visibilidade de saúde pós-envio hoje — só sabemos que o post foi
   enviado, não que foi entregue, lido ou denunciado.

### 1.3. O que mudou a planejamento

A Fase 5 original do plano principal era enxuta — cobria só anti-ban
no `newsletterFollow` (limite diário, warmup, jitter). Em
2026-05-18 a usuária pediu brainstorm e pesquisa nas regras oficiais
da Meta. Resultado:

- **Vetor de risco mais grave não era o follow, era a postagem.**
  Fan-out de 1 fonte → N canais-destino do mesmo cliente é o que
  mais cheira a farm.
- **Detecção precoce é tão importante quanto prevenção.** Sem ela,
  shadowban silencioso vira ban total sem aviso.
- **Pesquisa nas guidelines oficiais** revelou riscos adicionais:
  título enganoso, IP, impersonação de marca, threshold de 5–10
  reports para revisão automática.
- **Plano de recuperação virou obrigatório**, não opcional, dado o
  SPOF de 1 admin/canal.

A Fase 5 foi expandida para cobrir 5.A → 5.F (commits `600997f`,
`1d97909` na branch `claude/whatsapp-api-research-onYp3`).

---

## 2. Decisões consolidadas (não reabrir sem motivo forte)

1. **Stack continua Baileys 6.7.16** (não fazer upgrade para 7.x).
   Justificativa em `whatsapp-channels-implementation-plan.md` §2.2.
2. **Defesa em profundidade, não bala de prata.** Múltiplas camadas
   sobrepostas (ritmo + variação + detecção + recuperação).
3. **Bloco protegido não é tocado.** `src/converters/`,
   `src/detector.js`, `src/credentialHealth.js` ficam intactos.
   Toda mutação de imagem da Fase 5 acontece **depois** do scraper,
   no buffer pronto para envio.
4. **Migrations 100% aditivas** (SQLite `ADD COLUMN ... DEFAULT` +
   tabelas novas). Sem risco de perda de dados.
5. **Conta-probe é opcional do cliente**, mas recomendada — é a
   única forma real de detectar shadowban.
6. **Image mutation respeita** `IMAGE_HIRES_MIN_DIMENSION_PX = 800`
   da PR #422. Se a mutação cair abaixo, pula.
7. **Defaults conservadores.** Cliente pode afrouxar via dashboard,
   mas o default protege.
8. **UI nunca bloqueia** decisão do cliente — só avisa (lint de
   título/copy é warning, não erro).
9. **Critério global de aceite:** 14 dias verde em staging com 1
   probe ativo e ≥ 1 cliente real antes de `develop → main`.

---

## 3. As 4 frentes da Fase 5

### 5.A. Anti-ban no follow de canais-fonte
Limite diário de novos `newsletterFollow`, warmup por idade de
sessão, jitter humano, pausa automática em `stream:error`.
**Risco baixo — extensão do que já existia.**

### 5.B. Anti-ban na postagem em canais-destino
Velocity scheduler (intervalo mínimo, burst cap, quiet hours,
daily cap), stagger temporal entre destinos, variação de copy,
variação de imagem (mutação fora do bloco protegido), humanização
opcional (reactions, presence). **Risco médio — caminho novo de
envio, mas isolado de conversão.**

### 5.C. Detecção precoce
Tabela `ChannelHealth` com status 🟢🟡🔴⚫, listeners de
`stream:error` e erros de envio, latency drift, probe ativo com
chip secundário, sinal indireto via cliques de afiliado. Pausa
automática em sinal vermelho/crítico. **Risco médio — falso
positivo pausa canal saudável (mitigado por threshold conservador
e botão de unpause).**

### 5.F. Recuperação pós-incidente
Snapshot diário de `newsletterMetadata` por canal, botão "Recriar
canal" no dashboard (cliente cria canal novo no app, bot reconfigura
e re-roteia targets). **Risco baixo — funcionalidade aditiva.**

### Bônus: conformidade Meta (5.E)
Guardrails de UI (impersonação de marca, claims enganosos, título
genérico) e "report risk score" por canal. **Risco baixíssimo —
warnings, sem ações automáticas.**

---

## 4. Plano técnico PR-a-PR

**O detalhamento executável está em
`docs/whatsapp-channels-phase-5-execution.md`** — schema completo,
arquivos a criar/tocar, APIs internas, regras de transição,
critérios de aceite por PR, riscos e mitigações.

Ordem recomendada (já no doc executável):

| # | PR | Resumo | Bloqueia próximo? |
|---|---|---|---|
| 1 | **5.0 Foundations** | Migrations + skeletons. Zero comportamento | Sim, todos dependem |
| 2 | **5.A Follow guard** | `followGuard`, warmup, listener stream:error | Não |
| 3 | **5.C.1 Health** | `ChannelHealth`, listeners, gradação 🟢🟡🔴⚫ | Sim, 5.B.1 usa `pausedUntil` |
| 4 | **5.B.1 Throttle** | Velocity scheduler | Não |
| 5 | **5.F Snapshot** | Cron + recriação. Paraquedas barato | Não |
| 6 | **5.B.2 Variação** | Copy + imagem + stagger | Não |
| 7 | **5.C.3 Probe** | Sessão secundária observa | Não |
| 8 | **5.E.2 Lint UI** | Warnings de conformidade | Não |
| 9 | **5.E.3 Risk score** | 0–100 por canal | Não |
| 10 | **5.C.4 Cliques** | Drop afiliado. **Bloqueado se tracker não existir** | — |
| 11 | **5.B.3/4 Humanização** | Reactions, presence. **Opcional** | — |

**Princípio do ordering:** detectar antes de regularizar antes de
variar. Health (5.C.1) vem antes do scheduler (5.B.1) porque sem
detecção a gente não sabe se os defaults do scheduler estão certos.

---

## 5. Schema novo (sumário)

Detalhes em `whatsapp-channels-phase-5-execution.md` PR-5.0.

```
BotConfig (novos campos):
  maxDailyFollows, channelMinIntervalSec, channelBurstCap,
  channelBurstWindowSec, channelDailyCap, channelStaggerJitterMs,
  channelQuietHoursJson, imageMutationEnabled, copyVariationPoolJson,
  probeAccountSessionId, probeEnabled

FollowLog          — quem seguiu o quê, quando, status
ChannelHealth      — status por canal-destino, errorRate1h,
                     latencyP95, pausedUntil, lastProbeSeenAt
ChannelThrottle    — contadores de burst/dia por canal
ChannelSnapshot    — backup diário de metadata (paraquedas)
```

---

## 6. Cheat sheet de defaults

```
maxDailyFollows          3
channelMinIntervalSec    30
channelBurstCap          6 em 10 min
channelDailyCap          (sem default — opcional)
channelStaggerJitterMs   90000  (90s)
channelQuietHours        00:00–06:00 BRT
imageMutationEnabled     true
probeEnabled             false (cliente opta)
warmup follow            <1d:1, <3d:1, <7d:2, >=7d:N
health pause após        3 falhas 403 consecutivas, 1h
snapshot retention       30/canal
```

---

## 7. Linguagem comercial (para divulgação)

Linguagem cliente-facing dos 4 pilares + comparação de mercado +
disclaimer honesto: **gerada nesta mesma sessão de brainstorm**.
Pode ser reaproveitada na landing/onboarding. Se quiser persistir,
mover para `docs/marketing/anti-ban-pitch.md` (ainda não criado).

Os 4 pilares para o cliente:
1. 🛡️ **Ritmo humano de publicação**
2. 🎭 **Variações automáticas que quebram fingerprint**
3. 🔍 **Detecção precoce — descobre antes da Meta agir**
4. 🪂 **Plano de recuperação rápida**

Recado honesto obrigatório no material:
> "Não existe garantia 100% contra banimento. O Termo de Uso do
> WhatsApp restringe automação de qualquer tipo. O BOTinho faz
> defesa em profundidade — várias camadas sobrepostas baseadas em
> pesquisa direta nas regras oficiais da Meta. Use sempre chip
> dedicado, nunca o pessoal."

---

## 8. Riscos de execução (por onde a coisa pode dar errado)

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Migration 5.0 corrompe `BotConfig` em prod | Baixa | Testar em cópia de `staging.db` antes; é só `ADD COLUMN DEFAULT` |
| 5.A trava follows legítimos | Média | Default 3/dia é folgado; UI mostra contador; cliente sobe se precisar |
| 5.C.1 falso positivo pausa canal saudável | Média | Threshold conservador (3 falhas consecutivas, não % bruto); botão "force unpause" |
| 5.B.1 atraso visível irrita cliente | Média | Métrica de latency exposta; defaults documentados |
| 5.B.2 mutação de imagem cai abaixo 800px | Baixa | Validação pós-mutação obrigatória; pula se cair |
| 5.C.3 probe seguir muitos canais a derruba | Baixa | Probe segue só destinos do tenant (3–20), não escala |
| Cliente desabilita tudo e culpa o bot | Média | Toggles claros, defaults marcados como "recomendados"; log de quem mudou o quê |

---

## 9. Documentos relacionados

- `docs/whatsapp-channels-implementation-plan.md` — plano principal
  estratégico (contexto completo, Fases 0–5 com decisões).
- `docs/whatsapp-channels-phase-5-execution.md` — plano executável
  PR-a-PR (este é o **roadmap operacional** para a sessão de dev).
- `AGENTS.md` — regras invioláveis (bloco protegido, image scrapers,
  fluxo de deploy, portas).
- `docs/marketing/` — pasta vazia hoje. Linguagem comercial dos 4
  pilares pode entrar aqui se vier a ser usada.

---

## 10. Próximos passos concretos (para a sessão de dev)

1. **Ler este doc inteiro** + `phase-5-execution.md` (esse tem o
   código real).
2. **Confirmar com a usuária** se mantém a ordem dos PRs sugerida.
3. **Abrir branch** a partir de `develop` (não desta branch de
   planejamento) — sugestão: `feat/phase5-foundations` para o PR-5.0.
4. **Implementar PR-5.0** (migrations + skeletons + testes vazios).
   Validar em staging.
5. **Seguir a tabela §4** PR a PR, com validação em staging entre
   cada um.

> Nada de "tudo de uma vez" — cada PR é mergeable sozinho e
> reversível.

### Importante para qualquer agente de IA que pegar essa task

- **Não mexer no bloco protegido** (`src/converters/`,
  `src/detector.js`, `src/credentialHealth.js`).
- **Não pular staging.** AGENTS.md é claro sobre isso.
- **Não criar PR para `main` direto.** Sempre `feature → develop → main`.
- **Migration aditiva apenas.** Nunca substituir `BotConfig` existente.
- **Image mutation** é **fora** do bloco protegido, **depois** do scraper.
- **Validar `IMAGE_HIRES_MIN_DIMENSION_PX = 800`** após qualquer
  manipulação de buffer.
