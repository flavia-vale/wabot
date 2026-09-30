# Membros dos grupos e rodízio de convites

## Estado (2026-09-30)
- **Fase 1 (feita):** painel `/painel/membros` — total de membros por grupo-destino + variação 24h/7d/30d.
- **Fase 2 parte 1 (feita, 2026-09-30):** Link Inteligente `/g/<slug>` — rodízio pelo grupo mais vazio. Parte 2 (pendente): aviso ao cliente de "todos lotados"/convite revogado, detecção automática de convite revogado.
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

## Link Inteligente — como funciona (implementado)
- Cliente cria o link no painel (`/painel/link-inteligente`), **escolhe o nome do endereço** (`/g/<slug>`, 3-40 chars, `a-z0-9-`; `src/core/smartLinkPicker.js` recusa reservados como `api`, `g`, `painel`), adiciona grupos de destino. Robô é admin → convite vem por `groupInviteCode` (novo comando IPC `group:inviteCode`: protocol → client → supervisor → sessionCore → `bot-worker.js`). Só guarda o **código** do convite; o redirect só vai para `https://chat.whatsapp.com/<código alfanumérico>` (validado na entrada e na saída).
- Tabelas: `SmartLink`, `SmartLinkGroup`, `SmartLinkDailyClick` (contador por grupo/dia, fuso SP — não uma linha por clique).
- Escolha (`pickGroup`): menor `membros = última amostra + reserva`; diferença ≤ 5 = empate → alterna pelo menos recente; grupo ≥ teto (padrão 1000, configurável 50-1024) sai; todos cheios → página "Grupos lotados" com **HTTP 200** (5xx pode ser trocado pela página do Cloudflare). Grupo sem amostra ainda só entra se não há grupo medido com vaga.
- **Reserva** = +1 por clique humano desde a última amostra, **em memória** (zera em restart da API → até 1 h de folga; a próxima amostra corrige). Robô de checagem/preview (UA não humano) recebe o redirect mas não conta nem reserva.
- Público: `src/api/routes/smartLinkPublic.js` (sem prefixo, como `/r/:hash`); Next repassa em `dashboard/app/g/[slug]/route.js`. `no-store`, `X-Robots-Tag: noindex`, `Disallow: /g/` no robots. Limite por IP 120/min (folgado por causa de CGNAT; `SMART_LINK_RATE_MAX`). Cache de 10 s da configuração do link (pausar/editar leva até 10 s).
- **Cloudflare:** garantir que `/g/*` NÃO seja cacheado (senão os cliques não chegam e o rodízio congela).
- Deploy: comando novo `group:inviteCode` vive no worker → em `remote` só vale após `pm2 restart bot-supervisor --update-env` (reconecta TODAS as sessões — anunciar). Em `inline`, o restart da API já basta. Migration `20260930180000_smart_link` passa por staging antes de prod.
- Plano: `canUseSmartLinks` = PRO/Trial (`FEATURE_REQUIRES_PRO`, feature `smart_links`); migra para Escala depois.
- Diagnóstico rápido: "link manda para grupo cheio" → conferir `GroupMemberSample` recente do grupo (job horário) e se o convite ainda é válido (botão "Atualizar convite").

## Revisão crítica 2026-09-30 (o que foi achado e corrigido)
Achados com dado (simulação/teste), todos corrigidos com teste:
- **Variação "24 h" media ~18 h** com amostras horárias (escolhia a amostra mais nova depois do corte). Agora pega a **mais próxima** do alvo (tolerância 3 h; 12 h em janelas longas) e ancora na **última medição**, não em "agora" (sessão caída comparava dado velho com janela que ele nunca cobriu).
- **Tamanho 0 era aceito**: resposta truncada do WhatsApp gravava 0 → o grupo parecia vazio e recebia TODO o tráfego. 0/ausente = desconhecido (worker e job).
- **Reserva por linha do link, não por grupo**: o mesmo grupo em dois links não compartilhava a reserva. Agora a chave é o grupo.
- **Amostra velha (> 24 h)** (sessão fora do ar / robô removido do grupo) valia como medida. Agora o grupo vira "sem medida" e só recebe tráfego se não há grupo medido com vaga.
- **Escrita por clique no SQLite** competiria com os envios do robô num link viral. Agora cliques são somados em memória e gravados em lote a cada 5 s (e ao fechar a API; queda seca perde ≤ 5 s de contagem, nunca o redirect).
- **Virada do cache** (10 s) mandava todos os acessos simultâneos ao banco. Agora 1 consulta em andamento por endereço.
- **Limite por IP de 120/min bloquearia gente real** (CGNAT das operadoras). Agora: geral 1200/min (`SMART_LINK_RATE_MAX`) + limite só para ERROS de endereço 30/min (`SMART_LINK_MISS_MAX`) contra varredura.
- **Endereço apagado voltava para o mercado**: outra pessoa pegaria o tráfego de um link já divulgado. Agora apagar é soft delete (`deletedAt`); só a mesma dona reativa.
- **Grupo recém-adicionado ficava até 1 h sem amostra** (e sem tráfego, sendo o mais vazio). Agora mede na hora (não trava a resposta; falha não derruba o cadastro).
- `enabled: "false"` (texto) virava `true`; dupla adição simultânea dava 500. Agora 400 / 409.

## Limitações conhecidas (não corrigidas — decisão de produto ou fora de escopo)
- **Grupo com aprovação de entrada**: clique vira pedido, não membro; o total não sobe e o grupo parece vazio para sempre. O rodízio não detecta.
- **Convite revogado / robô deixou de ser admin**: o cliente cai numa página de "link inválido" do WhatsApp. Só se corrige com "Atualizar convite". Detecção automática = parte 2.
- **Plano vencido**: o link público continua redirecionando (a amostragem para). Decidir se corta na hora (prejudica o público da cliente) ou após carência.
- **Preview do link** (colar `/g/...` no WhatsApp): o app de quem envia busca o link e conta 1 clique/vaga; a prévia mostra o grupo sorteado naquela hora.
- **Reserva em memória**: zera se a API reiniciar (até 1 h de folga). Cliques ≠ entradas (parte não entra); a amostra horária corrige.
- **Grupo apagado em Espelhamento** sai do link em cascata, sem aviso.
- **Sem troca ao vivo de cap para baixo**: reduzir o teto tira o grupo do rodízio no próximo cache (≤ 10 s).
- `req.ip` atrás de proxy segue `trustProxy` (XFF): limite por IP é anti-abuso, não segurança forte.
