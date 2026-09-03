# Registro de execução — 16/08 a 02/09/2026

**Para que serve:** guardar o que foi feito, com que número, e **o que medir da
próxima vez**. Nas rodadas seguintes, compare contra este documento em vez de
recomeçar a leitura do zero.

Fecha o ciclo que começou com a medição de 01/09
(`ANALISE_SEO_2026-09-01.md`) e o plano de ação
(`PLANO_ACAO_SEO_IA_2026-09-01.md`). Tudo listado aqui está em **produção**
(deploy do PR #1577, 02/09 17:54 UTC, verde).

---

## 1. Os três marcos de medição (o que comparar)

| Métrica | 30/07 | 16/08 | **01/09** | próxima rodada |
|---|---:|---:|---:|---|
| Cliques (soma da aba "Países") | 40 | 93 | **177** | |
| Impressões | 1.102 | 2.902 | **5.773** | |
| CTR | 3,63% | 3,20% | 3,07% | |
| Posição média (Brasil) | 7,85 | 7,60 | 7,68 | |
| **Consultas distintas** | 13 | 29 | **115** | |
| Páginas com impressão | 60 | 77 | 79 | |

**Sempre comparar pela soma da aba "Países".** O painel-resumo dá números
diferentes (inclui linhas sem país atribuído) — as duas metodologias não se
misturam.

**A métrica mais honesta é "consultas distintas".** Ela quadruplicou (29 → 115)
enquanto as páginas com impressão quase não mudaram (77 → 79): o crescimento
veio das MESMAS páginas aparecendo em mais buscas, não de páginas novas.

Por mês fechado: junho 8 cliques/365 impressões · julho 33/656 · **agosto
136/4.739**. O salto de 04/08 sustentou-se o mês inteiro — não foi pico.

### O que a rodada de 01/09 descobriu, e que motivou tudo abaixo

1. **A linha de comparação com concorrente é o motor de crescimento** — 92% das
   impressões de consulta. Mas o gargalo é o CLIQUE (~1% em posição 5–7).
2. **Identidade trocada na maior consulta do site:** `achadinho pro` (742
   impressões) era respondida por `/alternativas/achadinhos-bot` — página cujo
   título anunciava OUTRO produto — que ganhava da página certa por 631 a 111.
3. **A marca estava partida em TRÊS**: "Espelha Grupos", "BOTinho" e
   "Bot Conversor" (no rodapé de todas as páginas). O ChatGPT tratava os dois
   primeiros como **produtos concorrentes**.
4. **"BOTinho" sozinho é lido como calçado infantil** por 3 das 4 IAs.
5. **Tier 1** (`shopee afiliados` etc., 50.000 buscas/mês, concorrência baixa):
   41 impressões e ZERO clique, pelo terceiro relatório seguido — não existia
   página comercial nossa disputando.
6. **43% dos cadastros vêm do ChatGPT** com 18% das visitas; o Google traz 70%
   das visitas. Citação por IA já é o canal que mais traz cliente.

---

## 2. O que foi feito (25 PRs, todas em produção)

### Marca — de três nomes para um

| PR | O quê |
|---|---|
| #1561 | Um nome só na superfície pública: **Espelha Grupos**. "Bot Conversor" aposentado do rodapé. |
| #1575 | E-mails ("Equipe Espelha Grupos"), termos de uso, nome dos planos na cobrança, `statement_descriptor` da fatura, definição do produto no schema. `NAMING_GUIDE.md` reescrito. |

**BOTinho sobrevive em dois lugares, de propósito:** `alternateName` no schema
(citação antiga continua apontando para cá) e como voz do robô dentro do painel
logado.

⚠️ **A troca de marca quebrou o QR em tempo real** — ver seção 4.

### SEO — título, clique e as páginas que faltavam

| PR | O quê |
|---|---|
| #1552 | Conserto da identidade trocada em `achadinho pro` + reescrita dos 7 títulos de `/alternativas/`, cada um com um fato concreto |
| #1553 | Títulos das páginas com muita impressão e zero clique |
| #1554 | Títulos cortados no celular |
| #1562 | Páginas órfãs ganham link interno (eram alcançáveis só pelo sitemap) |
| #1564, #1566 | **Frente Tier 1**: `/shopee-`, `/mercado-livre-`, `/amazon-`, `/shein-` e `/magalu-afiliados-whatsapp` |
| #1568 | `/espelhar-grupos-whatsapp` reescrita: de 567 para 3.903 caracteres |
| #1569 | `/alternativas/promium` (o concorrente que as IAs mais citam) |
| #1573 | Teto de 55/160 passa a valer para TODA página, não só para as listadas |

**Magalu foi reaberto por decisão explícita da dona do produto**, contra a linha
congelada de 30/07. O congelamento vinha do Trends (único marketplace em queda)
— argumento de prioridade, não de correção. A guarda `FR-033` passou a aceitar
**só** a rota comercial, em vez de ter sido apagada.

### Medição — três pontos cegos fechados

| PR | O quê estava cego |
|---|---|
| #1556 | Os CTAs de `/precos` não eram instrumentados; e `priceValue` estava congelado, então schema e tela podiam discordar do preço |
| #1557 | O diagnóstico não lia `comparison_page_view` — as páginas de comparação, que são o motor de crescimento, não apareciam no relatório |
| #1558 | Teste com 1,95% de chance de falhar por acaso (medido em 200.000 timestamps simulados) |

### Produto — o funil e a conversa com a cliente

| PR | O quê |
|---|---|
| #1550 | **Assinatura recorrente ligada** (estava pronta no back e dormente) |
| #1555, #1559, #1565 | **ADMIN > Funil**: onde as pessoas param entre criar a conta e pagar, com o motivo e quem contatar |
| #1570 | Clareza de falta de cadastro da loja + vídeo tutorial com fonte única |
| #1574 | Recuperação de senha por e-mail |
| #1576 | Corte de execuções repetidas de Actions (~3.450 → ~2.000 min/mês) |

**O achado mais caro do funil:** "nem chegou a pedir a conexão" e "tentou e NÃO
conseguiu" eram um balde só. A medição real (124 cadastros, 55 parados aí)
mostrou por que isso não serve — o primeiro é decisão da pessoa, o segundo é
obstáculo NOSSO. Juntos, defeito de produto se esconde atrás de "ela não quis".

---

## 3. Duas coisas que a medição DERRUBOU (não repetir como fato)

- **"As páginas não indexam porque o conteúdo é fraco"** — falso. Das 15 URLs
  pedidas em 04/08, **todas** estão indexadas. Das 10 dos lotes A e B,
  **nenhuma** foi pedida alguma vez, e nenhuma está indexada. A causa era
  simplesmente ninguém ter pedido.
- **"Título longo corta no celular e mata o clique"** — os dois títulos mais
  longos do site são os que MAIS convertem (8,09% e 2,76%). Ficaram como grupo
  de controle na exceção nominal de `test/inbound-titulos-clique.test.js`.

E um **teto conhecido**: em `fluxopromo` estamos na posição 3 com o título
certo e mesmo assim 0 clique em 133 impressões. Quem digita a marca quer a
marca — conserto de título move o CTR de ~1% para talvez 3-4%, não para 15%.

---

## 4. O defeito que a própria troca de marca causou (PR #1572)

A varredura de texto renomeou o subprotocolo do WebSocket do QR de
`'BOTinho-auth'` para `'Espelha Grupos-auth'` **só no dashboard**. Dois defeitos
somados: subprotocolo de WebSocket é um TOKEN do HTTP e **não aceita espaço**
(RFC 6455 §4.1); e a API continuou conferindo o nome antigo.

Efeito: quem clicava em conectar não recebia o QR pelo caminho em tempo real.
**Nada ficou vermelho** porque nenhum teste olhava as duas pontas juntas.

**A lição virou regra em `NAMING_GUIDE.md`:** nome de marca NÃO entra em
identificador técnico (subprotocolo, cabeçalho, chave de env, slug, id).
Guarda: `test/qr-websocket-subprotocol.test.js`.

---

## 5. O que fazer na próxima rodada (~01/10)

1. **Repetir só o Relatório 1** (Search Console) de
   `COLETA_DADOS_KEYWORDS_PASSO_A_PASSO.md` + o relatório de Cobertura, e
   preencher a coluna vazia da tabela da seção 1. Não refazer Planejador e
   Trends — medem volume de mercado, que não muda em semanas (rodada completa
   só em outubro).
2. **Medir se os títulos novos moveram o clique.** A pergunta específica: o CTR
   das `/alternativas/*` saiu de ~1%? Lembrando o teto da seção 3.
3. **Medir se a frente Tier 1 saiu do zero.** Ela tinha 41 impressões e zero
   clique. É a maior oportunidade aberta (50.000 buscas/mês, concorrência
   baixa) e agora tem cinco páginas comerciais disputando.
4. **Repetir a coleta de citação por IA** (7 consultas × 4 superfícies,
   `ai_visibility_tracking.csv`) e conferir os dois sinais que a decisão de
   marca existe para mover:
   - "BOTinho preço" deixa de devolver calçado no Gemini, Perplexity e AI
     Overviews;
   - nenhuma IA oferece "comparação BOTinho × Espelha Grupos".
5. **Ler o painel `/admin/funil`** em vez de rodar script — ele agora responde
   onde as pessoas param e por quê.
6. **Conferir que a Cloudflare não voltou a bloquear as IAs:**
   `curl -s https://espelhagrupos.com.br/robots.txt | grep -c "Disallow: /$"` → 0.

---

## 6. O que ficou aberto (não é dívida escondida)

- **Indexação:** os 7 endereços dos lotes C e D podem ser pedidos agora que o
  deploy terminou (`PENDENCIAS_INDEXACAO.md`). As 4 páginas do lote B pedidas
  em 02/09 **antes** deste deploy precisam ser pedidas de novo — o Google leu a
  versão velha.
- **Branch protection em `develop` e `main`** exigindo `quality` e `no-undef`
  verdes. É permissão de admin do repositório: nenhum agente consegue
  configurar. Continua sendo a causa raiz da pegadinha #10.
- **Ação 12 do plano de 01/09:** contatar os roundups de terceiros que listam
  concorrentes e não nos listam.
- **19 concorrentes citados pelas IAs seguem sem ficha** em
  `competitors-data.js` — e sem ficha, nenhum preço deles pode ser citado em
  página pública (FR-031).
