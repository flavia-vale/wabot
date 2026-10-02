# Runbook: app sumiu do pm2 / robôs parados

Sinais: e-mail "[Servidor] 🔴 …", vigia com "Sumiram do pm2", `/ready/bots`
com 503, cliente dizendo que nada sai. Causa de 01/10 e defesas:
`docs/rca/deploy-e-infra.md` ("O pm2 perdeu o bot-supervisor").

## Regras de ouro
1. **Uma pessoa por vez.** Avise no grupo antes de mexer. O script abaixo já
   recusa rodar se um deploy ou outra pessoa estiver com a trava.
2. **Nunca `pm2 resurrect` às cegas** — reinicia o que está de pé e pode
   duplicar processos. **Nunca `pm2 restart all`, `kill` ou `update`.**
3. **Não reinicie o que já existe.** Suba só o que sumiu.

## Passo a passo
```bash
cd ~/wabot
scripts/religar-producao.sh            # mostra o que falta e o que faria
APLICAR=1 scripts/religar-producao.sh  # sobe só o que falta, salva e roda o vigia
```
- Saiu com "PARE: … robôs deste ambiente ainda vivos": NÃO suba outro
  supervisor (sessões duplicadas = risco de ban). Mande a saída do `ps` que
  ele mostra para quem cuida da infra.
- Saiu com "Janela de manutenção aberta": alguém está operando — fale com a
  pessoa (`scripts/janela.sh status`).
- Saiu com "Um deploy ou outra pessoa está mexendo no pm2": espere e rode de novo.

Depois: `node scripts/vigia.mjs` em 5 e em 15 min (sessões "sem sinal" devem
cair para perto de 0).

## Antes de mexer no servidor (apt, systemctl, pm2)
```bash
scripts/janela.sh abrir "o que vou fazer"
# ... trabalho ...
scripts/janela.sh fechar
```
Instalar pacote: `sudo NEEDRESTART_MODE=l apt-get install ...` (redundante com
o `50-wabot.conf`, mas não custa).
