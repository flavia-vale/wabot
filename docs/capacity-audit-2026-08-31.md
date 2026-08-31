# Relatório de capacidade da VPS — 2026-08-31

## Veredito executivo

**Estado geral: atenção alta, mas sem saturação neste instante.** A máquina não
estava lenta durante a amostra: CPU e disco ficaram quase ociosos. O risco está
na memória e na margem para crescer. Há aproximadamente 2,9 GiB de RAM
disponível, mas 1,5 GiB já foi deslocado para swap e houve leitura ativa de swap
na janela. Vinte processos filhos do supervisor ocupavam, em RSS somado, cerca
de 4,78 GiB; o maior marcava aproximadamente 552 MiB.

Em linguagem simples: **o servidor atende a carga tranquila de agora, porém não
há evidência suficiente para prometer que aguenta uma promoção ou novas sessões
sem degradação**. CPU não é o problema atual. A primeira restrição provável é
RAM; a segunda é o disco, já em 75%.

## Evidências observadas

| Área | Medição | Estado | Tradução leiga |
|---|---:|---|---|
| CPU | 4 vCPU; 94–99% ociosa; load 0,15/0,51/0,34 | Saudável na amostra | O processador estava sobrando. |
| RAM | 7,6 GiB total; 2,9 GiB disponível (37,8%) | Atenção | Ainda há fôlego agora, mas os bots já ocupam a maior parte da memória útil. |
| Swap | 1,5 GiB ocupada; houve `swap-in`, sem `swap-out` sustentado | Atenção | O servidor precisou buscar dados que haviam sido empurrados para o disco; é vestígio de pressão anterior, não RAM extra. |
| Workers | 20 filhos do supervisor na listagem; RSS mediano ~229 MiB, p95 amostral ~393 MiB, máximo ~552 MiB | Atenção alta | Um bot está bem maior que os demais e deve ser acompanhado por PID/sessão. |
| Disco | 27/38 GiB; 9,2 GiB livres; 75% usado | Atenção | Não está cheio, mas entrou na faixa de planejamento. |
| I/O | pico observado de 5,6% de utilização, latências baixas | Saudável na amostra | O disco não estava formando fila. |
| Inodes | 15% usados | Saudável | Não há risco de acabar a quantidade de arquivos agora. |
| Banco | produção ~294 MiB + WAL ~6,9 MiB; staging ~34 MiB + WAL ~4,1 MiB | Saudável na amostra | O banco ainda é pequeno; faltou o `quick_check` para confirmar integridade. |
| PM2 | serviços principais online | Parcial | Há sinais operacionais que precisam de investigação, descritos abaixo. |

RSS somado não é igual a RAM física consumida, pois processos podem compartilhar
páginas. Ele é útil para comparar workers e localizar os maiores, mas não deve
ser subtraído diretamente da RAM disponível.

## Pontos que exigem ação

### P0 — apagar o relatório antigo e tratar como potencialmente sensível

A coleta executada ainda usou `pm2 prettylist`. Esse comando imprime o ambiente
completo dos processos. O filtro antigo apagava linhas cujo **nome** continha
`secret`, `token`, `password`, `cookie`, `authorization` ou `env`, mas não era
uma allowlist e podia deixar outras chaves sensíveis. O arquivo deve ser apagado
da VPS após a análise e não deve ser encaminhado novamente. O coletor novo já
usa uma allowlist de campos do `pm2 jlist`.

```bash
rm -f /tmp/wabot-capacidade.txt
```

Se o arquivo bruto foi enviado a terceiros, armazenado em ticket público ou
publicado fora deste atendimento, faça inventário e rotação das chaves presentes
no ambiente. O trecho recebido expôs IPs de origem SSH, mas não mostrou uma
credencial em claro; isso não prova que o restante do arquivo esteja limpo.

### P1 — não adicionar sessões antes de medir memória por 24 horas

Pela política conservadora atual, uma máquina de ~7.751 MiB reserva pelo menos
~1.550 MiB. Usando o p95 pontual de ~393 MiB por worker, o limite teórico fica em
aproximadamente 15 sessões; mesmo usando o piso de 350 MiB, fica em 17. A
listagem mostrou 20 processos filhos. Isso **não significa que cinco sessões
precisam ser desligadas agora**, porque a medição ainda não conciliou PID com
sessão e o p95 confiável exige histórico. Significa que não existe margem
comprovada para crescer no plano de 8 GB.

Próxima decisão: manter a frota atual, desligar staging fora de validações e
capturar RSS por PID durante 24 h. Se as 20 linhas forem sessões de produção e o
p95 permanecer perto de 393 MiB, planejar 16 GB antes de cadastrar novas sessões
ou realizar uma campanha de grande volume.

### P1 — investigar o worker de aproximadamente 552 MiB

Um filho do supervisor estava em ~552 MiB, acima do piso de planejamento e bem
acima da mediana. Uma fotografia isolada não prova vazamento. O sinal de
vazamento é o mesmo PID crescer continuamente ao longo das horas.

```bash
mkdir -p /tmp/wabot-audit
for i in $(seq 1 288); do
  date -u '+%FT%TZ'
  ps -eo pid,ppid,rss,etime,cmd --sort=-rss | grep 'wabot/src/bot-worker' | grep -v grep
  sleep 300
done | tee /tmp/wabot-audit/workers-24h.txt
```

Não reinicie todos os workers apenas para “limpar RAM”: isso reconecta todas as
sessões e aumenta o risco operacional. Primeiro identifique a sessão/PID e a
tendência.

### P1 — investigar os 1.894 reinícios de `api-staging`

O contador é anormalmente alto, mas é acumulado; sozinho não prova crash loop
agora. O uptime de cinco minutos também pode ter sido causado pelo deploy que
acabou de ocorrer. Verifique timestamps e erros antes de agir:

```bash
pm2 describe api-staging
pm2 logs api-staging --nostream --lines 300
journalctl -k --since '7 days ago' --no-pager | grep -Ei 'oom|killed process|out of memory'
```

Se o contador continuar aumentando sem deploy, staging está instável. Como ele
divide RAM com produção, deixe-o desligado fora da janela de validação.

### P1 — confirmar que `snapshot-cron` está registrado

O processo não apareceu no `pm2 status`. Como ele usa `autorestart: false` e
agenda diária, pode ficar parado entre execuções, mas precisa continuar
registrado no PM2 para que o cron dispare. Confirme sem alterar nada:

```bash
pm2 describe snapshot-cron
pm2 logs snapshot-cron --nostream --lines 100
```

Se o `describe` disser que o processo não existe, corrija em uma janela
operacional seguindo o fluxo de staging; não improvise um start em produção sem
confirmar backup e comportamento de execução imediata.

### P2 — controlar crescimento do disco e logs

O disco entrou exatamente no limiar de atenção (75%). Os repositórios somam
~2,9 GiB, enquanto o PM2 informou ~3,58 GiB de logs globais. Ainda há 9,2 GiB,
portanto não é emergência, mas a retenção precisa ser conferida:

```bash
du -sh ~/.pm2/logs
find ~/.pm2/logs -type f -printf '%s %p\n' | sort -nr | head -30
pm2 conf pm2-logrotate
```

Não use `pm2 flush` às cegas. Primeiro identifique os arquivos e preserve o
período necessário para investigar os reinícios.

## O que está saudável

- A VPS estava há 66 dias ligada, sem sinal de reboot frequente na amostra.
- CPU tinha grande folga; escalar vCPU agora não resolveria o risco principal.
- I/O e `iowait` estavam baixos, inclusive durante o pequeno pico de escrita.
- Inodes estão folgados.
- Os tamanhos do SQLite e WAL não indicam, isoladamente, banco fora de controle.
- API, dashboard, supervisores e espelhos de staging apareceram online.

## O que ainda não foi medido

A saída foi tomada pelo `pm2 prettylist` e consumiu as primeiras 800 linhas;
por isso não chegaram as seções de rede, Redis/BullMQ, `quick_check` do SQLite,
OOM e erros filtrados. Também não houve amostra durante promoção. Assim, este
relatório **não confirma** backlog, latência captura→envio, rate limit de APIs,
integridade do banco, persistência AOF ou estabilidade do WhatsApp.

Depois de promover o coletor corrigido, faça uma nova coleta e retorne somente
as seções ausentes, nunca o ambiente do PM2:

```bash
cd ~/wabot
git log -1 --oneline -- scripts/collect-capacity-audit.sh
grep -n 'pm2 jlist' scripts/collect-capacity-audit.sh
./scripts/collect-capacity-audit.sh /tmp/wabot-capacidade-segura.txt
```

## Plano simples

1. **Hoje:** apague o relatório antigo; não aumente sessões; investigue o worker
   de 552 MiB, os reinícios de staging e o cadastro do snapshot cron.
2. **Nesta semana:** desligue staging quando ocioso, acompanhe RSS por 24 h e
   revise os 3,58 GiB de logs.
3. **Antes da próxima promoção:** execute a coleta segura durante 15 minutos de
   carga e confirme fila, latência, 429, desconexões e OOM.
4. **Antes de crescer a frota:** se os números se confirmarem, subir de 8 para
   16 GB traz mais benefício imediato que adicionar CPU.

