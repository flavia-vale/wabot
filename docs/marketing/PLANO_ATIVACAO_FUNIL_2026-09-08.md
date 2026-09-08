# Plano de ativação — parar de perder cliente entre as etapas

**Data:** 2026-09-08 · **Foto zero:** `diag-funil-ativacao.mjs --dias 60`,
produção, 128 cadastros, 14 pagantes (**10,9%**).

---

## 1. A foto

| Etapa | Pessoas | % do topo |
|---|---:|---:|
| 1. Criou a conta | 128 | 100% |
| 2. Chegou a parear o WhatsApp | 80 | 63% ← maior queda (-48) |
| 3. Cadastrou credencial de loja | 53 | 41% |
| 4. Configurou grupo de ORIGEM | 57 | 45% |
| 5. Configurou grupo de DESTINO | 61 | 48% |
| 6. Teve envio que SAIU de verdade | 52 | 41% |
| 7. Iniciou o checkout | 14 | 11% |
| 8. **PAGOU** | **14** | **11%** |

**Onde pararam os 114 que não pagaram:**

| Motivo | Pessoas | % |
|---|---:|---:|
| Nem chegou a pedir a conexão | 46 | 40% |
| **Viu oferta sair e não foi para o pagamento** | **32** | **28%** |
| Conectou e não cadastrou nenhuma loja | 18 | 16% |
| Tentou conectar e NÃO conseguiu | 11 | 10% |
| Falta escolher origem | 3 | 3% |
| Começou o pagamento e não concluiu | 2 | 2% |
| Configurou tudo e nunca enviou | 2 | 2% |

---

## 2. Os quatro fatos que decidem o plano

### 2.1 O checkout NÃO é problema. 14 iniciaram, 14 pagaram.

Só **2 pessoas** pararam no meio do pagamento. Quem chega na tela de pagar,
paga — praticamente 100%.

**Consequência direta: não gastar um minuto otimizando checkout, Pix, cartão ou
recuperação de carrinho.** Não é onde está o dinheiro. O problema é que quase
ninguém chega a *ver* a tela.

### 2.2 A maior queda não é o maior prêmio

Ordenando por quantos pagantes cada frente pode devolver — usando a conversão
real de quem conecta (14 de 80 = **17,5%**):

| Frente | Pessoas | Teto de pagantes | Custo de mexer |
|---|---:|---:|---|
| **D — viram oferta sair e não pagaram** | 32 | **+32** (já convertem a ~100% se chegarem ao checkout) | **baixo** — e-mail e timing |
| A — nunca pediram a conexão | 46 | +8 | alto — mexe no fluxo inteiro |
| C — conectaram sem loja | 18 | +3,1 | médio |
| B — tentaram e falharam | 11 | +1,9 | baixo, mas é defeito nosso |

A frente A é o balde maior e o prêmio menor: essas 46 pessoas estão a **quatro
etapas** do pagamento, e cada etapa tem a própria perda. As 32 da frente D estão
a **uma pergunta** de distância — o produto já funcionou para elas.

**Mesmo que só 25% da frente D responda, são +8 pagantes: o mesmo que o teto
TEÓRICO da frente A, por uma fração do esforço.**

### 2.3 O teste morre no dia em que a decisão acontece

O teste dura **7 dias contados do cadastro** (`STANDARD_TRIAL_DAYS`,
`src/api/routes/auth.js:52`) e a mediana entre cadastro e pagamento é **6,2 a 7
dias**. Quem leva 4 dias para conectar não testa 7 dias — testa 3. Estamos
cobrando pelo tempo corrido, não pelo produto usado.

### 2.4 Um vazamento que o funil não nomeia: gente que funcionou e sumiu

**52 pessoas tiveram envio real. Só 19 têm sessão viva agora.** São **33 pessoas
que viram o robô funcionando e hoje estão desconectadas** — e o funil as
classifica como "viu oferta sair e não pagou", como se nunca tivessem ativado.
Sem separar "nunca pagou" de "usou e largou", os dois problemas viram um só.

---

## 3. O plano, por frente

### FRENTE D — 32 pessoas viram o produto funcionar e ninguém pediu a venda
**Prioridade 1. Maior prêmio, menor esforço.**

O produto funcionou, o checkout converte quase 100%, e essas pessoas
simplesmente **nunca foram perguntadas**. `buildTrialEndingNotice` já monta o
aviso com prova ("o robô já publicou N ofertas"), mas ele mora **dentro do
painel, nos 3 últimos dias** — e essa cliente não abre o painel justamente
porque está tudo funcionando sozinho.

| # | Mudança | Esforço |
|---|---|---|
| D1 | **Levar a prova para fora do painel:** e-mail no dia 3 do teste com o número dela. ⚠️ **Desvio do plano original, de propósito:** o "dia 6" já é ocupado pela contagem regressiva (`teste_acaba_em_1_dia`), e a regra da casa é no máximo UM e-mail de ciclo de vida por passada — encaixar a prova ali roubaria o lugar do aviso mais urgente. Os últimos três dias continuam cobertos pelo aviso com prova DENTRO do painel (D3/D4). | M |
| D2 | **Traduzir para o trabalho poupado, não para volume:** "47 ofertas × 3 grupos = 141 mensagens que você não digitou". | P |
| D3 | **Tocar no DIA do vencimento**, não só 3 dias antes — a decisão é no dia 7. | P |
| D4 | **"Sua configuração continua salva"** em todo pedido de pagamento. O medo real é perder grupos, lojas e regras. | P |
| D5 | **Preço ancorado no uso dela:** com 47 ofertas publicadas, R$69 = R$1,47 por oferta. Calcular com o número real na tela de plano. | M |
| D6 | **Falar com as 32 AGORA, na mão.** A lista está no `--listar`. Elas são a pesquisa de mercado mais valiosa que existe: viram funcionar e não compraram. Antes de construir qualquer coisa, perguntar por quê. | P |

### FRENTE B — 11 pessoas tentaram conectar e não conseguiram
**Prioridade 2. Prêmio pequeno, mas é 100% defeito nosso — e é o único balde que não se resolve com texto.**

⚠️ **Três das 11 caem em 22–23/08** (`eloa503lima`, `ferreiraclenio900`,
`maria.alice24ys`). Isso tem cara de incidente, não de acaso. **Primeiro passo é
abrir o histórico dessas contas e o `WaConnectionEvent` dessas duas datas** —
pode ser o mesmo teto de vagas do RCA de 2026-09-01 ou recusa do WhatsApp.

| # | Mudança | Esforço |
|---|---|---|
| B1 | **Investigar o cluster de 22–23/08** antes de qualquer mudança de produto. | P |
| B2 | **Alerta interno** quando alguém cria `WaSession` e não conecta em 24h. Hoje só aparece se alguém abrir o `/admin/funil`. | P |
| B3 | **QR falhou 2 vezes → oferecer o código por número na hora**, sem a pessoa ter de descobrir a aba sozinha. | P |
| B4 | **Teto de vagas cheio → fila com aviso por e-mail** ("te chamamos quando abrir"), em vez de deixar tentando 7 vezes como no RCA de 01/09. | M |

### FRENTE C — 18 conectaram e não cadastraram loja

Detalhe revelador da foto: **mais gente configurou grupo (57 e 61) do que
cadastrou loja (53)**. Grupo é fácil, loja é o obstáculo. E sem loja o robô se
**recusa** a publicar — do lado de fora, parece produto quebrado.

| # | Mudança | Esforço |
|---|---|---|
| C1 | **Loja obrigatória logo depois de conectar**, com o enquadramento certo: *"sem a sua etiqueta, a comissão iria para outra pessoa. O robô prefere não enviar."* Não é "falta um passinho". | P |
| C2 | **Começar pelas lojas de UM campo só** — Mercado Livre, Magalu e SHEIN pedem só a etiqueta (`REQUIRED_FIELDS`, `src/credentialHealth.js:53`); Amazon pede 4 campos e Shopee 2 chaves. Marcar na tela: "mais rápida (30 segundos)". Hoje as cinco aparecem como iguais. | P |
| C3 | **Perguntar a loja antes de mostrar campo.** Um formulário por vez, não cinco. | M |
| C4 | **Comemorar o save:** *"Pronto — a Shopee aceitou sua chave. A partir de agora toda comissão é sua."* A sondagem já existe; falta a confirmação. | P |
| C5 | **E-mail automático em 24h sem loja.** O texto já existe, testado e com o enquadramento certo (`contato_sem_etiqueta_nada_sai`) — hoje é **manual**. Promover a automático é mudar o `trigger` no registry. | P |

### FRENTE A — 46 nunca pediram a conexão
**Prioridade 4 por prêmio, mas contém a mudança estrutural mais importante.**

Pedimos o **máximo antes de entregar o mínimo**: "entregue seu WhatsApp a um
robô", sem nenhuma prova de que funciona. O `ActivationChecklist` reforça,
colocando "Conectar o WhatsApp" como passo 1 e "credenciais" como passo 4 — a
ordem exata do maior para o menor risco percebido.

| # | Mudança | Esforço |
|---|---|---|
| A1 | **Contar o teste a partir da 1ª conexão**, não do cadastro (com teto de janela para começar). Quem nunca conectou não gastou teste. Beneficia TODAS as frentes de uma vez. **Implementado, DESLIGADO** (`TRIAL_ANCHOR_ON_CONNECT`) — mexe em acesso pago, então só liga depois de validado em staging e com OK explícito. | M |
| A2 | **Valor antes do acesso:** primeiro passo do checklist vira colar um link no `/painel/converte-links` — que já funciona sem WhatsApp — e ver o link voltar com a etiqueta dela. Entende o produto em 40 segundos sem entregar nada. | M |
| A3 | **Garantias antes do botão:** os `WHATSAPP_SAFETY_POINTS` já existem e estão certos — estão embaixo. Subir para bloco de destaque acima do CTA. | P |
| A4 | **CTA:** trocar "Conectar" por **"Ligar o robô no meu WhatsApp"** + "leva 30 segundos e você desliga quando quiser". | P |
| A5 | **Falar do chip separado já no cadastro**, não só na tela de conexão. É a objeção nº 1 respondida tarde demais. | P |
| A6 | **Prévia do espelhamento com dados de exemplo** — "a mensagem chega assim no seu grupo". Vender o resultado antes de pedir o acesso. | M |

### FRENTE E — 33 funcionaram e sumiram *(nova, não estava no funil)*

| # | Mudança | Esforço |
|---|---|---|
| E1 | **Separar no `/admin/funil` "nunca ativou" de "ativou e largou".** Hoje os dois caem no mesmo balde e pedem conversas opostas. | M |
| E2 | **Descobrir se desconectaram ou caíram.** `WaConnectionEvent` já distingue `manual_stop_requested` de queda. Se for queda, é confiabilidade, não preço. | P |

---

## 4. Ordem de execução

**Onda 1 — esta semana (só texto, ordem de tela e uma investigação):**
D6 falar com as 32 · B1 investigar o cluster de 22–23/08 · D3 · D4 · C1 · C2 ·
C4 · A3 · A4.

**Onda 2 — semana 2 (as duas estruturais):**
**A1 teste começando na conexão** · **D1/D2 prova por e-mail nos dias 3 e 6** ·
C5 e-mail automático de 24h sem loja · B2 alerta interno.

**Onda 3 — semana 3:**
A2 valor antes do acesso · D5 preço ancorado no uso · E1/E2 separar churn de
não-ativação · B3/B4.

**Não fazer agora:** qualquer coisa de checkout, Pix, cartão ou recuperação de
carrinho. Dois casos em 60 dias.

---

## 5. Como medir

Repetir `diag-funil-ativacao.mjs --dias 60` a cada 15 dias, comparando contra
esta foto.

| Indicador | Hoje | Meta 60 dias |
|---|---:|---:|
| Cadastro → pagou | **10,9%** (14/128) | **18%** |
| Cadastrou → pediu a conexão | 63% (80/128) | 75% |
| Conectou → cadastrou loja | 66% (53/80) | 85% |
| Teve envio real → iniciou checkout | 27% (14/52) | 45% |
| Tentou conectar e falhou | 11 pessoas | ≤ 3 |
| Teve envio real → conectado agora | 37% (19/52) | 60% |

**A linha que manda é a quarta.** É a única em que o esforço é baixo, o prêmio é
alto e o checkout já converte sozinho.

**Duas armadilhas de leitura:**
- Metade deste plano é e-mail, e **sem `SMTP_*` no `.env` nada sai, em
  silêncio**. Conferir `EmailSendLog` antes de concluir que uma onda falhou.
- A foto tem contas de teste dentro (`Flavia Teste 2`, `mariaexemplo@gmail.com`,
  conta anonimizada). São poucas, mas em números de 128 elas mexem no decimal.
