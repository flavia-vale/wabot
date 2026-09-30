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

## Rodízio v2 (PR 2 do plano de 30/09 — margem de 95%)
Decisões da dona: ranking pelos **membros atuais**; cliques só mostram no card.
- **Escolha** (`pickGroup`): 1) grupos medidos abaixo da margem (95% da capacidade, `marginMembers`): o de menos membros (empate ≤ 5 alterna); 2) grupo sem medição, só se nenhum medido tem vaga; 3) **reserva**: todos na margem mas < 100% → o menos cheio (nunca página morta enquanto o WhatsApp aceita); 4) todos em 100% → "Grupos lotados".
- **Cliques = freio, não ranking**: a reserva em memória (+1 por clique humano desde a última medição) só entra na checagem de margem/teto, para o grupo não estourar entre duas medições. Não mexe em quem é "o de menos membros".
- **Medição adaptativa** (`runHotSampleSweep`, timer na API): usuário com grupo ≥ 80% da capacidade (amostra < 24 h, grupo ativo) é medido a cada 10 min (`SMART_LINK_HOT_SAMPLE_MS`, mín. 2 min); os demais seguem de hora em hora. 1 `listGroups` por usuário quente por passada, com pausa de 2 s entre usuários; usuário com 2 links quentes é medido uma vez. Custo: só quem importa.
- Risco conhecido: a cada 10 min `groupFetchAllParticipating` em conta com muitos grupos é pesado; se o WhatsApp reclamar (rate-limit), subir o intervalo ou trocar por `groupMetadata` só dos grupos quentes.

## Avisos de link enchendo (PR 3 do plano de 30/09)
- **Quando avisa** (`src/core/smartLinkAlertPolicy.js`, puro): *aviso* = TODOS os grupos ativos medidos passaram de 90% da capacidade; *urgente* = todos em 100% (o link mostra "Grupos lotados"). Sem medição recente (> 24 h) não se conclui nada (nem avisa, nem rearma). Grupo pausado/sem convite não conta como capacidade.
- **Controle de repetição**: 1 aviso por episódio; urgente escala mesmo dentro de 24 h; enquanto continua, lembrete no máx. 1 a cada 24 h e no máx. 2 por episódio. **Rearma** só com algum grupo < 85% ou grupo novo no link (oscilar perto de 90% não gera novo aviso). Aviso/lembrete não saem de 22h às 8h (Brasília); o urgente sai a qualquer hora.
- **Canais** (interruptor por link, ligados por padrão): e-mail (templates `link_inteligente_quase_cheio` e `link_inteligente_lotado`, grupo `link` no catálogo — fora dos tetos semanais e da trava de conta parada; isentos do teto diário) e WhatsApp = mensagem do robô para o **próprio número** da cliente (`sendSelfMessage` com `kind: smart_link_alert[_urgent]`, envelope próprio, motivo `alerta_link_inteligente` no histórico de contatos). Sem sessão conectada o WhatsApp não sai (o e-mail sai). **Hipótese não validada:** a mensagem para o próprio número pode não gerar notificação no celular.
- **Ordem do envio**: o estado é gravado ANTES de enviar (se não gravar, nada é enviado — evita reenvio a cada passada); se nenhum canal entregar, o estado volta e tenta de novo na próxima passada (10 min). Achado na validação com banco real: enviar e só depois gravar reenviaria tudo a cada passada quando a gravação falhasse.
- **Job**: timer na API (`SMART_LINK_ALERT_SWEEP_MS`, padrão 10 min, mín. 2; `SMART_LINK_ALERTS_ENABLED=false` desliga), só lê o banco. Plano vencido/conta inativa/link pausado: não avisa.
- Deploy: o comando de mensagem ao próprio número ganhou o campo `kind` (worker). Em `remote`, vale só após `pm2 restart bot-supervisor --update-env` (reconecta TODAS as sessões — anunciar); sem o restart, o WhatsApp do aviso sairia como "Mensagem do suporte" (worker antigo ignora o `kind`). Migration `20261001110000_smart_link_alerts`.
