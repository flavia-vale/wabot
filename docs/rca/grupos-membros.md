# Membros dos grupos e rodízio de convites

## Estado (2026-09-30)
- **Fase 1 (feita):** painel `/painel/membros` — total de membros por grupo-destino + variação 24h/7d/30d.
- **Fase 2 (pendente):** Link Inteligente (`/g/<slug>`) com rodízio pelo grupo mais vazio.
- **Fase 1.5 (pendente):** entradas/saídas em tempo real via `group-participants.update` (hoje o handler só manda boas-vindas em `src/bot-worker.js`).

## Como funciona a Fase 1
- Passada horária **dentro da API** (`startGroupMemberSamplesSweep` em `src/api/server.js`, 1ª passada 5 min após subir) → `runGroupMemberSampleSweep` em `src/jobs/groupMemberSamples.js`. Env: `GROUP_MEMBER_SAMPLES_ENABLED=false` desliga; `GROUP_MEMBER_SAMPLES_INTERVAL_MS`. Sem processo PM2 novo.
- **RCA 2026-09-30:** a 1ª versão era um cron PM2 separado e gravou `users:0` no staging (`inline`): `isRunning` = `bots.has()` do próprio processo, e o cron não tem sessão nenhuma. Sessões só são visíveis à API (inline) ou via supervisor (remote, `isRunning` assíncrono). Mesma limitação do `snapshot-cron` em `inline`. Diagnóstico: log da API `amostra de membros: passada concluída` com `users/captured/skipped`.
- Fonte do número: `listGroups` (worker → `groupFetchAllParticipating`), que agora devolve `size` além de `waJid`/`name`. **Worker antigo não devolve `size`** → job pula o grupo (`skipped`). Como o worker roda no supervisor, o dado só aparece após `pm2 restart bot-supervisor --update-env` (reconecta TODAS as sessões — anunciar).
- Tabela `GroupMemberSample` (só quantidade; **nunca guardar telefones — LGPD**). Retenção: horária por 7 dias, depois 1/dia até 90 (`src/core/groupMemberStats.js`).
- API `GET /api/group-members`; gate `canUseGroupMembers` (PRO/Trial). Sem amostra de ~24h/7d/30d a variação é `null` (tela mostra "coletando…"), nunca inventada.
- Sessão desconectada = sem amostra nova; tela marca "sem dado recente" após 3h.

## Plano / decisões da dona do produto
- Liberado para PRO agora, com aviso na tela: "Em breve apenas no plano Escala". Rodízio também será do Escala (junto das múltiplas sessões).
- Robô é admin dos grupos → pode gerar o convite (`groupInviteCode`) sozinho; a cliente não cola link.
- Consulta a cada 1 h (não por segundo). Espaço de 2 s entre sessões no job (anti-ban).

## Regras do rodízio (Fase 2 — especificado, não implementado)
Escolhe o grupo elegível com menos membros; teto por grupo (padrão 1000 — **confirmado pela dona do produto em 2026-09-30**; limite do WhatsApp 1024, a confirmar); empate/≤5 de diferença alterna; contador de reserva +1 por clique entre amostras; grupo cheio/convite revogado sai do rodízio; todos cheios → página "lotado" + aviso. Endpoint público: rate limit, redirect só para `chat.whatsapp.com`, sem cache no Cloudflare, `noindex`, contar cliques (padrão `AffiliateClick`). Divulgação em todos os lugares (bio, site, anúncios, ofertas) → dimensionar rate limit para pico.
