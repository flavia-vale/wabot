# Máquina de vendas — diagnóstico de ponta a ponta e plano (2026-09-27)

Fontes (todas de 27/09, produção): `diag-funil-ativacao.mjs --dias 30` e `--dias 90`,
`diag-motivo-nao-renovou.mjs`, `diag-vagas-robos.mjs`, `diag-ltv-retencao.mjs`,
`diag-origem-cadastros.mjs --dias 30`, `diag-paginas-seo.mjs --dias 30`, SQL em
`prisma/prod.db` (Subscription, Refund, User.referredBy, OfferAutomation, WaSession),
Search Console (Consultas e Páginas, 3 meses até 23/09), rodada de IA 23–27/09
(10 consultas × 4 IAs, `.docx` de 27/09), Cloudflare 30 dias, Bing WMT.
O que é hipótese está escrito como hipótese.

Método: AARRR (Aquisição → Ativação → Receita → Retenção → Indicação; Dave
McClure, 2007), análise de coorte, métrica de ativação ("momento aha",
Amplitude/Reforge), churn voluntário × involuntário (ProfitWell/Recurly),
Product-Led Growth (o teste grátis é o vendedor). Todos adaptados aos números
abaixo, nunca no lugar deles.

---

## 1. A máquina inteira, em números (30 dias, 28/08 a 27/09)

| Etapa | Pessoas | % do topo | Perda absoluta | Fonte |
|---|---:|---:|---:|---|
| Visitas medidas em páginas públicas | 2.108 | — | — | diag-paginas-seo |
| **Cadastros** | 214 | 100% | −1.894 | diag-funil |
| Pediu e conseguiu parear o WhatsApp | 151 | 71% | −63 | diag-funil |
| Cadastrou loja | 125 | 58% | −26 | diag-funil |
| **Teve oferta publicada de verdade (ativou)** | 111 | 52% | −14 | diag-funil |
| Abriu a tela de pagamento | 29 | 14% | **−82** | diag-funil |
| **Pagou** | 24 | 11% | −5 | diag-funil |
| Renovou (coorte de agosto) | 7 de 7 | 100% | 0 | diag-ltv |
| Indicou alguém (código de indicação) | **0** na história | — | — | SQL `referredBy` |

Origem dos cadastros: Google ~88% das visitas; ChatGPT 60 cadastros (28%),
contado pelo carimbo `utm_source`, porque a visita do app do ChatGPT some.
37% dos cadastros entram por página de conteúdo.

### Onde estão os 190 que não pagaram (30 dias)

| Grupo | Pessoas | Leitura |
|---|---:|---|
| Viu o robô publicar e não foi pagar | **69** (91 em SQL, contando quem ainda está no teste) | maior perda |
| Nem pediu a conexão do WhatsApp | 62 | confiança/expectativa |
| Conectou e não cadastrou loja | 20 | obstáculo de produto |
| Tem loja, falta escolher origem | 16 | obstáculo de produto |
| Tentou conectar e não conseguiu | 10 | defeito nosso |
| Começou pagamento e não concluiu | 6 | pequeno |
| Configurou tudo e nunca enviou | 5 | pequeno |
| Robô tentou e nada saiu | 2 | pequeno |

Dos 91 que ativaram e não pagaram: **63 já estão desconectados** e 28 seguem
conectados sem pagar (ainda no teste). *Hipótese, a confirmar em
`WaConnectionEvent`:* a maioria dos 63 caiu porque o teste venceu e o worker
derruba a sessão no vencimento ("penhasco", auditoria de 01/09), não porque
desligou.

## 2. O veredito: onde está a maior perda e por quê

**A maior perda absoluta controlável é entre "viu funcionar" e "abriu o
pagamento": 82 pessoas por mês.** Quem abre a tela de pagamento paga (24 de
29, 83%). Quem viu funcionar e não abriu é 3,4× maior que quem pagou.

Por quê (dado, não achismo):

1. **Ninguém pede a venda onde a cliente está.** O aviso com prova ("o robô já
   publicou N ofertas") mora dentro do painel. A cliente que está satisfeita
   não abre o painel, porque está tudo funcionando sozinho. E-mail não alcança:
   o e-mail "o que faltou" saiu e **zero** responderam (27/09).
2. **O relógio corre desde o cadastro, não desde a conexão.** Média de 6,6 dias
   entre cadastro e pagamento, igual ao teste. Quem demora 3 dias para conectar
   testa 4. `TRIAL_ANCHOR_ON_CONNECT` está implementado e **desligado** em
   produção (grep no `.env` = 0).
3. **O vencimento corta a sessão sem rampa.** 160 sessões com "plano vencido"
   no diag de vagas. A decisão de pagar acontece no dia em que o produto some.
4. **Quem renova ativou nos 7 primeiros dias.** Dos 7 que renovaram, 7
   conectaram e cadastraram loja em 7 dias. Dos 3 que não renovaram, 1 de 3.
   Amostra pequena, mas a direção é a métrica de ativação do plano.

O que **não** é o problema, com dado:

- **Retenção:** coorte de agosto 7 de 7; 3 cancelamentos na história; 1
  reembolso em toda a história. A leitura de 23/09 estava errada.
- **Checkout:** 24 de 29 pagam. Não mexer.
- **Aquisição em volume:** 214 cadastros/mês, crescendo (Google 3,2× agosto).
  Trazer mais gente para o mesmo funil dá +11 pagantes a cada +100 cadastros.
  Subir ativação→pagamento de 26% para 40% dá +16 pagantes com os mesmos 214.

## 3. Achados por etapa

### Aquisição

- **Google:** 47% das impressões são nome de concorrente. `achadinho pro`:
  4.005 impressões, 39 cliques, CTR 0,97%, posição 6,2. Quem responde é
  `/alternativas/achadinhos-bot` (6.508 impressões, CTR 1,38%), página com o
  nome de OUTRO concorrente no título. As comerciais do mesmo tema fazem 6% a
  8,5% de CTR (`/bot-achadinhos-whatsapp` 6,03%; `/bot-afiliados-whatsapp`
  8,49%). Páginas com 100+ impressões e ZERO clique: `/programa-de-afiliados`
  (225), `/quanto-ganha-afiliado-shopee` (248, 1 clique),
  `/blog/como-divulgar-ofertas-mercado-livre-whatsapp` (153),
  `/amazon-afiliados-whatsapp` (102). Termos-cabeça de 50 mil/mês seguem fora.
- **IAs (23–27/09):** 19 de 36. Marca 13/16; categoria **6/20**. Em "bot para
  afiliados" a Perplexity nos lista com "lojas suportadas variam", enquanto o
  Pro Afiliados aparece com 12 integrações (Awin, Lomadee, Rakuten). O Gemini
  diz "WhatsApp e Telegram" e "Basic = operação manual" (os dois errados). Em
  "é confiável" e "o que é", o **Google AI Overviews cita a página do
  Achadinhos Pro "Espelhar grupos: vale a pena?"** e conclui "migre para
  curadoria própria". A nossa resposta (`/espelhar-grupos-de-ofertas-vale-a-pena`)
  entrou em `main` só em 27/09.
- **Objeção de confiança:** ChatGPT: "aparentemente legítimo, pouca reputação
  independente", sem CNPJ, poucas avaliações. Sem CNPJ, a prova possível é
  dado próprio (38 clientes, 1 reembolso, 7/7 renovaram) e depoimento real.
- **Ofertas automáticas têm uso real:** 43 contas com busca ativa contra 18
  pagantes Pro. Sustenta posicionar "espelhamento + garimpo automático" como
  dois pilares, com número, e não só espelhamento.
- **Indicação:** programa existe no código (`referralCode`, `referredBy`,
  comissão) e **nunca foi usado**: 0 cadastros indicados na história.

### Ativação

- 62 nem pedem a conexão. 10 tentam e não conseguem (defeito nosso, conferir
  histórico). Mais gente configura grupo (124) do que cadastra loja (125→
  ordem invertida do produto: loja é o obstáculo; sem loja o robô se recusa a
  publicar e parece quebrado).
- O momento aha existe e é medível: "primeira oferta publicada". 111 chegam lá
  (52%). É bom. O problema é o que acontece depois.

### Receita

- Assinatura recorrente: **4 ativas, 11 canceladas, 13 pendentes**. 19 das 28
  pessoas pagaram mesmo assim (avulso). A recorrência não perde venda, mas
  também não segura quase ninguém: 4 de 35 clientes com acesso em dia. Toda
  renovação de outubro depende de a cliente lembrar de pagar.
- Ticket: média R$ 55,87, mediana R$ 47. Pro 18 (R$ 1.303), Basic 20 (R$ 820).

### Retenção

- Coorte ago 7/7. 26 dos 38 pagaram pela 1ª vez em setembro: a renovação deles
  (1ª quinzena de outubro) é o dado que destrava anúncio. Projeção do script:
  R$ 689 por cliente, confiança média. Não decidir gasto por ela ainda.

### Capacidade (limite físico do plano)

- **62 de 80 vagas ocupadas, todas por cliente real.** 151 pareamentos/mês. Com
  as metas abaixo, o teto chega em 60–90 dias. Subir teto = RAM = REGRA #1
  (estimativa + OK explícito). 0,35 GB por vaga: +20 vagas ≈ +7 GB; servidor
  30,6 GB; limite seguro da política ~71 vagas hoje.

## 4. O plano: 10 ações, por impacto ÷ esforço

| # | Ação | Métrica que prova | Prazo de leitura | Quem |
|---|---|---|---|---|
| 1 | **Pedir a venda a quem viu funcionar**: (a) teste contado da 1ª conexão (ligar `TRIAL_ANCHOR_ON_CONNECT`, validado em staging; exige `pm2 delete` + `start`); (b) no vencimento, em vez de cortar a sessão, 48 h de carência com tela de pagamento que mostra o número dela ("o robô publicou N ofertas em X grupos; continue por R$39"); (c) aviso de fim de teste também pelo WhatsApp da própria cliente (o robô já está conectado nele). (c) é ideia a validar tecnicamente antes de prometer | ativou → abriu pagamento: **26% → 40%** (+16 pagantes/mês) | 30 dias (`diag-funil-ativacao --dias 30`) | código + decisão sua sobre carência |
| 2 | **Falar por WhatsApp com os 63 que ativaram, venceram e sumiram** (lista sai do SQL). Uma pergunta: "o que faltou?". É pesquisa e recuperação ao mesmo tempo; e-mail já provou que não funciona | ≥ 15 respostas; ≥ 5 voltam a pagar | 14 dias | você |
| 3 | **Consertar a recorrência**: por que 13 ficam pendentes e 11 cancelam (`diag-assinatura-recusada.mjs`); oferecer a cobrança automática no momento do 1º pagamento e no painel de quem paga avulso | novos pagantes com assinatura ativa: **4 de 35 → ≥ 50%** | 30 dias (SQL `Subscription`) | código (após diagnóstico) |
| 4 | **Reindexar o que subiu em 27/09** (levas R1–R3 de `ACOES_FLAVIA` + `/espelhar-grupos-de-ofertas-vale-a-pena`, reembolso, ofertas automáticas, 5 comparativos) | AI Overviews em "é confiável" e "o que é" cita a NOSSA página em vez do Achadinhos Pro | 30 dias (próxima rodada de IA) | você (10/dia) |
| 5 | **Ficha técnica canônica legível por IA**: tabela única (home, `/precos`, `llms.txt`, `pricing.md`) com 6 lojas nomeadas, espelhamento, garimpo automático Shopee (Pro), canais, filas, marca d'água, "sem Telegram", "Basic também é automático". Corrige "lojas variam", "Telegram" e "Basic manual" | Trilha A (categoria) **6/20 → 10/20**; Perplexity lista as 6 lojas | 30 dias | código |
| 6 | **Títulos das páginas com muita impressão e pouco clique**: `achadinho pro` respondido pela página certa (`/alternativas/achadinho-pro`, título com nome certo + número); reescrever título/meta de `/programa-de-afiliados`, `/quanto-ganha-afiliado-shopee`, `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`, `/amazon-afiliados-whatsapp` (728 impressões, 1 clique somados) | CTR de `achadinho pro` 0,97% → 2% (+40 cliques/mês); as 4 páginas saem de zero | 30 dias (série diária do Search Console, janelas iguais antes/depois) | código |
| 7 | **Ligar o programa de indicação no produto**: mostrar o link de indicação na hora da 1ª oferta publicada e na confirmação de pagamento (hoje só existe na página pública) | ≥ 5 cadastros com `referredBy` em 30 dias (hoje 0) | 30 dias (SQL) | código |
| 8 | **Prova sem CNPJ**: em `/espelha-grupos-e-confiavel`, números próprios com data (38 clientes, 1 reembolso na história, 7 de 7 renovaram em agosto, política de reembolso) + 3 a 5 depoimentos reais com permissão | ChatGPT em "é confiável" deixa de dizer "pouca reputação independente" | 30 dias | você colhe, código publica |
| 9 | **Um vídeo por semana no YouTube com o título igual à pergunta** ("Como espelhar mensagens entre grupos de WhatsApp", consulta sem NENHUM vídeo de terceiro), repostado no TikTok e Instagram que já existem; página do LinkedIn sai do zero com o mesmo conteúdo | Gemini e Perplexity na Trilha A: ≥ 2 cada (hoje 1 e 2) | 60 dias | você |
| 10 | **Decidir capacidade antes de bater no teto**: proposta com estimativa de RAM para +20 vagas (≈ +7 GB) ou alternativa mais leve (teto de sessão em teste, ex.: 1 número por conta em teste). Só depois do dado de outubro | vagas livres nunca abaixo de 10 | decisão em 15 dias; execução após renovações de outubro | código propõe, você decide |

### Parar de fazer (derrubado por dado)

- **Mais páginas `/alternativas/*`.** Já são 23. Somadas, ~47% das impressões,
  CTR 1,4%, e o maior comparativo converteu 4 cadastros em 133 visitas (3%).
  As comerciais do mesmo tema convertem 12% a 14%. Manter as que existem,
  não abrir novas sem bloco de conversão.
- **Pesquisa por e-mail.** Zero respostas. Conversa vai para o WhatsApp e para
  dentro do painel.
- **Mexer em checkout, Pix, cartão.** 24 de 29 pagam.
- **Anúncio pago** antes da renovação de outubro (turma de 26 clientes).
- Páginas por cidade/nicho, "espelhamento" como porta de entrada, medir
  "BOTinho", mais `llms.txt`/schema: seguem congelados.
- **Prometer Awin/Rakuten/Lomadee em texto público** antes de existir no código
  (hoje só aparecem em fichas de concorrente).

## 5. Metas ancoradas nos números de hoje

| Métrica | Hoje (30 dias) | 30 dias (27/10) | 90 dias (27/12) |
|---|---:|---:|---:|
| Cadastros/mês | 214 | 240 | 300 |
| Ativou (oferta publicada) | 52% | 55% | 60% |
| Ativou → abriu pagamento | 26% | 40% | 50% |
| Cadastro → pagante | 11% (24) | 15% (36) | 18% (54) |
| Renovação da coorte de setembro | — | ≥ 70% (≥ 18 de 26) | ≥ 70% em toda coorte |
| Pagantes com assinatura ativa | 4 | ≥ 15 | ≥ 50% dos ativos |
| Cadastros por indicação | 0 | 5 | 20/mês |
| Citação por IA, categoria (Trilha A) | 6/20 | 10/20 | 14/20 |
| Clientes ativos pagando | 35 | ~55 | **~100 → exige +vagas (ação 10)** |

A meta de 90 dias **não cabe no teto atual de 80 vagas** (clientes pagantes +
testes conectados). Por isso a ação 10 é decisão de outubro, não de dezembro.

Receita: não há leitura de MRR fechada neste documento. Rodar
`node scripts/diag-financeiro-periodo.mjs 30d` e anotar aqui antes de fixar a
meta em reais.

## 6. Como medir (a cada 15 dias, 20 minutos)

```bash
cd ~/wabot && node scripts/diag-funil-ativacao.mjs --dias 30
cd ~/wabot && node scripts/diag-ltv-retencao.mjs
cd ~/wabot && node scripts/diag-motivo-nao-renovou.mjs
cd ~/wabot && node scripts/diag-vagas-robos.mjs
cd ~/wabot && node scripts/diag-origem-cadastros.mjs --dias 30
sqlite3 ~/wabot/prisma/prod.db "SELECT status, COUNT(*) FROM Subscription GROUP BY status;"
sqlite3 ~/wabot/prisma/prod.db "SELECT COUNT(*) FROM User WHERE referredBy IS NOT NULL;"
```
Mais o Search Console (série diária) no dia 1 de cada mês e a rodada de IA
(`ROTEIRO_MEDICAO_IA.md`) a cada 30 dias. Acrescentar coluna em
`SERIE_HISTORICA_SEO.md`, não recomeçar.
