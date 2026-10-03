# Medição do leitor do Telegram — passo a passo (Fase 0)

Tudo roda no servidor, **no terminal**, em uma pasta separada
(`~/telegram-spike`). Não mexe no Espelha Grupos, não reinicia nada dele.
A conta de teste **só lê**: não posta, não marca como lida, não entra em grupo.

Tempo total: ~1 dia e meio (a maior parte é esperar).

## O que NÃO fazer

- Não rodar `pm2 restart`, `pm2 delete` ou `pm2 save` de **outro** app. O único
  seu aqui é o `telegram-spike`.
- Não fazer isto na pasta `~/wabot` (produção).
- Não colar no chat: chaves, número de telefone, nem o arquivo `.session`.
- Não usar sua conta pessoal do dia a dia — só a conta de teste.

---

## 1. Preparar a pasta

```bash
mkdir -p ~/telegram-spike/sessions && chmod 700 ~/telegram-spike/sessions
cp ~/wabot-staging/scripts/spike/telegram-leitor-spike.mjs ~/wabot-staging/scripts/spike/resumir-medicao.mjs ~/telegram-spike/
cp ~/wabot-staging/scripts/spike/package.spike.json ~/telegram-spike/package.json
```

O que ver: nada (sem erro). Se der "No such file", o PR ainda não chegou no
staging — me avise.

## 2. Instalar (só nessa pasta)

```bash
cd ~/telegram-spike && npm install --no-audit --no-fund
```

O que ver: `added ... packages`. Não mexe no `~/wabot-staging`.

## 3. Copiar as chaves do staging sem mostrar na tela

```bash
grep -E '^TELEGRAM_API_(ID|HASH)=' ~/wabot-staging/.env > ~/telegram-spike/.env && chmod 600 ~/telegram-spike/.env && grep -c TELEGRAM ~/telegram-spike/.env
```

O que ver: `2`. Se der `0` ou `1`, falta chave no `.env` do staging.

## 4. Anotar o swap antes de começar

```bash
free -m | awk '/Swap/{print "swap usado antes:", $3, "MB"}'
```

Guarde o número (vai no item 5 do resultado).

## 5. Entrar com a conta de teste (QR)

```bash
cd ~/telegram-spike && node telegram-leitor-spike.mjs --login --conta=teste
```

No celular da conta de teste: **Telegram → Configurações → Dispositivos →
Conectar dispositivo** → leia o QR que aparece no terminal. Se a conta tiver
senha de duas etapas, o terminal pede (não aparece enquanto digita).

O que ver: `conectada como <nome da conta>`.

## 6. Entrar nos grupos/canais (pelo aplicativo, à mão)

Pelo **aplicativo do Telegram** da conta de teste, entre em:

- 1 **canal grande** público de ofertas (mais de 1.000 membros);
- 1 **grupo pequeno** (pode ser um seu);
- o **grupo de teste que recebe ofertas do robô do staging** (o que você
  ligou na tela Aplicativos do staging);
- mais canais de ofertas até ter **10** no total.

## 7. Etapa 1 — repouso (nenhum canal), 30 min

```bash
cd ~/telegram-spike && : > canais.txt && echo repouso > ROTULO
pm2 start telegram-leitor-spike.mjs --name telegram-spike --cwd ~/telegram-spike --no-autorestart -- --ler --autor-do-robo
```

O que ver: `telegram-spike` como `online` em `pm2 ls`. Espere **30 min**.

Para ver a memória na hora (opcional):

```bash
pm2 ls | grep telegram-spike
```

## 8. Etapa 2 — 1 canal, 2 h

```bash
cd ~/telegram-spike && node telegram-leitor-spike.mjs --listar --conta=teste
```

Aparece a lista numerada. Digite o número do **grupo de teste do robô** e
Enter. Depois:

```bash
echo 1canal > ~/telegram-spike/ROTULO && pm2 restart telegram-spike
```

Espere **2 h**. Durante essa etapa, faça o robô do staging publicar 1 oferta
nesse grupo (pela tela do staging, "Enviar agora" para o grupo do Telegram).

## 9. Etapa 3 — 5 canais, 2 h

Rode o `--listar` de novo e digite **5** números separados por vírgula
(inclua o canal grande e o grupo pequeno). Depois:

```bash
echo 5canais > ~/telegram-spike/ROTULO && pm2 restart telegram-spike
```

Espere **2 h**.

## 10. Etapa 4 — 10 canais, 24 h

Rode o `--listar` de novo e digite **10** números. Depois:

```bash
echo 10canais-24h > ~/telegram-spike/ROTULO && pm2 restart telegram-spike
```

Espere **24 h**. Confira 1 vez no meio do caminho que segue `online`:
`pm2 ls | grep telegram-spike`.

## 11. Durante as etapas — 2 perguntas (sim/não)

Com o celular de **outra pessoa** (ou outra conta):

- A conta de teste aparece **"online"** o tempo todo? (item 7)
- No canal pequeno, as **visualizações** das mensagens sobem quando só o
  leitor está ligado (celular da conta de teste fechado)? (item 8)

## 12. Encerrar

```bash
pm2 delete telegram-spike
free -m | awk '/Swap/{print "swap usado depois:", $3, "MB"}'
```

No celular da conta de teste: **Configurações → Dispositivos** → encerrar a
sessão do leitor. Depois apague a cópia local da sessão:

```bash
rm ~/telegram-spike/sessions/teste.session
```

## 13. Gerar o resultado

```bash
cd ~/telegram-spike && node resumir-medicao.mjs | tee RESULTADO.md
```

Complete à mão os itens marcados `___ (preencher)` (7, 8, 11 e 12) e o item 5
com os números de swap anotados. Para o item 11, leia
https://core.telegram.org/api/terms . **Cole o bloco no chat** — ele não
tem chave, telefone, id nem texto de mensagem.

## Se algo der errado

| Aparece | O que fazer |
|---|---|
| `O Telegram pediu para esperar N s` | Espere esse tempo antes de repetir. Anote (vai no item 9 sozinho). |
| `Sessão "teste" foi encerrada no Telegram` | Repita o passo 5. |
| `telegram-spike` como `stopped`/`errored` | `pm2 logs telegram-spike --lines 20 --nostream` e me mande só essas linhas. |
| Aviso do Telegram no celular da conta de teste | Pare (`pm2 delete telegram-spike`) e me avise (item 12). |
