# Auditoria RevOps — por que o lead entra e não fecha

Data: 2026-09-01
Escopo: da criação da conta até o pagamento aprovado (o "meio e fundo" do funil).
Base: código real do repositório nesta data. Nada foi alterado no produto.
Complementa (não substitui) `AUDITORIA_FUNIL_LEADS_CONVERSAO_2026-08-05.md`,
cujos quick wins de topo já foram aplicados (`/precos` existe, prova social
fabricada removida, CTA do hero = "Testar 7 dias grátis").

---

## 0. Resumo em uma frase

O topo melhorou, mas o produto **tranca a porta exatamente no momento da
decisão**: há um teto físico de 20 robôs no servidor que recusa ativação sem
avisar ninguém, o relógio do teste de 7 dias corre desde o cadastro (não desde a
ativação), o "momento de valor" só acontece depois de 4 configurações
encadeadas, e a cobrança recorrente **existe no código mas não é oferecida** —
todo cliente que fecha precisa fechar de novo daqui a 30 dias.

Ordem de impacto: **capacidade > tempo de valor > modelo de cobrança > medição**.

---

## 1. Mapeamento de gargalos

O funil real do produto tem 8 passagens (é o que `scripts/diag-funil-ativacao.mjs`
já mede):

| # | Etapa | Onde vive | Atrito provável |
|---|---|---|---|
| 1 | Cadastro | `POST /register` | 5 campos, celular obrigatório |
| 2 | **Parear WhatsApp** | QR / código | **teto de 20 robôs recusa**; medo de ban |
| 3 | Credencial de afiliada | `Credential` | 3 lojas, cada uma com passo próprio |
| 4 | Grupo de origem | `Group role=monitor` | exige já ter grupo/canal |
| 5 | Grupo de destino | `Group role=post` | idem |
| 6 | **1º envio com sucesso** | `MessageLog status=success` | sem credencial vira `skip:no_valid_conversions` — nada é publicado |
| 7 | Checkout iniciado | `checkout_started` | só no painel; sem gatilho no momento certo |
| 8 | Pagamento aprovado | `Payment approved` | 30 dias avulsos, sem recorrência |

**Baseline conhecido** (comentário do próprio diag, 2026-08): 62 cadastros em 90
dias, 3 pagantes — **~5%**. O sintoma "topo ativo, fechamento baixo" está medido:
o problema não é atrair, é atravessar as etapas 2 a 6.

Hipóteses de fricção, em ordem de suspeita:
1. **Capacidade** (etapa 2) — perda mecânica, não comportamental.
2. **Tempo até o valor** (2→6) — 4 configurações antes de ver a primeira oferta sair.
3. **Falsa ativação** (etapa 6) — cliente acha que está funcionando e não está.
4. **Modelo de cobrança** (etapa 8) — venda avulsa recriada a cada 30 dias.
5. **Instrumentação** — sem leitura do funil, tudo acima vira palpite.

---

## 2. Diagnóstico de causa raiz

### 2.1 🔴 O servidor recusa clientes novos em silêncio (etapa 2)

**Como ocorre:** `checkSessionCircuitBreaker` (`src/supervisor/index.js`) recusa
ligar sessão acima de `MAX_SESSIONS_PER_PROCESS` (**20**). Medição de 01/09:
20 robôs = 5,31 GB de RSS (272 MB por robô), servidor cheio, **183 recusas**
acumuladas sem que ninguém percebesse. Até 01/09 a recusa **não deixava rastro
no banco** — as rotas de conectar descartavam o retorno do `startBot`, e a
cliente lia "Falha na conexão / Bot não está conectado".

**Por que dói tanto:** isso atinge exatamente quem **decidiu tentar** — o lead de
maior intenção do funil. E a mensagem que ela recebe não diz "não há vaga", diz
"falhou", o que ela interpreta como produto quebrado. Uma cliente real tentou 7
vezes em 40 minutos e desistiu.

**Consequência comercial:** o teto de 20 é o **teto de faturamento**. Com Basic a
R$39 / Pro a R$69, 20 vagas = R$780–1.380/mês de teto absoluto, e cada vaga custa
~272 MB de RAM (ordem de R$2–3/mês de infra). É a única alavanca do funil em que
o gargalo é físico e o custo de removê-lo é irrisório perto do ticket.

⚠️ Mudar o teto exige reiniciar o `bot-supervisor` — o que reconecta **todas** as
sessões de uma vez, e é mudança memory-heavy (REGRA #1 da política de memória:
avisar antes, com estimativa).

### 2.2 🔴 O teste de 7 dias corre desde o cadastro (etapa 1→6)

**Como ocorre:** `POST /register` grava `accessExpiresAt = agora + 7 dias`
(`STANDARD_TRIAL_DAYS`). O relógio começa **antes** de existir qualquer valor
entregue. Quem tenta parear e não consegue (§2.1), ou quem hesita 3 dias por medo
de conectar o WhatsApp, chega ao dia 7 sem nunca ter visto uma oferta sair.

**Por que ocorre a perda:** o prospect não avalia "quero pagar?", ele avalia
"isso funciona pra mim?". Um teste que expira antes da primeira prova de
funcionamento converte o lead direto para "não deu certo" — a objeção oculta não
é preço, é **não ter visto**.

### 2.3 🔴 Ativação falsa: parece funcionando e não está (etapa 6)

**Como ocorre:** sem etiqueta de afiliada / código de acesso cadastrado, o
pipeline se recusa a publicar link não convertido (`skip:no_valid_conversions`)
— corretamente, para não dar a comissão ao concorrente. A conta gera linhas de
`MessageLog`, o painel mostra atividade, e **nenhuma oferta chega ao grupo**. Na
Shopee é pior: chave recusada derruba a conversão inteira e as automáticas param.

**Por que ocorre a perda:** a cliente vive o teste inteiro achando que o robô
"está fraco" ou "não pega as ofertas", e a conclusão dela é sobre o produto, não
sobre um campo faltando. É a pior classe de perda: silenciosa e atribuída a nós.
O próprio diag alerta para isso ("parece ativado e não é").

### 2.4 🟠 A cobrança recorrente existe e não é oferecida (etapa 8)

**Como ocorre:** `POST /payments/create-subscription` (Mercado Pago `preapproval`)
está implementado, o webhook trata `subscription_preapproval` e
`subscription_authorized_payment`, e `api.paymentsCreateSubscription` existe no
front. **Nenhuma tela chama.** A única rota usada é
`api.paymentsCheckout` → pagamento avulso que soma 30 dias de acesso.

**Por que ocorre a perda:** toda receita precisa ser **refechada mês a mês** por
uma decisão ativa da cliente, em geral por PIX, contra um vencimento que corta o
serviço. Isso transforma retenção em vendas repetidas e inflaciona o custo de
aquisição efetivo. Comportamentalmente, pagar de novo reabre a pergunta "vale?"
todo mês — enquanto a assinatura só reabre quando algo dá errado.

### 2.5 🟠 O vencimento é um penhasco, não uma rampa

**Como ocorre:** vencido o acesso, `loadConfig` no `bot-worker` derruba a sessão
(`Acesso expirado — bot bloqueado`) e `startBot` recusa subir. Sem carência, sem
modo reduzido, sem "últimas 24h em modo leitura".

**Por que ocorre a perda:** o cliente indeciso vive o corte como punição no
momento em que ainda estava decidindo. A recuperação depois é bem mais cara que
uma carência de 48h com aviso.

### 2.6 🟡 Não há leitura do funil (mede-se tudo, lê-se nada)

Os dados existem (`AnalyticsEvent`, `Payment`, `WaSession`, `MessageLog`) e há
scripts read-only (`diag-funil-ativacao`, `diag-origem-cadastros`,
`diag-clientes-sem-vaga`). O que não existe é **uma tela** com cadastro →
pareamento → 1º envio → checkout → pagante, por origem e por semana. Sem isso,
cada decisão de aquisição continua sendo palpite, e o efeito de qualquer correção
abaixo é invisível.

Lacunas pontuais: `checkout_started` só é gravado quando a API cria a preferência
(não há "viu a tela de planos"), e não há evento de `trial_expired`.

---

## 3. Plano de ação

### Curto prazo (0–15 dias) — estancar ✅ CONCLUÍDO (2026-09-01)

As seis ações abaixo foram feitas no mesmo dia da auditoria (commits `6dcfd1c`
"Conectar: dizer quando o servidor está no limite de robôs" e `1832257` "aviso
para quem ficou sem vaga e lista de contatos", entre outros). O que segue é o
registro do que era; a fila de trabalho agora é a seção de médio prazo.

| # | Ação | Onde | Ganho |
|---|---|---|---|
| 1 | **Rodar `diag-clientes-sem-vaga.mjs --days=60 --csv` e falar com cada pessoa da lista** | VPS | recupera demanda já paga em marketing |
| 2 | **Decidir o teto de robôs** com estimativa de RAM (REGRA #1) e, se aprovado, subir com janela anunciada | `MAX_SESSIONS_PER_PROCESS` | destrava o único gargalo físico |
| 3 | **Mensagem honesta de fila cheia** no painel: "estamos sem vaga agora, você entra na fila e avisamos" + captura do contato | rota de conectar (já devolve 503 `WA_CAPACITY_LIMIT`) | transforma recusa em lead recuperável |
| 4 | **Alerta operacional** quando a ocupação passar de 80% das vagas | sinal `ops_session_capacity_limit` já existe | nunca mais descobrir 183 recusas depois |
| 5 | **E-mail/WhatsApp no dia 1 e 3 para quem não pareou** — os gatilhos já existem (`onboarding_conecte_whatsapp`, `configuracao_incompleta`); validar que estão saindo | `emailTriggers/` | resgate barato do maior vazamento |
| 6 | **Aviso "sua oferta não está saindo"** quando houver `skip:no_valid_conversions` recorrente e nenhuma credencial válida | painel + e-mail | mata a ativação falsa |

### Médio prazo (15–60 dias) — otimizar ← **fila atual**

Reordenado em 2026-09-01 com o dado de origem que entrou no `AGENTS.md` no mesmo
dia: **72 cadastros em 30 dias**, **43% deles vindos do ChatGPT** (31 de 72,
carimbados `utm_source=chatgpt.com`) e **86% dos pagantes entraram por página de
conteúdo**. O topo deixou de ser o problema — e isso muda a prioridade abaixo.

**A conta que manda na fila:** entram ~72 pessoas/mês e o servidor tem um número
fixo de vagas de robô (`MAX_SESSIONS_PER_PROCESS`). Enquanto entrar mais gente
por mês do que existe vaga, **tudo o que melhora conversão esbarra no mesmo
teto** — por isso o item 1 é decidir quem ocupa a vaga, não convencer mais gente.

| # | Ação | Por que agora | Onde mexe | Risco |
|---|---|---|---|---|
| 1 | **Vaga vai para quem tem grupo pronto** — 2 perguntas no cadastro ("já tem grupo ou canal?", "já é afiliada de qual loja?") usadas para ordenar a fila de espera, não para barrar ninguém | com vaga escassa e 72 entradas/mês, a decisão que mais move receita é **alocação**, não persuasão | `POST /register` + a lista de espera criada no curto prazo | baixo |
| 2 | **Ligar a assinatura recorrente que já existe** | `POST /payments/create-subscription` e `api.paymentsCreateSubscription` estão prontos e **nenhuma tela chama** — hoje toda receita é refechada na mão a cada 30 dias | `dashboard/app/painel/plano/page.js` (+ `/precos`) | médio — validar em staging com token **sandbox** (token de produção em staging cobra de verdade) |
| 3 | **Contar o teste a partir da ativação**, com teto absoluto (ex.: 21 dias desde o cadastro) | hoje `accessExpiresAt = cadastro + 7 dias`; quem espera vaga ou hesita perde o teste sem ter visto o robô funcionar | `src/api/routes/auth.js` (`STANDARD_TRIAL_DAYS`) + marco de ativação | médio — mexe em acesso; precisa do teto para não virar acesso eterno |
| 4 | **Valor antes do QR**: colar um link e ver a oferta convertida sem conectar nada | o motor `buildScrapedOffer` já faz isso; ataca o medo de entregar o WhatsApp **e** serve à visita que chegou pelo ChatGPT sem contexto nenhum | painel (primeiro passo) reaproveitando `/criar-oferta` | baixo |
| 5 | **Carência de 48h no vencimento**, com aviso antes do corte | hoje o worker derruba a sessão seco (`Acesso expirado — bot bloqueado`); o corte cai no momento em que a pessoa ainda decidia | `loadConfig` (`bot-worker.js`) + `startBot` | médio — é regra de cobrança, exige decisão sua |
| 6 | **Painel de funil** (cadastro → pareamento → 1º envio → checkout → pagante, por origem e semana) | os dados e os scripts existem; falta a tela. Sem ela, o efeito dos itens 1-5 é invisível | admin | baixo |

**Duas coisas que o dado novo desaconselha:** (a) investir em mais tráfego antes
do item 1 — trazer gente para uma fila cheia piora a experiência e queima o
canal; (b) tratar ChatGPT como canal experimental — ele já é o que mais traz
cliente por visita, e merece o mesmo cuidado de conteúdo que o Google.

### Longo prazo (60+ dias) — estruturar

1. **Capacidade como métrica de negócio**: vagas ocupadas/livres, custo por vaga
   e projeção de esgotamento no mesmo lugar em que se olha receita.
2. **SLA interno de ativação**: toda conta nova pareada em até 24h ou alguém fala
   com ela. Com o volume atual (dezenas/mês) isso é humanamente viável e é o que
   mais move a taxa de fechamento nesta faixa.
3. **Loop de feedback**: motivo declarado de quem não converteu (2 cliques no
   e-mail de fim de teste) alimentando aquisição e roadmap.
4. **Cobrança anual com desconto** depois que a recorrência estiver estável.

---

## 4. Perguntas para calibrar

1. Nos últimos 90 dias: quantos cadastros, quantos parearam, quantos tiveram ao
   menos **um envio com sucesso**, quantos pagaram? (`node scripts/diag-funil-ativacao.mjs --dias 90 --listar`)
2. Quantas pessoas distintas aparecem em `diag-clientes-sem-vaga.mjs --days=60`
   — e quantas delas nunca voltaram?
3. Qual a origem dos 3 pagantes atuais (indicação, Instagram, YouTube, busca)?
   Isso decide onde investir os próximos 60 dias.
4. Há disposição para ligar assinatura recorrente no cartão, ou o público paga
   quase só por PIX? (muda completamente a ação de médio prazo nº 2)
5. **Qual é o teto de vagas hoje** (`MAX_SESSIONS_PER_PROCESS` no `.env` de
   produção) e quantas estão ocupadas? Com 72 cadastros/mês, esse número decide
   sozinho quanto do resto do plano vale a pena.
