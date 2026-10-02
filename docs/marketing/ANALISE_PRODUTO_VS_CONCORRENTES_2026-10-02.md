# Produto × divulgação × concorrentes — 02/10/2026

Fontes: código em `develop` = `main` (último merge #2139, 01/10), site público
(`marketing-content.js`, `ficha-tecnica.js`, `components/landing/*`,
`_comparisonContent.js`, `_preservationCommercialPages.js`, `llms.txt`,
`pricing.md`, `sales-enablement/`), análises `ANALISE_CONCORRENTE_PROAFILIADOS_2026-09-27`,
`ANALISE_CONCORRENTE_AFILIRA_2026-09-28`, `pesquisa-mercado-2026-09-10`,
`roadmap-competitivo-2026-09` e as 25 fichas de `dashboard/lib/competitors-data.js`.
Decisões já tomadas (`PENDENCIAS_UNIFICADAS_2026-09-28`, Parte 5) foram respeitadas.
Legenda: **[F]** fato no código/site · **[H]** hipótese · **[D]** depende de dado da VPS.

---

## 0. Resumo em 5 linhas

1. Entre 29/09 e 01/10 saíram para `main` **6 recursos que o site não cita**: Awin,
   Rakuten (conversão e ofertas automáticas), Link Inteligente, painel de Membros,
   avisos de link cheio. Vários deles respondem direto ao que os concorrentes vendem.
2. O site e as comparações dizem coisas que **o código desmente**: "só 6 lojas", "garimpo
   só Shopee", "4 lojas" em 6 comparativos, "robô publica sozinho só no R$69",
   "você revisa antes" (a revisão está desligada por flag).
3. **Nosso posicionamento "o único que mostra comissão" está errado.** Gigi Bot e Easyfy
   (comissão Shopee + Awin) e LucreShop (ROI) já anunciam isso. Achify anuncia marca d'água.
4. Os maiores buracos de produto, contando quantos dos 23 concorrentes têm:
   Telegram (~16), vários números (~13), vitrine/link na bio (~11), IA de texto/imagem (~8),
   garimpo de ML/Amazon (~8), plano grátis permanente (~6).
5. Há **recursos prontos e desligados** que viram ganho rápido: fila de revisão,
   link rastreado (`/r/`), conversão de link de cupom.

---

## 1. Já fazemos e NÃO divulgamos

Ordem: impacto comercial (quantos concorrentes vendem o item como diferencial).

| # | Recurso nosso [F] | Plano | Onde no código | Quem do mercado vende isso | Por que divulgar |
|---|---|---|---|---|---|
| 1 | **Conversão Awin** (KaBuM, C&A, Casas Bahia, Nike… só as lojas em que a cliente foi aprovada) | **Basic e PRO** (rota sem trava de plano) | `src/converters/awin.js`, `src/integrations/awin/*` | ProAfiliados (todos), Afilira (só Pro R$97), Easyfy, DivulgaLinks | Afilira cobra R$97 por Awin; nós entregamos no R$39. Derruba o "só 6 lojas" que IA e cliente usam para nos descartar |
| 2 | **Conversão Rakuten** (Netshoes e outras), com ordem Awin > Rakuten | Basic e PRO | `src/converters/rakuten.js` | ProAfiliados, Easyfy | Idem; ProAfiliados conta "12 lojas" somando redes — nós passamos a ter 6 lojas + 2 redes |
| 3 | **Ofertas automáticas com promoções/cupons Awin e Rakuten** (além da Shopee) | PRO | `src/offerAutomation/dispatcher.js:24`, `awinOffers.js`, `rakutenOffers.js` | Afilira ("busca nas lojas"), DivulgaLinks, Afiliados Turbo | O site e a página `/alternativas/afilira` dizem "garimpo só Shopee" / "não busca sozinho" |
| 4 | **Link Inteligente** `/g/<slug>`: um link só que manda para o grupo com mais vaga, teto por grupo, convite gerado pelo robô, cliques por dia, página "Grupos lotados" | PRO | `src/core/smartLinkPicker.js`, `/painel/link-inteligente` | LucreShop ("link que troca de grupo quando lota"), Ofertiva (só no intermediário) | Ataca o gap "crescer o grupo, não só abastecer" das duas análises. Ninguém do top 3 (ProAfiliados, Afilira) tem |
| 5 | **Avisos "quase cheio" / "lotou"** por e-mail e pelo próprio WhatsApp | PRO | `src/jobs/smartLinkAlerts.js` | ninguém anuncia | Diferencial puro |
| 6 | **Painel de Membros** (total por grupo, variação 24 h/7 d/30 d) | PRO | `/painel/membros`, `src/jobs/groupMemberSamples.js` | ProAfiliados (entraram/saíram), LucreShop (por DDD) | Paridade com o ProAfiliados que a análise de 27/09 marcava como "não temos" |
| 7 | **Encaminhar mensagens sem link** (texto, foto, vídeo, áudio, figurinha, documento) | Basic e PRO | `espelhamento/page.js:807`, `forwardMode=ALLOW_NO_LINK` | ProAfiliados ("Copiar Tudo") | O backlog ainda lista isso como **B38 "não temos"**. Falta só conferir enquete/localização/contato [H] |
| 8 | **Mensagem de boas-vindas** por grupo de destino | Basic e PRO | `src/bot-worker.js:4268` | ProAfiliados, Afilira (Pro) | Só aparece em 2 linhas de comparativo |
| 9 | **7 modelos prontos por nicho** (clássico, simples, moda, casa, tech, bebê, beleza) + 14 variáveis + frases que variam | Basic (variação = PRO) | `dashboard/lib/mobileOfferComposer.js` | ProAfiliados (5 modelos) | Backlog B08 ainda diz "temos 2". Nenhuma página mostra |
| 10 | **Conectar pelo número** (código, sem câmera) | Basic e PRO | `src/api/routes/session.js:347` | ProAfiliados divulga | A ficha técnica pública diz só "conecta por QR Code" |
| 11 | **Avisos fora do painel**: e-mail "robô parado", "código de acesso venceu", "Shopee recusou a chave", resumo semanal; mensagens no próprio WhatsApp da cliente na 1ª semana | Todos | `src/emailTriggers/*`, `src/core/selfWelcomeMessage.js` | ninguém anuncia | Só a página da Shopee cita o e-mail. O backlog B32 trata como "não temos" — em boa parte já temos |
| 12 | **Robô se conserta sozinho**: reconecta quando para de receber, reenvia para quem vê "Aguardando mensagem" | Todos | `receptionSelfHeal.js`, `sentMessageStore.js` | ninguém anuncia | Responde à dor nº 5 do mercado ("conectado mas não envia") sem prometer anti-ban |
| 13 | **Oferta de grupo que usa site próprio/encurtador**: o robô abre o link e acha a loja por trás | Todos | `src/core/customDomainLinkResolver.js` | ninguém anuncia | Argumento de "pega oferta que os outros perdem" |
| 14 | **Motivo de cada oferta que não saiu** + "Entenda e resolva" por erro + gráfico de entrega | Todos | `src/api/routes/logs.js`, `/painel/envios` | Afilira ("filtradas com o motivo") | Site diz só "histórico de logs" |
| 15 | **Diagnóstico do robô no topo de toda tela** + primeiros passos com vídeo | Todos | `ScreenAssistant.js`, `/painel/checklist` | ProAfiliados (é o forte dele) | Serve para print/vídeo de onboarding |
| 16 | **Mecanismos de ritmo concretos**: "digitando…", intervalo entre destinos, limite de seguir canais com aquecimento, variação leve da foto, nota de risco 0–100 por canal | PRO (parte) | `followGuard.js`, `imageMutation.js`, `reportRiskScore.js` | ProAfiliados tem só espera global (vinha "sem espera" ligado) | Divulgar o **mecanismo**, nunca "não bane" |
| 17 | **Programa de indicação 30% recorrente em Pix** | Todos | `/painel/afiliados` | ProAfiliados dá 15 dias; Afilira não tem | Só no `llms.txt`; fora da home e de `/precos` |
| 18 | **Cupons próprios** escolhidos sozinhos pelo melhor cupom válido | Todos | `clientCouponPolicy.js` | Promium (cupom por IA) | Já está na home — ok, só reforçar |

---

## 2. Já fazemos e divulgamos DIFERENTE — corrigir

| # | O que está publicado | Onde | O que é verdade [F] | Correção |
|---|---|---|---|---|
| 1 | "6 lojas" | home, `/precos`, ficha, `llms.txt`, `pricing.md`, meta description | 6 lojas + Awin + Rakuten | "6 lojas + as lojas em que você é aprovada na Awin e na Rakuten" (**só depois do dado [D] da seção 5**) |
| 2 | "Plataformas suportadas: 4" / "Shopee, Amazon, ML e Magalu" | `_comparisonContent.js` L84, L320, L375, L515, L617; "5 lojas" em L446; `competitors-data.js` (Promium: "mais que as cinco do nosso plano") | 6 + 2 redes | Trocar todas |
| 3 | Material de venda com 4 lojas e nome "BOTinho" | `sales-enablement/one-pager.md`, `quadro-objecoes.md` | — | Reescrever |
| 4 | "Garimpo só Shopee" / "O Afilira BUSCA a oferta sozinho, o Espelha não" | ficha, Features, `_comparisonContent.js` L1010 | Shopee + promoções Awin/Rakuten | Corrigir; L1010 é fato errado contra nós |
| 5 | "A partir de quanto o robô publica sozinho: R$69 (Pro)"; Pro = "o plano do piloto automático" | L801, L1061, L895, L964, L1172 | Basic espelha sozinho desde R$39 | Igualar ao `pricing.md` |
| 6 | Hero: "você revisa o que quiser antes"; pílula "Revisão humana" | `Hero.jsx:121`, `app/page.js:62` | A fila de revisão está **desligada** (`OFFER_AUTOMATION_REVIEW_ENABLED`); espelhamento sai direto | Liberar a fila (seção 3, item 1) **ou** tirar a frase |
| 7 | Selo do PRO "Canais + Automação + **Anti-banimento**" | `Pricing.jsx:113` | Regra da casa: nunca prometer anti-ban; a própria ficha diz "nenhum software garante" | "Canais + Automação + Ritmo de envio" |
| 8 | "Grupos, Canais e Comunidades" sem dizer que canais é PRO; "Comunidades" não existe na ficha | L189, L270, L849, L968, L1381, L1482 | Canais = PRO; comunidades não confirmado [H] | Marcar "(canais no PRO)"; tirar "Comunidades" até testar |
| 9 | "Sem cobrança por conexão extra de WhatsApp" | L1070 | 1 número por conta (multi-número só lista de espera) | Remover |
| 10 | "Menor preço do mercado", "Broadcast em massa", "24/7 sem limites" | L84, L193 | FluxoPromo R$37 e LucreShop R$29,90 são mais baratos; temos teto por hora/dia de propósito | Remover os três |
| 11 | "Converte link de cupom em todas as 6 lojas" | ficha, `llms.txt:16`, Magalu | Desligada por padrão no código, mas **ligada em produção** (`COUPON_LINK_CONVERT=true`, conferido 02/10) | ✅ Promessa vale. Só falta a página do ML citar cupom (hoje diz "link de produto") |
| 12 | "5 camadas" × "quatro camadas" | `_preservationDecisionPages.js` L126 × L130 | — | Igualar |
| 13 | "Respondemos em minutos" × "até 1 dia útil" | `FAQ.jsx:92` × `marketing-content.js:65` | — | Ficar com "até 1 dia útil" |
| 14 | "Configura em 4 minutos" × "Pronto em 5 minutos" | `Hero.jsx:147` × L84 | — | Um número só |
| 15 | "Limite por dia" × "limite por hora e por dia" | Features × `/precos` | Os dois existem | "por hora e por dia" em todo lugar |
| 16 | Posicionamento proposto "o único robô que mostra quanto você ganhou" e "nenhum concorrente anuncia marca d'água" | análises de 27 e 28/09, `pesquisa-mercado` §5.3 | Gigi Bot (comissão Shopee), Easyfy (comissão Shopee + Awin), LucreShop (cliques + ROI); Achify (marca d'água + moldura + selo) | Trocar "o único" por prova: print do painel de vendas, histórico completo, marca d'água — **sem** "único" |
| 17 | Fichas de concorrente que nos comparam com dado velho | `competitors-data.js` (Ofertiva: "contra as nossas 6 lojas"; Afilira: Awin "a partir do Professional") | — | Acrescentar "Awin já no Basic do Espelha" onde couber |
| 18 | `/precos` ao vivo pode mostrar texto antigo do banco | `LpPlan`/`FaqItem` editáveis no admin | — | **[D]** abrir `/precos` em produção e conferir Basic sem marca d'água/vendas |

---

## 3. Pronto no código, mas DESLIGADO (ganho rápido)

| # | Recurso | Trava | Quem vende | O que falta |
|---|---|---|---|---|
| 1 | **Revisar antes de publicar** (ofertas automáticas: guarda 5/10/20, aprova/remove em lote) | flags `OFFER_AUTOMATION_REVIEW_*` + lista de contas | Afilira, Achify | Validar em staging e ligar para todos os PRO. Resolve a promessa do Hero |
| 2 | **Link rastreado `/r/`** (cliques por oferta) | `clickTrackingEnabled` sem tela + `SHORTLINK_BASE_URL` | Easyfy, LucreShop, Promium | É o B20. Primeiro passo de "qual grupo rende" |
| 3 | ~~Conversão de link de cupom~~ | — | — | **Já ligada em produção** (02/10). Sai desta lista |
| 4 | **Status do WhatsApp** como destino | flag desligada (B40/EG-22) | ProAfiliados, Afilira, Divulga Ninja | Validação dedicada |
| 5 | **Instagram Stories** (espelhamento, filas e ofertas automáticas) | só plano Premium, que não está à venda | Divulga Ninja, IA Divulgadora, DivulgaLinks, LucreShop | Decisão de produto: zero busca (pesquisa 10/09); vender como "trazer gente para o grupo", não como motivo de troca |
| 6 | Conexão do Mercado Livre por OAuth | rota sem tela | — | Avaliar contra B41 (credencial sem cookie) |

---

## 4. O que ainda precisamos fazer (gaps reais)

Contagem = concorrentes das 25 fichas + análises que anunciam o recurso.

| Gap | Quantos têm | Situação nossa | Recomendação |
|---|---|---|---|
| **Telegram** | ~16 de 23 | só a base no código | D5 = ainda não (busca 50/mês). Manter; é objeção de venda, não fonte de cliente |
| **Vários números** | ~13 | Fase 0 (lista de espera, R$29/número aprovado) | Seguir critério da Fase 0. ⚠️ MEMÓRIA: +0,35 GB por número |
| **Vitrine / link na bio / site de ofertas** | ~11 | não temos | B33. Casa com o Link Inteligente (vitrine + botão "entrar" que usa o rodízio) |
| **Garimpo ML/Amazon** | ~8 | Shopee + Awin/Rakuten | EG-19. Achify faz ML/Amazon "para aprovar"; dá para nascer em cima da fila de revisão |
| **IA de texto/imagem** | ~8 | não (D4: não ativar Gemini) | Fora por decisão |
| **Plano grátis permanente** | 6 | teste 7 dias | B39 só com dado de outubro. ⚠️ MEMÓRIA |
| **Credencial sem cookie** (Amazon StoreID, ML etiqueta) | ProAfiliados | 3 de 6 lojas pedem Cookie Editor | B41 P1 — maior fricção do onboarding |
| **Pré-pago 3/6 meses** | 4 | decidido (4% / 7%), sem código | B11 — só código |
| **Extensão Chrome** | 5 | não | Baixa prioridade |
| **Comissão além da Shopee** (Awin) | Easyfy | só Shopee | Já guardamos o token Awin da cliente → relatório de transações Awin é o caminho mais curto para "comissão multi-loja" [H: conferir escopo do token] |
| **Filtro por destino** (loja/categoria por grupo) | Afilira, Afiliados Turbo, Afiliado Inteligente | filtro de loja só por **origem** | EG-20 |
| **Entradas/saídas em tempo real** | ProAfiliados | só amostra horária | Fase 1.5 de membros |
| Mensagens recorrentes, anti-link, alternar lojas | ProAfiliados | não | B22, B24, B23 |
| Página `/status` pública | Afilira | não | EG-17 |
| Lomadee, TikTok Shop | ProAfiliados | planos escritos | `plano-integracao-lomadee.md`, `plano-tiktok-shop.md` |
| CRM, nota fiscal, multiusuário, encher grupo/importar contatos | Afilimais, Shark, AfiliAI | não | Fora do público / risco de regra do WhatsApp — não fazer |

---

## 5. Dados que faltam (comandos para a VPS, só leitura)

1. **A promessa "inclusive cupom" vale em produção?**
   `grep -c '^COUPON_LINK_CONVERT=true' ~/wabot/.env`
   → `0` = a frase está errada no site (item 2.11).

2. **Awin/Rakuten e os recursos novos já são usados?** (decide se divulga já ou depois de 1 caso real)
   ```
   cd ~/wabot && sqlite3 prisma/prod.db "SELECT 'awin',COUNT(DISTINCT userId) FROM AwinAccount UNION ALL SELECT 'rakuten',COUNT(DISTINCT userId) FROM RakutenAccount UNION ALL SELECT 'link_inteligente',COUNT(DISTINCT userId) FROM SmartLink UNION ALL SELECT 'boas_vindas',COUNT(*) FROM \"Group\" WHERE welcomeMsg<>'' UNION ALL SELECT 'encaminha_sem_link',COUNT(*) FROM \"Group\" WHERE forwardMode='ALLOW_NO_LINK' UNION ALL SELECT 'cupons',COUNT(DISTINCT userId) FROM ClientCoupon;"
   ```
   → Awin/Rakuten `0` = divulgar como "novo" e pedir 1 cliente piloto antes de pôr no H1.
   Os outros números dizem se o recurso é usado (vale vídeo/print) ou ignorado (falta divulgar dentro do painel também).

3. **A `/precos` ao vivo bate com o código?** Abrir `https://espelhagrupos.com.br/precos` e
   conferir se o Basic NÃO lista marca d'água nem painel de vendas.

---

### Resultado (produção, 02/10/2026)

| Recurso | Uso em produção | Leitura |
|---|---|---|
| Conversão de cupom | `COUPON_LINK_CONVERT=true` | Promessa "inclusive cupom" vale |
| Awin | 1 conta | Sem caso real de cliente ainda [H: provável conta de teste] → divulgar como "novo" e buscar 1 piloto antes de pôr no título |
| Rakuten | 1 conta | Idem |
| Link Inteligente | 1 conta | Idem |
| Boas-vindas | 10 grupos | Usado sem divulgação → vale citar |
| Encaminhar sem link | 1 grupo | Quase ninguém sabe que existe |
| Meus cupons | 6 contas | ~20% das ~29 pagantes usam → vale print/vídeo |

## 6. Ordem sugerida (sem código novo primeiro)

1. Corrigir os **fatos errados contra nós** (2.2, 2.4, 2.5, 2.9, 2.10, 2.12–2.15) — só texto.
2. Tirar promessa sem lastro: "revisa antes" (2.6) e "Anti-banimento" no selo (2.7).
3. Com o dado da seção 5: atualizar "6 lojas" → "6 lojas + Awin + Rakuten" em ficha,
   `llms.txt`, `pricing.md`, home e comparativos (Afilira e ProAfiliados primeiro).
4. Divulgar Link Inteligente + Membros + avisos numa página só ("Seu grupo cheio não perde
   gente") e na tabela de planos do PRO.
5. Ligar a fila de revisão (3.1) e o link rastreado (3.2) depois de validar em staging.
6. Backlog com gap real: B41, B11, EG-19, B33, EG-20.

Páginas públicas que já estão no Google e mudarem de texto → entrar na leva 🔝 de
reindexação em `ACOES_FLAVIA_2026-09-11.md` (só depois do deploy em `main`).
