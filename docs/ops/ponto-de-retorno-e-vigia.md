# Ponto de retorno e vigia do ambiente

## Ponto de retorno desta liberação (develop → main, 2026-10-01)

- **Branch de retorno:** `ponto-retorno/2026-10-01-antes-do-merge-main`
- **Commit exato (main antes do merge):** `29daf0f49a0df3d6905c395dc4f46d637e48248e`
- Por que branch e não tag: o ambiente onde foi criada bloqueia `git push` de tags
  (só branches passam). Na VPS ou pela página do GitHub (Releases → "Draft a new
  release" → criar tag nova) dá para criar a tag de verdade:
  `git -C ~/wabot tag ponto-retorno-2026-10-01 29daf0f4 && git -C ~/wabot push origin ponto-retorno-2026-10-01`
- **Não apague essa branch** até a liberação estar estável (alguns dias).

### Antes de mergear (2 minutos)
1. `cd ~/wabot && git rev-parse HEAD` — anote (deve ser o commit acima ou main atual).
2. `cd ~/wabot && scripts/backup_prod.sh` — backup novo do banco + auth_info.
3. `pm2 list` — anote processos e contagem de reinícios.
   (Com este PR já na VPS: `BACKUP=1 scripts/ponto_retorno.sh` faz os 3 de uma vez e salva em `~/wabot-pontos-de-retorno/`.)

### Como voltar (código)
- Teste seco (não muda nada): `scripts/voltar_ao_ponto.sh ponto-retorno/2026-10-01-antes-do-merge-main`
- Aplicar: `APLICAR=1 scripts/voltar_ao_ponto.sh <mesmo ponto>` e depois os `pm2 restart` que ele imprime.
  Reiniciar `bot-supervisor` reconecta TODAS as sessões — só se a mudança problemática era do código dos robôs.
- **Atenção:** o próximo push em `main` refaz o deploy da ponta de `main`. Para um retorno
  **definitivo**: `git revert -m 1 <merge>` numa branch → PR para `develop` → staging → `main`.
- **Banco:** a coluna `WaSession.nodeId` fica (vazia, inofensiva para o código antigo). Não apagar nada.
  Só restaurar backup do banco se houve dado corrompido — é decisão separada e pesada.

## Vigia (somente leitura)

| Script | O que faz |
|---|---|
| `node scripts/vigia.mjs` | Relatório 🟢🟡🔴⚪: processos pm2 (reinício novo), memória/swap, disco, API `/ready`, heartbeat do gerenciador, sessões, envios da última hora, fila de comandos, quedas de conexão, idade do backup. |
| `--so-problemas` / `--json` / `--api=URL` / `--estado=ARQ` | Só o que não está verde / saída para máquina / outra porta (staging: `--api=http://127.0.0.1:3004`) / guarda reinícios do pm2 para comparar na próxima leitura. |
| `scripts/vigia_cron.sh` | Roda o vigia a cada execução do cron, guarda log em `~/wabot-vigia/`, avisa (`VIGIA_NOTIFY_CMD`) só quando passa a 🔴. **Não é instalado automaticamente.** Linha sugerida: `*/5 * * * * cd /home/deploy/wabot && scripts/vigia_cron.sh >/dev/null 2>&1` |
| `scripts/ponto_retorno.sh` | Retrato do ambiente (commit, pm2, flags, contagens do banco, backup). `BACKUP=1` roda também o backup. |
| `scripts/voltar_ao_ponto.sh` | Ver "Como voltar". |

Regras: ⚪ = "não consegui medir" e **nunca** conta como verde; só 🔴 devolve código de saída 1.
Limiares ficam em `src/ops/vigia/evaluate.js` (`DEFAULTS`), com testes em `test/vigia-evaluate.test.js`.
Memória: o sinal que decide é o **swap** (política do AGENTS.md). Sem custo de RAM relevante:
rodam e saem (sem processo PM2 novo).

### Para olhar logo após o deploy em main
`node scripts/vigia.mjs` (agora, +10 min, +1 h). Esperado em modo `remote`: aviso inofensivo
"código novo não carregado pelos robôs" até o restart planejado do supervisor.
Se 🔴 em sessões/envios/memória → comparar com o retrato salvo e decidir o retorno.

## Plano anti-queda do pm2 (RCA 2026-10-01) — o que ativar, quando quiser

Nada abaixo liga sozinho. Cada item é independente e reversível.

| Item | Como ligar | Como desligar |
|---|---|---|
| Vigia com e-mail a cada 3 min | `crontab -e` → `*/3 * * * * cd /home/deploy/wabot && scripts/vigia_cron.sh >/dev/null 2>&1` (o e-mail usa o SMTP/`ADMIN_ALERT_EMAIL` da API) | apagar a linha; ou `VIGIA_EMAIL=0` na linha |
| Monitor externo (avisa até com a VPS fora) | num serviço grátis de uptime, checar `https://espelhagrupos.com.br/api/ready/bots` a cada 5 min, alerta em 503/timeout | apagar o monitor |
| Aviso ao entrar na VPS | `echo '[ -x ~/wabot/scripts/aviso-login.sh ] && ~/wabot/scripts/aviso-login.sh' >> ~/.bashrc` | apagar a linha do `~/.bashrc` |
| needrestart só lista | já aplicado em 01/10 (`/etc/needrestart/conf.d/50-wabot.conf`) | apagar o arquivo |

Já valem no próximo deploy (sem ação): trava de um deploy por vez,
`pm2 save` protegido, log do pm2 com nome fixo (a partir do próximo
`delete`+`start` de cada app), vigia acusando app sumido, `/ready/bots`.

RAM (REGRA #1): o cron roda um `node` de ~80–120 MB por 2–5 s a cada 3 min e
sai; nada fica residente. `/ready/bots` usa cache de 20 s.
