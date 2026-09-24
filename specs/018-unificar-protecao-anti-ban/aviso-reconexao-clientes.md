# Aviso às clientes — reconexão do WhatsApp no deploy de `main` (T064)

**Status: RASCUNHO, NÃO enviado, NÃO agendado.** Nada aqui foi confirmado ou
disparado por este pipeline — T064/T065 continuam `[ ]` em `tasks.md` de
propósito. Este arquivo existe para dar à dona do produto um ponto de partida
pronto para revisar, editar e, só então, decidir quando/como enviar.

## Por que este aviso é necessário

O deploy de `develop → main` desta feature toca `src/core/preservationConfig.js`,
`src/core/channelThrottle.js`, os dois módulos novos
(`src/core/antiBanFloor.js`, `src/core/destinationSpacing.js`) e
`src/bot-worker.js` — todos cobertos por `WORKER_CODE_PATHS_RE`
(`scripts/deploy_safe_dashboard.sh`), então o deploy reinicia o
`bot-supervisor` sozinho para os workers carregarem o código novo. Isso
**reconecta todas as sessões WhatsApp de uma vez** (decisão E da spec,
research.md R7) — sem apagar credencial, sem gerar QR novo, mas com o
mesmo spam de "A sincronização foi concluída" no celular de cada cliente que
qualquer reconexão em massa produz.

## O que falta antes de enviar (ação humana)

1. **Definir o horário exato do deploy** com a dona do produto — de
   preferência madrugada de dia útil (menor movimento nos grupos).
2. **Escolher o canal**: painel (banner) e/ou e-mail. O rascunho abaixo serve
   para os dois; ajustar o tom conforme o canal escolhido.
3. **Enviar/agendar com pelo menos 24h de antecedência** ao horário do deploy.
4. Só depois disso, preencher T065 em `plan.md` (quando foi enviado/agendado,
   horário combinado do deploy) — e só então T072 (PR `develop → main`) pode
   ser aberta.

## Rascunho — texto curto (banner do painel)

> **Aviso**: na madrugada de [DATA], vamos atualizar a proteção contra
> banimento do WhatsApp. Sua sessão vai reconectar sozinha — você **não**
> precisa escanear o QR Code de novo. Pode aparecer uma notificação de
> "sincronização concluída" no seu celular; é esperado e não afeta seus
> grupos.

## Rascunho — texto mais completo (e-mail)

> **Assunto:** Manutenção rápida no Anti-banimento — seu WhatsApp reconecta sozinho
>
> Olá!
>
> Na madrugada de [DATA], entre [HORA] e [HORA], vamos aplicar uma melhoria no
> Anti-banimento — a proteção que cuida do ritmo de envio do seu número para
> reduzir o risco de banimento.
>
> Para isso, o robô precisa reconectar ao WhatsApp. Isso acontece **sozinho**,
> sem você precisar fazer nada: não é necessário escanear o QR Code de novo,
> não é necessário reconfigurar nada. Pode aparecer uma notificação de
> "A sincronização foi concluída" no seu celular durante a janela acima — é
> esperado e não afeta os grupos nem as ofertas que já estão configuradas.
>
> Se, depois desse horário, seu robô aparecer desconectado no painel, é só
> abrir Conexão WhatsApp e clicar em Conectar novamente.
>
> Qualquer dúvida, estamos por aqui.

## Não regredir (linguagem)

- Nada de "supervisor", "worker", "deploy", "reconexão em massa" no texto para
  a cliente — só "reconectar sozinho" e "sincronização".
- Não prometer horário exato de término, só a janela.
- Mesmo padrão de outros avisos operacionais do produto (AGENTS.md, seção
  "Plano B da cobrança: o que fazer quando ela quebra em silêncio" e
  "aviso... com pelo menos 24h de antecedência").
