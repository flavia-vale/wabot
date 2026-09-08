# Plano de ativação — parar de perder cliente entre as etapas

**Data:** 2026-09-08 · **Base:** medição do `/admin/funil` de set/2026 (124 cadastros,
113 não pagantes, 11 pagantes) + medição de ago/2026 registrada em
`docs/ops/falar-com-quem-parou-na-etiqueta.md`.

⚠️ Os números abaixo vêm de janelas de medição diferentes e **não fecham entre si na
soma**. Antes de executar, rodar no VPS para atualizar a foto:

```bash
cd ~/wabot && node scripts/diag-funil-ativacao.mjs --dias 60 --listar
```

---

## 1. Onde o dinheiro vaza

| Onde para | Pessoas | % dos que não pagaram | Natureza |
|---|---:|---:|---|
| **Nem pediu a conexão do WhatsApp** | **55** | **48,7%** | medo / expectativa |
| Conectou e não cadastrou nenhuma loja | 22 | 32% (ago) | achou que tinha terminado |
| **Viu oferta sair e não foi ao pagamento** | **34** | **30,1%** | preço / confiança / silêncio |
| Tentou conectar e NÃO conseguiu | dentro dos 55 | — | defeito nosso |

**Conversão total: 8,9%.** Mediana cadastro → pagamento: **6,2 a 7 dias**.

### O fato que organiza o plano todo

O teste dura **7 dias e o relógio começa no cadastro** (`STANDARD_TRIAL_DAYS`,
`src/api/routes/auth.js:52`). A mediana de quem paga é 6,2–7 dias, ou seja: **a
decisão de pagar acontece exatamente quando o teste morre.**

Só que quase metade das pessoas gasta os primeiros dias sem sequer conectar o
WhatsApp. Quem demora 4 dias para conectar não testa 7 dias — testa 3. **Estamos
cobrando pelo tempo, não pelo produto.**

---

## 2. Diagnóstico por etapa e o que mudar

### Etapa 1 → 2 · Cadastrou e nunca pediu a conexão (55 pessoas, o maior balde)

**Por quê:** o primeiro pedido que fazemos é o mais caro da vida do cliente —
"entregue seu WhatsApp a um robô" — e é feito **antes de ela ver uma única prova
de que a coisa funciona**. Nenhum produto sobrevive a pedir o máximo antes de
entregar o mínimo.

Piorando: o `ActivationChecklist` (`dashboard/components/ActivationChecklist.js`)
coloca "Conectar o WhatsApp" como passo 1 de 5, e "Cadastrar suas credenciais"
como passo 4 — a ordem exata do maior para o menor risco percebido.

**Mudanças de produto:**

| # | Mudança | Esforço |
|---|---|---|
| 1.1 | **Inverter o checklist: primeiro passo vira "Cadastre uma loja e veja um link ficar seu"**, usando `/painel/converte-links`, que já funciona sem WhatsApp nenhum. A pessoa cola um link, vê o link voltar com a etiqueta dela e entende o produto em 40 segundos, sem entregar nada. | P |
| 1.2 | **Começar por Mercado Livre, Magalu ou SHEIN — não pela Shopee.** As três pedem UM campo só (`REQUIRED_FIELDS`, `src/credentialHealth.js:53`); a Amazon pede quatro e a Shopee duas chaves. Hoje a vídeo-aula e a tela tratam as cinco como iguais. Rotular na tela: "mais rápida (30 segundos)". | P |
| 1.3 | **Prévia do espelhamento antes de conectar:** uma tela que mostra, com dados de exemplo, "a mensagem chega assim no seu grupo" — o card, a foto, a marca d'água. Vender o resultado antes de pedir o acesso. | M |
| 1.4 | **Mover as 4 garantias de segurança (`WHATSAPP_SAFETY_POINTS`) para ANTES do botão**, com destaque de bloco, não como texto de apoio. Elas já existem e estão certas — estão no lugar errado da página. | P |
| 1.5 | **Falar do chip separado no cadastro, não só na tela de conexão.** "Pode usar outro número" é a objeção nº 1 respondida tarde demais. | P |
| 1.6 | **Contar o teste a partir da 1ª conexão**, não do cadastro. Quem nunca conectou não gastou teste nenhum. Muda `accessExpiresAt` para ser recalculado no primeiro `whatsapp_connected`, com teto (ex.: 21 dias de janela para começar). **É a mudança de maior impacto e a mais barata do plano.** | M |

**Texto:** o CTA hoje é "Conectar". Trocar por **"Ligar o robô no meu WhatsApp"** e,
abaixo, "leva 30 segundos e você desliga quando quiser". "Conectar" é uma ação de
sistema; a cliente quer saber o que ganha e como sai.

---

### Etapa "tentou e NÃO conseguiu" · obstáculo nosso

Esse balde foi separado justamente para não esconder defeito atrás de "ela não
quis". Hoje ele é medido e **ninguém é avisado quando alguém cai nele.**

| # | Mudança | Esforço |
|---|---|---|
| 2.1 | **Alerta para a operação** quando uma conta cria `WaSession` e não conecta em 24h. Hoje isso só aparece se alguém abrir o `/admin/funil`. Um e-mail interno diário com a lista basta. | P |
| 2.2 | **Se o QR falhar 2 vezes, oferecer o código por número na hora** — sem a pessoa ter de descobrir a aba. O caminho de recuperação existe; a descoberta dele não. | P |
| 2.3 | **Quando o teto de robôs por processo recusar** (`MAX_SESSIONS_PER_PROCESS`, hoje 20), a tela já diz `WA_CAPACITY_LIMIT`. Adicionar **fila com aviso por e-mail** ("te chamamos quando abrir vaga") em vez de deixar a pessoa tentando 7 vezes — foi exatamente o que aconteceu no RCA de 2026-09-01. | M |

---

### Etapa 2 → 3 · Conectou e não cadastrou loja (22 pessoas)

**Por quê:** ela fez a parte difícil, achou que acabou, e **nada saiu**. Do lado
de fora isso não parece "falta um passo" — parece produto quebrado. O robô está
se recusando a publicar para proteger a comissão dela, e ela não tem como saber.

O `NoCredentialBanner` e a etiqueta "faltou cadastrar a loja" (PR #1570) já
atacam isso. O que falta é **impedir que ela chegue a esse estado**.

| # | Mudança | Esforço |
|---|---|---|
| 3.1 | **Bloquear a conclusão da conexão sem loja:** ao conectar o WhatsApp com zero credenciais, a tela seguinte é obrigatoriamente a de loja, com o enquadramento correto — *"Falta 1 minuto: sem a sua etiqueta, a comissão iria para outra pessoa. O robô prefere não enviar."* Não é "falta um passinho" — é proteção. | P |
| 3.2 | **Escolha da loja antes do campo.** Hoje a tela mostra cinco lojas e vários campos ao mesmo tempo. Perguntar "qual loja você usa?" e mostrar **um** formulário. (É a mesma lição que já está no roteiro de WhatsApp do `docs/ops/falar-com-quem-parou-na-etiqueta.md`: mandar os sete links de uma vez vira lista e ninguém abre.) | M |
| 3.3 | **Validar na hora e dizer que funcionou.** Já existe sondagem de sessão no save (`PLATFORMS_WITH_SESSION_CHECK`). Faltou a comemoração: *"Pronto — a Shopee aceitou sua chave. A partir de agora toda comissão é sua."* Confirmação é o que fecha o passo na cabeça dela. | P |
| 3.4 | **E-mail automático em 24h sem loja cadastrada** com o enquadramento "não é defeito, é o robô te protegendo". O texto já está escrito e testado (`contato_sem_etiqueta_nada_sai`) — hoje é **manual**. Promover a automático é mudar `trigger` no registry. ⚠️ Passa pela trava de conta parada e pelo teto semanal, então não vira spam. | P |

---

### Etapa 4 → 5 · Viu oferta sair e não foi ao pagamento (34 pessoas, 30,1%)

**Por quê:** aqui o produto **funcionou** e ela não pagou. Não é configuração —
é preço, confiança ou, mais provável, **silêncio**: o teste acabou sem ninguém
mostrar a ela o que ela ganhou.

`buildTrialEndingNotice` já resolve metade (aviso com prova, "o robô já publicou
N ofertas"), mas só aparece **dentro do painel, nos 3 últimos dias** — e essa
pessoa não abre o painel: o robô está funcionando sozinho, ela não tem motivo
para entrar.

| # | Mudança | Esforço |
|---|---|---|
| 4.1 | **Levar a prova para fora do painel.** E-mail no dia 3 e no dia 6 do teste com o número: *"Seu robô publicou 47 ofertas em 3 dias. Sem ele, seriam 47 mensagens copiadas na mão."* O motor de e-mail e o resumo semanal já existem. | M |
| 4.2 | **Traduzir para dinheiro, não para volume.** "47 ofertas" é métrica nossa. "47 ofertas × 3 grupos = 141 mensagens que você não digitou" é a dela. Melhor ainda se cruzar com cliques de afiliada quando houver dado. | M |
| 4.3 | **Última hora do teste, não último dia.** O aviso começa 3 dias antes; a decisão é no dia 7. Adicionar um toque **no dia do vencimento**, com o número atualizado. | P |
| 4.4 | **Oferecer continuar de onde parou, não "assinar um plano".** O medo real é perder a configuração. Dizer explicitamente: *"seus grupos, lojas e regras continuam salvos"*. | P |
| 4.5 | **Preço ancorado no que ela já viu.** Com 47 ofertas publicadas, R$69 = R$1,47 por oferta. Mostrar essa conta na tela de plano, calculada com o número real dela. | M |
| 4.6 | **Uma oferta de aterrissagem para quem não pagou:** mais 7 dias em troca de responder "o que faltou?". Vira retenção e pesquisa ao mesmo tempo — o grupo "Contato e escuta" já tem o e-mail certo (`contato_o_que_faltou`). | P |

---

### Etapa 5 · Começou o pagamento e não concluiu

| # | Mudança | Esforço |
|---|---|---|
| 5.1 | **Ligar a cobrança automática como opção padrão visível.** Já existe (PR #1550) e resolve o refechamento mensal, que é atrito recorrente. | P |
| 5.2 | **Pix na frente.** Público majoritariamente brasileiro e sensível a cartão; conferir o que o checkout do MP está oferecendo primeiro. | P |
| 5.3 | **E-mail recuperador de checkout em 2h** ("faltou pouco") — o evento `checkout_started` já é gravado. | P |

---

## 3. Ordem de execução

Sequenciada por **impacto ÷ esforço**, não por etapa do funil.

**Onda 1 (esta semana) — texto e ordem, sem código de negócio:**
1.4 garantias antes do botão · 1.2 loja mais rápida em destaque · 3.1 loja
obrigatória após conectar · 3.3 confirmação do save · 4.3 aviso no dia do
vencimento · 4.4 "sua configuração continua salva".

**Onda 2 (semana 2) — as duas alavancas grandes:**
**1.6 trial começando na conexão** e **1.1 valor antes do acesso** (converte-links
como passo 1).

**Onda 3 (semana 3) — automação da conversa:**
3.4 e-mail de 24h sem loja · 4.1/4.2 prova por e-mail nos dias 3 e 6 · 2.1 alerta
interno de quem tentou e não conseguiu · 5.3 recuperação de checkout.

---

## 4. Como saber se funcionou

Rodar `diag-funil-ativacao.mjs --dias 30` **antes** de começar (foto zero) e a
cada 15 dias. Comparar **as passagens**, não o total:

| Passagem | Meta 60 dias |
|---|---:|
| Cadastrou → pediu a conexão | +20 pontos sobre a foto zero |
| Conectou → cadastrou loja | +15 pontos |
| Publicou oferta → abriu pagamento | dobrar |
| **Cadastro → pagou** | **8,9% → 15%** |

Só a última linha tem número de partida confiável (11 de 124). As outras três
saem de janelas de medição diferentes — por isso a meta é **variação sobre a
foto zero que você vai tirar agora**, não um percentual absoluto que eu teria
de inventar.

⚠️ A coorte é a **semana do cadastro** (regra do `funnel.js`) — coorte nova leva
7 dias para ficar comparável. Não ler semana em andamento como queda.

**Duas armadilhas de leitura:**
- "Teve oferta publicada" conta só `status='success'`. Não afrouxar para
  comparar melhor.
- Metade dos avisos deste plano é e-mail, e **sem `SMTP_*` no `.env` nada sai,
  em silêncio**. Conferir `EmailSendLog` antes de concluir que uma onda não
  funcionou.
