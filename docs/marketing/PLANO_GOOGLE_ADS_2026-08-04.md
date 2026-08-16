# Plano de implementação — Google Ads

Data: 2026-08-04. Base: skill `ads` (`coreyhaines31/marketingskills`) +
`google-search-playbook.md`, cruzada com os dados reais de
`ANALISE_DADOS_REAIS_KEYWORDS_2026-07-30.md`.

---

## O enquadramento honesto (leia antes de gastar)

O playbook tem uma regra chamada **"capture before you create"**: busca **colhe**
demanda existente, não cria. Se a categoria tem volume perto de zero, o dinheiro
deve ir para social/vídeo.

**O termo comercial principal (`bot para grupo whatsapp`) tem 500 buscas/mês.**
Isso é volume perto de zero.

Consequência prática: **Google Ads não escala este negócio.** Serve para
descobrir o CAC real e colher quem já decidiu procurar. O teto de gasto útil é
~R$900/mês — acima disso não há inventário.

A demanda de verdade (`shopee afiliados`, `mercado livre afiliados`,
`afiliado amazon` — 50.000/mês cada) é de gente querendo **entrar no programa de
afiliados**, não comprar ferramenta. Não se vende para ela na busca; educa-se em
vídeo. **O YouTube, que já existe, é a aposta de crescimento.** O Ads é
experimento de aprendizado.

---

## FASE 0 — Decidir (VOCÊ · 10 min) 🔴 bloqueia tudo

Três perguntas. Se qualquer resposta for "não", o plano para aqui sem prejuízo.

1. **Quer gastar R$600-900/mês por 2 meses para aprender**, sabendo que o
   objetivo é medir o CAC e não crescer volume?
2. **Quantos meses o assinante médio fica?** Está no seu banco (assinaturas). É
   o número que define o teto de CAC — sem ele, qualquer meta é chute.
3. **Aceita que a resposta do teste pode ser "não vale"?** É um resultado
   legítimo e barato de obter.

**Teto de CAC pela regra LTV/CAC ≥ 3** (Pro R$69 → R$65,56 líquidos após ~4,99%
do Mercado Pago → ~R$62 de margem após infra):

| Retenção média | LTV | Pode pagar por cliente |
|---|---:|---:|
| 3 meses | R$ 186 | **R$ 62** |
| 6 meses | R$ 372 | **R$ 124** |
| 12 meses | R$ 744 | **R$ 248** |

---

## FASE 1 — Rastreamento de conversão 🔴 sem isso, não comece

Hoje o site **não tem** `gtag`, GTM nem tag do Google Ads. Há um
`dataLayer.push` em `lib/analytics.js`, mas nada inicializa o `dataLayer` — as
chamadas não vão a lugar nenhum.

Rodar sem isso é o primeiro erro da lista de "common mistakes" do playbook: o
Google otimiza para o que você marcar; sem marcação, otimiza por clique barato.

### EU faço

| # | Ação | Detalhe |
|---|---|---|
| E1 | Carregador do gtag/GTM **desligado por env** | `NEXT_PUBLIC_GADS_ID` ausente = no-op total, mesmo padrão do SMTP e do YouTube. Zero impacto quando não configurado. |
| E2 | Inicializar `window.dataLayer` | Faz os `trackEvent` que já existem passarem a valer. |
| E3 | Conversão de **cadastro** no cliente | Evento `signup` para o Ads. |
| E4 | Capturar e persistir o **`gclid`** | A infra já existe: `login/page.js` manda `landingPage` (com query string) no registro. Extrair o `gclid` de lá e guardar no usuário. |

### VOCÊ faz

| # | Ação | Onde |
|---|---|---|
| V1 | Criar/abrir conta no Google Ads | ads.google.com |
| V2 | Criar a ação de conversão "Cadastro" | Ferramentas → Conversões → Nova → Site |
| V3 | Me mandar o **ID de conversão** (`AW-...`) e o **rótulo** | chat |
| V4 | Depois do deploy: **testar uma conversão real** | criar uma conta de teste e confirmar que aparece no Ads |

⚠️ V4 é obrigatório. O checklist do playbook exige "conversão testada com uma
conversão real", não "tag instalada".

### A armadilha que importa aqui

**A conversão que vale é `pagamento aprovado`, não `cadastro`.** Se você otimizar
por cadastro, o Google entrega cadastro — e curioso é barato e não paga.

Mas o trial é de 7 dias, então o sinal de pagamento atrasa e, no seu volume, não
alimenta o algoritmo. **Solução:** marcar cadastro como conversão primária (para
ter volume) e **conciliar pagamento no fim do mês, na mão**. Com o `gclid`
guardado (E4), dá para importar a conversão offline de pagamento depois — o
playbook chama isso de "a mudança de maior impacto numa conta B2B".

---

## FASE 2 — Campanha (só depois da Fase 1 validada)

### Estrutura: 2 campanhas, orçamento SEPARADO

Orçamento compartilhado faz a campanha de marca (a mais barata) comer tudo, e
você fica cega justamente onde precisa de dado.

| Campanha | Palavras | Destino | Verba/dia |
|---|---|---|---|
| **Marca** | `espelha grupos`, `botinho`, `botinho whatsapp`, `botinho bot` | `/` | R$ 5 |
| **Alta intenção** | `bot para grupo de ofertas whatsapp`, `bot para achadinhos`, `bot afiliados whatsapp`, `quanto custa bot whatsapp afiliados`, `automatizar grupo de ofertas` | `/bot-afiliados-whatsapp` | R$ 20-25 |

**Por que marca primeiro:** é o degrau 1 da escada de intenção. Cliques mais
baratos, maior conversão. E se você não der lance no seu nome, o concorrente dá
— e você paga em venda perdida, não em clique.

**Concorrente (`achadinho pro`, `proafiliados`, `shozap`, `fluxopromo`) fica para
a Fase 4.** O playbook manda rodar concorrente só com página de comparação
dedicada — você tem, mas só depois dos dois primeiros degraus provarem que
convertem. "Não pule degraus."

### Configurações que economizam dinheiro no dia 1 (VOCÊ)

- [ ] Tipo: **Pesquisa** apenas
- [ ] **Rede de Pesquisa (parceiros): DESLIGADA**
- [ ] **Rede de Display: DESLIGADA**
- [ ] Local: **Brasil** · opção **"Presença"** (o padrão é "presença ou
      interesse" e entrega para gente fora do Brasil)
- [ ] Correspondência: **frase e exata**. Nunca ampla.
- [ ] Lance: **CPC manual** ou **Maximizar conversões sem meta de CPA**

**Por que sem meta de CPA:** abaixo de 15 conversões/mês o algoritmo não tem o
que aprender, e meta baixa demais faz o Google simplesmente parar de entregar.

### Negativas obrigatórias (VOCÊ, no build)

```
grátis, gratis, free, crack, pirata, curso, tutorial, aula,
como ser, como criar, o que é, vaga, emprego, salário,
download, apk, planilha, reddit, alternativa gratis
```

`grátis` é a mais importante: ProAfiliados e FluxoPromo têm plano gratuito
permanente. Quem digita "bot afiliados grátis" não paga R$69.

⚠️ **Pegadinha:** negativa em **ampla exige TODAS as palavras**. Cadastrar
`bot grátis` **não** bloqueia "grátis" sozinho. Cadastre palavra por palavra.

### EU faço

| # | Ação |
|---|---|
| E5 | Escrever os **RSAs** (títulos e descrições dentro dos limites do Google) para as duas campanhas — seguindo o `rsa-output-spec.md` da skill |
| E6 | Entregar a lista de negativas pronta para colar |
| E7 | Revisar se a landing bate com a promessa do anúncio (regra do "headline mirroring") |

---

## FASE 3 — Operação semanal (VOCÊ · 20 min/semana)

### Ritual dos termos de busca — 3 passadas

1. **Desperdício:** termo com 3+ cliques e zero conversão → vira negativa
2. **Vencedores:** termo que converteu e ainda não é palavra-chave → adicionar
   como exata/frase
3. **Desvio:** frase puxando sentido errado → apertar a correspondência

### Placar semanal — exatamente estes números

```
gasto · cliques · CPC médio · cadastros · custo por cadastro
pagantes · CAC real · parcela de impressão
```

**Diagnóstico-chave:** "Parcela de impressão perdida (orçamento)" vs "(classificação)".
A primeira significa que falta dinheiro; a segunda, que o anúncio é fraco. São
problemas diferentes.

⚠️ **Não mexa todo dia.** Cada alteração reinicia o aprendizado. Mudanças de
verba: no máximo ±20% por vez, esperando 3-5 dias.

---

## FASE 4 — Só depois dos degraus 1 e 2 converterem

- Campanha de **marca de concorrente**, com destino nas páginas
  `/alternativas/proafiliados`, `/alternativas/shozap`, `/alternativas/fluxopromo`
- ⚠️ **Jurídico:** dar lance na marca do concorrente é permitido pelo Google, mas
  **não use o nome dele no título do anúncio** sem autorização. Diga "Compare
  antes de assinar", não "Melhor que o X". E espere que façam o mesmo com você.
- Importação de **conversão offline** (pagamento) via `gclid`

---

## ⛔ O que NÃO fazer

| | Por quê |
|---|---|
| **Performance Max** | Nunca como primeira campanha, nunca com rastreamento fraco, nunca com verba pequena — você tem os três |
| **Correspondência ampla** | Só liberada com 30+ conversões/mês e lista de negativas madura |
| **Bidar em `shopee afiliados` e afins (50.000/mês)** | Intenção errada. Queima a verba em dias |
| **Mais de 3 campanhas** | Fragmentar verba é erro listado; no seu volume, menos campanhas bem alimentadas ganham |
| **Mandar tudo para a home** | Cada anúncio no destino do assunto dele |
| **Usar CPC de referência estrangeiro** | Os números publicados são B2B americano em dólar. Ancore nos seus próprios 30 dias |

---

## Em paralelo — a aposta de crescimento de verdade

O Ads é experimento. **O YouTube é onde estão os 50.000/mês.**

O canal já existe (`@botinhoafiliado`) e desde 04/08 está declarado no `sameAs`
do schema, então conta como a mesma entidade que o site para Google e IA.

Conteúdo que ataca a demanda real: "como ser afiliado Shopee", "como montar grupo
de ofertas", "quanto ganha afiliado". Ali a pessoa está aprendendo — e é onde a
ferramenta aparece naturalmente.

Isso é trabalho seu, não meu, e vale mais que todo o resto deste documento.

---

## Ordem final

```
VOCÊ hoje:        FASE 0 (decidir + número de retenção)
EU em seguida:    E1-E4 (rastreamento)
VOCÊ:             V1-V4 (conta, conversão, ID, TESTE REAL)
EU:               E5-E7 (anúncios e negativas)
VOCÊ:             montar as 2 campanhas + configurações
VOCÊ semanal:     ritual + placar de 8 números
DEPOIS de provar: FASE 4 (concorrente + conversão offline)
SEMPRE:           YouTube
```
