# Análise competitiva — Afilira (afilira.com) × Espelha Grupos — 2026-09-28

Fontes: site público (home, /precos, /pricing.md, /llms.txt, /robots.txt, sitemap
com 80 URLs, /sobre, /termos, /status, blog), **área logada com conta de teste sem
plano** (/dashboard, /dashboard/planos, /dashboard/checkout), BrasilAPI (CNPJ), RDAP
(domínio), Reclame Aqui de ferramentas vizinhas, e o nosso repo (planos, painel,
SEO, RCAs, `dashboard/lib/competitors-data.js`).
Legenda: **[F]** fato verificado · **[H]** hipótese (sem dado que confirme).

Limite da análise interna: a conta de teste **não tem plano**. Toda rota interna
(`/grupos`, `/garimpar`, `/vitrine`, `/relatorios`, `/aquecimento`, `/criar-grupos`,
`/membros`, `/programar-mensagem`, `/indicar` etc.) redireciona para `/dashboard/planos`.
Só a visão geral do painel, a página de planos e o checkout foram vistos por dentro.

---

## 0. Quem é o Afilira (contexto que muda a leitura)

- **[F]** Empresa individual (ME) aberta em **04/05/2026**, capital R$ 2.400,
  Capão da Canoa/RS, CNAE de pós-produção de vídeo. Responsável: Alan dos Santos de Borba.
- **[F]** Domínio registrado em **22/05/2026** → produto com ~4 meses.
- **[F]** Mesmo CNPJ opera o **Disparly** (WhatsApp com IA, a partir de R$ 297) e
  empurra o **MeuGrupo** (diretório de grupos) dentro do painel.
- **[F]** Stack Next.js + Tailwind, VPS (DNS Hostinger). Google Ads ativo (gtag `AW-18020250302`).
- **[F]** Sitemap: 80 URLs, quase todas com `lastmod` entre 03 e 24/09/2026 → **produção de
  conteúdo em massa agora**. Blog: 15 posts em 17 dias.
- **[H]** Operação de uma pessoa, crescendo por **SEO programático + GEO + Google Ads**.
  Ele "sempre aparece" porque cobre, em 30 dias, as mesmas intenções de busca que nós
  levamos meses para cobrir.

---

## 1. Vantagem do concorrente (o que ele tem e nós não)

### 1.1 Produto
| Recurso Afilira | Plano | Nós |
|---|---|---|
| **Feed da comunidade** (ofertas compartilhadas pela rede P2P) → cliente sem grupo de origem já recebe ofertas | Todos (Starter incluso) | ❌ (temos Ofertas automáticas só Shopee, PRO) |
| **Telegram** como origem e destino | Pro 97 | ❌ |
| **Postar no Status** do WhatsApp | Pro 97 | ❌ |
| **Vários números** (3 no Pro, 10 no Enterprise) | Pro/Ent | ❌ (1 sessão por conta) |
| **Awin** (Casas Bahia, KaBuM!, Centauro, Dafiti, Nike, Adidas, Carrefour, Leroy) + **Terabyte** | Pro | ❌ (temos 6 lojas) |
| **Filtros por grupo** (assunto e loja por destino) + "Ordem das lojas" | Pro | Parcial |
| **Escolher melhores ofertas** (scoring) / anti-saturação | Pro | ❌ |
| **Avisos no privado**: pessoa manda `!produto` no PV, bot avisa e lembra por 3/5/7 dias | Pro | ❌ |
| **Boas-vindas e saída no PV**, **criar grupos em lote**, **convidar membros** (intervalo 2 min) | Pro | ❌ |
| **Preparar número** (aquecimento) | Pro | ❌ (temos "Anti-banimento" = ritmo, não aquecimento) |
| **Minha Vitrine** (página pública com ofertas escolhidas, link compartilhável) | Pro | ❌ |
| **Extensão Chrome** para capturar produtos do ML | Pro | ❌ |
| **Revisar antes de enviar** (fila de revisão) | Pro | Parcial (fila de revisão só em ofertas automáticas) |
| **API REST + webhooks** | Enterprise | ❌ |
| **Página /status** com uptime por componente | público | ❌ |

### 1.2 Preço e embalagem da oferta
- **[F]** 3 degraus 47 / 97 / 197, meio marcado "MAIS POPULAR". Preço dobra a cada degrau
  (ancoragem clássica).
- **[F] Dentro do painel** (não aparece no site público): **Trimestral −10%, Semestral −20%,
  Anual −30%**. Nós não temos pagamento por período → eles antecipam caixa e reduzem churn.
- **[F]** **Não tem trial**: "a conta é grátis, o robô é pago". A conta grátis funciona como
  **vitrine do produto**: o cliente entra, vê ~30 recursos com cadeado e só consegue sair
  pelo "Ver planos".
- **[F]** Promessas repetidas em todo lugar: "sem anúncios e sem tag 'via Afilira'",
  "sem celular ligado", "sem fidelidade, cancela com 1 clique e mantém acesso até o fim".
- **[F]** Checkout próprio em 3 passos (Planos › Checkout › Ativação), PIX com CPF (Mercado
  Pago) ou cartão (Pagar.me), "confirmação automática", "ativação imediata".

### 1.3 Prova social e gatilhos
- **[F]** Prova social **fraca**: 3 depoimentos anônimos ("Cliente Afilira") em print de WhatsApp,
  nenhum número de clientes, nenhum aggregateRating. YouTube @afilira com 71,9 mil inscritos e
  **zero vídeos** ([H] canal comprado/reaproveitado).
- **[F]** Gatilho forte de **confiança/transparência**: seção "O que o Afilira não faz hoje",
  página /sobre com CNPJ e nome do dono, "não garantimos comissão nem que o WhatsApp não vá
  bloquear", /status público.
- **[F]** Sem urgência, sem escassez, sem popup, sem chat/WhatsApp flutuante no site.
  **Sem programa de indicação**.

### 1.4 Conteúdo, keywords e presença digital
- **[F]** Clusters do sitemap:
  - Loja: 9 páginas (`bot-afiliados-shopee`, `afiliado-mercado-livre`, `bot-amazon-afiliados`,
    `bot-aliexpress-afiliados`, `bot-magalu-afiliados`, `bot-shein-afiliados`,
    `bot-terabyte-afiliados`, `afiliados-awin-whatsapp`, `bot-telegram-afiliados`).
  - Comerciais: `bot-para-afiliados`, `bot-de-ofertas-whatsapp`, `automacao-afiliados-whatsapp`,
    `bot-de-afiliados-preco`, `recursos`, `precos`.
  - Comparação: 5 "Afilira vs" + 9 "Alternativa a" + `/melhor-bot-afiliados-2026` (tabela de 11
    ferramentas com preço).
  - Persona: afiliados, agências, influencers, lojas.
  - Guias: como ser afiliado Shopee/ML/Amazon, aquecimento, criar grupos, black friday.
  - Ferramentas grátis: encurtador, conversor de link, calculadora de ROI.
  - Blog de **suporte-como-conteúdo**: "bot conectado mas não envia", "imagem da oferta não
    aparece no WhatsApp", "link de afiliado não gera comissão".
- **[F]** GEO: `robots.txt` libera GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot,
  Claude-SearchBot, Google-Extended; tem `llms.txt` e `pricing.md`; JSON-LD de
  Organization (com CNPJ), SoftwareApplication com as 3 ofertas, FAQPage, HowTo,
  **SpeakableSpecification**.
- **[F]** **Não cita o Espelha Grupos** em nenhuma página (nem nas comparações).
- **[F]** Não aparece nos comparativos de terceiros que abrimos (OfertasBot, Pai das Ofertas).
  Sem Reclame Aqui encontrado (consulta bloqueada por Cloudflare — não confirmado).

---

## 2. Usabilidade, UI/UX e painel

### 2.1 Site público
| Critério | Afilira | Espelha Grupos |
|---|---|---|
| Tema | Escuro (#060608), gradiente vinho, CTA coral/laranja, Space Grotesk + mono | Claro menta (#EEF6F2), Figtree, PRO roxo |
| Percepção | "Dev/fintech", premium, tecnológico | Acolhedor, feminino, simples |
| Headline | "Bot de afiliados para WhatsApp e Telegram: ofertas 24/7" (keyword exata no H1) | "Chega de copiar e colar oferta uma por uma" (dor, sem keyword no H1) |
| Hero | Painel "DEMONSTRAÇÃO" animado (contador 248→250, feed ao vivo) | Texto + vídeo |
| Prova | 3 prints anônimos | Nenhum número/depoimento hoje (removido por falta de lastro) |
| Mobile | Banner de cookies cobre ~metade da 1ª tela; H1 em 4 linhas | — |

**Leitura:** o Afilira vende **"máquina funcionando"** (painel vivo, pipeline, 24/7). Nós vendemos
**"alívio de tarefa"**. Para quem compara em 10 segundos, o hero dele comunica "produto robusto".

### 2.2 Onboarding e painel (área logada)
- **[F]** Primeira tela: "Olá, Flavia. **Seu bot ainda não está no ar.**" (status em vermelho,
  frase de estado, não de boas-vindas) + card "Você está sem plano" + **checklist "Faltam 4
  passos para o bot rodar — 0 de 4"** (afiliado → WhatsApp → origem → destino).
- **[F]** Card "SEU DIA NO AFILIRA": explica as métricas antes de existirem (enviadas hora a hora,
  envios aceitos, **filtradas com o motivo**).
- **[F]** "Atividade": cada oferta publicada com hora e, quando ficou de fora, **o motivo**.
- **[F]** Painel é **uma página longa de cards** agrupados (Conectar · Plataformas "0 de 8
  configuradas" · Regras de envio · Disparar · Acompanhar · Grupos e membros · Canais de envio ·
  Conta), cada item com selo "Plano pago" ou "Pro/Enterprise". Sem menu lateral.
- **[F]** Upsell embutido: Telegram com card próprio "PROFESSIONAL/ENTERPRISE — Ver planos";
  cross-sell do MeuGrupo ("Divulgue seu grupo de graça") em 3 pontos.
- **[F]** Suporte: botão "Suporte" destacado no topo + "Abrir chat de suporte" + link de tutorial
  em vídeo + "Aprenda a pegar as informações (passo a passo por loja)".
- **Pontos fracos de UX observados:**
  - Tudo aparece bloqueado para quem não pagou → nada de "momento aha" antes de pagar (nós temos
    7 dias com tudo liberado).
  - Página única longa com ~30 cards: **baixa escaneabilidade**, mistura configuração com relatório.
  - Rotas internas redirecionam silenciosamente para /planos (o usuário clica em "Relatórios" e
    cai em preços — frustrante).
  - Checkout PIX exige CPF antes de mostrar o código.

**Comparação com o nosso painel:** nós temos menu lateral por tarefa (Criar & enviar /
Acompanhar / Configuração), prévia de recurso PRO clicável (`ProGate`), card de **comissão Shopee
hoje** e tela **Vendas** (comissão por dia e produtos que mais venderam) — **o Afilira não mostra
dinheiro, só volume de envio**. Isso é retenção: quem vê comissão no painel entende o ROI.

---

## 3. Nossa vantagem (o que nós temos e ele não)

| Diferencial | Como vira argumento de venda |
|---|---|
| **7 dias grátis com tudo do PRO, sem cartão** (ele: conta grátis, robô pago) | "Teste o robô funcionando de verdade, não uma vitrine com cadeado." |
| **Preço**: Basic R$ 39 / PRO R$ 69 com grupos (até 50) × Starter R$ 47 com **1 origem + 1 destino** | "Por R$ 69 você tem o que no Afilira custa R$ 97." (espelhamento só entra no Pro 97 dele) |
| **Espelhamento é o core** (desde o Basic) | "Espelhar grupos é o nosso produto, não um recurso do plano do meio." |
| **Comissão/Vendas Shopee no painel** | "Veja quanto o robô te fez ganhar hoje." Ele só mostra envios. |
| **Marca d'água, variação de texto, templates, cupons, Criar oferta a partir de link, Testar conversão** | Personalização da oferta = grupo com cara própria (ele promete só "sem tag") |
| **Guard de link**: se não converteu, não envia (`mirrorLinkGuard`) | Ele também tem ("não vai com link de terceiro") → empate; comunicar como garantia |
| **Indique e ganhe 30% recorrente** + parceria de influenciadores | Ele não tem programa de indicação → recrutar afiliados-influenciadores dele |
| **Suporte humano por WhatsApp em todos os planos** (ele: Starter só pelo painel) | "Falou com gente de verdade desde o plano básico." |
| **Tração orgânica real**: 680 cliques/3 meses, posição média 6,47; ChatGPT = 35% dos cadastros | Base para PR de dados e GEO |
| **Empresa com histórico** (produto mais antigo, RCAs, operação estável) × MEI de 4 meses | Página "É confiável?" com tempo de mercado, nº de ofertas espelhadas (só com lastro) |

---

## 4. Oportunidade de ouro (o que nenhum dos dois atende)

Dores de mercado com dado (Reclame Aqui de ferramentas vizinhas e nossas RCAs):
1. **Número banido** logo após conectar o bot, sem suporte nem reembolso (BotConversa, Wsystem).
2. **Cobrança indevida / difícil cancelar** (BotConversa).
3. **Conta de afiliado Shopee suspensa** por "conteúdo irrelevante" (RA Shopee).
4. **Oferta sem foto / imagem só aparece se clicar** (nossas RCAs; blog do Afilira também trata).
5. **"Conectado mas não envia"** (nossas RCAs e blog dele).
6. **Iniciante sem grupo e sem audiência** — nenhum dos dois ajuda a *crescer o grupo*
   (Afilira só joga para o diretório MeuGrupo).

Gaps que ninguém cobre hoje [H — validar com 5 entrevistas]:
- **Painel de ROI multi-loja** (comissão de Shopee + ML + Amazon juntos, por grupo e por oferta).
- **"Plano anti-ban" com garantia** (aquecimento guiado + limite automático + reembolso proporcional
  se o número cair nos primeiros 7 dias).
- **Crescimento de audiência**: link de convite rastreado, página pública do grupo (vitrine),
  ranking de grupos que mais convertem, "copiloto de nicho".
- **Conformidade com regras de afiliado** (checagem de texto proibido pela Shopee antes de enviar).
- **Onboarding "do zero ao primeiro R$"** para iniciante: criar credencial, grupo, primeira oferta
  em 15 min, com acompanhamento humano.

**Posicionamento proposto:** *"O único robô que mostra quanto você ganhou — e protege seu número
enquanto trabalha."* (ROI + segurança + simplicidade, em vez de guerra de lista de recursos).

---

## 5. SEO e GEO

### 5.1 Google
Estado: nós temos 139 rotas no registro SEO, ~23 posts, 23 páginas `/alternativas/*` (inclusive
`/alternativas/afilira`), 5 páginas por loja. Mas as páginas por loja têm só 353 impressões/7 cliques
e as `/alternativas` antigas deram **0 cadastro** (ANALISE_SEO_2026-09-11). O Afilira ganha por
**keyword exata no H1/title** e por cobrir *toda* a família de termos "bot".

Clusters a disputar (termos exatos que ele usa no title/URL):
- **Comercial "bot"**: bot para afiliados · bot de ofertas whatsapp · bot de afiliados preço ·
  automação afiliados whatsapp · melhor bot de afiliados 2026 · bot achadinhos whatsapp.
- **Loja**: bot afiliados shopee · bot mercado livre afiliados · bot amazon afiliados · bot shein
  afiliados · bot magalu afiliados · bot aliexpress afiliados.
- **Canal** (só depois de ter o recurso): bot telegram afiliados · postar oferta no status whatsapp.
- **Suporte-como-conteúdo** (nossas RCAs viram post): bot conectado mas não envia · oferta sem foto
  whatsapp · link de afiliado não gera comissão · whatsapp banido por bot o que fazer · como aquecer
  número whatsapp · shopee suspendeu afiliado.
- **Dinheiro**: quanto ganha afiliado shopee · calculadora de comissão shopee · quanto ganha grupo
  de ofertas.
- **Comparação** (mudar formato, já que as antigas não convertem): 1 página
  "Espelha Grupos vs Afilira" com tabela preço-por-grupo e CTA de trial; "melhor bot para afiliados
  2026" com metodologia e dados próprios.

Autoridade/links: guest post em blogs de afiliados (Pai das Ofertas, OfertasBot publicam
comparativos e **não citam nenhum dos dois**), parceiros influenciadores com link, perfil no
Reclame Aqui (verificado e com resposta), listagens (Capterra/B2B Stack/Product Hunt BR).

### 5.2 IAs (GEO)
- Igualar o básico que ele já fez: `robots.txt` liberando OAI-SearchBot/ChatGPT-User/PerplexityBot/
  Claude-SearchBot/Google-Extended (conferir o nosso), `SoftwareApplication` com as `Offer`
  dos planos, `SpeakableSpecification`, `Organization` com CNPJ e `foundingDate`.
- Ir além: **dado próprio citável** (ex.: "relatório trimestral: horário que mais converte em grupos
  de oferta, taxa de conversão por loja" — só com números do nosso banco), publicado como página
  + PDF + post; é o tipo de fonte que Perplexity/ChatGPT citam.
- Corrigir o risco já medido: AI Overviews associa "espelha grupos é confiável" a golpe de
  espelhamento de tela → página "Espelha Grupos é confiável?" com CNPJ, tempo de mercado,
  política de reembolso, nomes reais.
- Responder a crítica do Perplexity ("falta garimpo próprio") com o recurso (item P2-03) e depois
  com conteúdo.
- Monitorar mensalmente com o playbook existente (`AI_SEO_MONITORAMENTO_MENSAL_PLAYBOOK.md`),
  incluindo o prompt "melhor bot de afiliados para WhatsApp" e "alternativa ao Afilira".

---

## 6. Backlog consolidado

| ID / Tarefa | Categoria | Descrição breve (o que + impacto esperado) | Impacto | Esforço | Prioridade |
|---|---|---|---|---|---|
| **EG-01** Pagamento por período (trimestral −10%, semestral −20%, anual −30%) | Vendas/Growth | Ciclos maiores no Mercado Pago; antecipa caixa e reduz churn (o Afilira já faz dentro do painel) | Alto | Médio | P1 |
| **EG-02** Tabela "preço por grupo" na /precos e na home | Vendas/Growth | Mostrar lado a lado: Espelha R$ 69 com grupos × concorrente R$ 47 com 1 origem/1 destino | Alto | Baixo | P1 |
| **EG-03** H1/title da home com keyword exata ("bot para afiliados…") | SEO | Manter a dor como sub-headline; ganha relevância para "bot de afiliados" | Alto | Baixo | P1 |
| **EG-04** Hero com painel "ao vivo" do robô (demo animada, marcada como ilustrativa) | UI/UX | Comunica "máquina funcionando" em 3 s; usar tokens do DS (aprovar padrão antes) | Médio | Médio | P2 |
| **EG-05** Seção "O que o Espelha Grupos não faz" + página "É confiável?" | Vendas/Growth | Transparência + CNPJ + tempo de mercado + reembolso 7 dias; ataca o risco "golpe" nas IAs | Alto | Baixo | P1 |
| **EG-06** Depoimentos reais (vídeo/print com nome e @) de 5 clientes pagantes | Vendas/Growth | Prova social verificável (a dele é anônima); pedir em troca de 1 mês grátis | Alto | Baixo | P1 |
| **EG-07** Garantia explícita "7 dias ou seu dinheiro de volta" no checkout/preços | Vendas/Growth | Já é política (CDC); ele não usa como argumento | Médio | Baixo | P1 |
| **EG-08** Motivo visível para oferta que ficou de fora (tela Envios) | Produto | "Filtrada: sem credencial ML / link não converteu"; reduz ticket "não enviou" | Alto | Médio | P1 |
| **EG-09** Home do painel com frase de estado ("Seu robô está no ar / parado porque…") | UI/UX | Status em 1 linha + próximo passo; reduz abandono no onboarding | Médio | Baixo | P1 |
| **EG-10** Página "Espelha Grupos vs Afilira" no novo formato (tabela preço-por-grupo + CTA trial) | SEO | Substituir o formato `/alternativas` que não converte; medir cadastro | Médio | Baixo | P1 |
| **EG-11** Conferir/ajustar `robots.txt` para bots de IA + JSON-LD SoftwareApplication/Offer/Speakable | GEO/IA | Igualar o que ele já tem | Médio | Baixo | P1 |
| **EG-12** 6 posts "suporte-como-conteúdo" a partir das RCAs | SEO | "Conectado mas não envia", "oferta sem foto", "número banido", "link não gera comissão", "aquecer número", "Shopee suspendeu" | Alto | Médio | P1 |
| **EG-13** Reescrever as 5 páginas por loja com keyword exata (bot afiliados shopee etc.) | SEO | Hoje 353 impressões/7 cliques; alinhar title/H1/URL ao termo de busca | Alto | Médio | P2 |
| **EG-14** Campanha "Troque de robô": 1º mês R$ 39 no PRO para quem vem de outro bot | Vendas/Growth | Captura base insatisfeita; landing + código | Médio | Baixo | P2 |
| **EG-15** Recrutar influenciadores de afiliados (30% recorrente) com foco em quem divulga concorrentes | Vendas/Growth | Ele não tem programa de indicação | Alto | Médio | P2 |
| **EG-16** Perfil verificado no Reclame Aqui + SLA de resposta | Vendas/Growth | Confiança e GEO (IAs citam RA) | Médio | Baixo | P2 |
| **EG-17** Página /status pública (uptime conexão, conversão, envio) | Produto | Confiança; responde "o robô caiu?" sem ticket | Médio | Médio | P2 |
| **EG-18** Relatório de ROI multi-loja no painel (Shopee + ML + Amazon por grupo) | Produto | Diferencial que nenhum dos dois tem; retenção | Alto | Alto | P3 |
| **EG-19** Ofertas automáticas para ML/Amazon ("garimpo" além da Shopee) + feed pronto para quem não tem grupo de origem | Produto | Responde o "feed da comunidade" dele e a crítica do Perplexity | Alto | Alto | P2 |
| **EG-20** Filtros por destino (loja e categoria por grupo) + ordem das lojas | Produto | Paridade com o Pro dele | Médio | Médio | P2 |
| **EG-21** Telegram como destino (⚠️ memória) | Produto | Paridade; exige estimativa de RAM + OK antes (Regra #1) | Médio | Alto | P3 |
| **EG-22** Postar no Status do WhatsApp | Produto | Paridade; mesma sessão, sem processo novo [H] | Médio | Médio | P2 |
| **EG-23** Vários números por conta (⚠️ memória: +0,35 GB por sessão) | Produto | Upsell para agências; plano "Agência" | Médio | Alto | P3 |
| **EG-24** Boas-vindas no PV para novos membros + link de convite rastreado | Produto | Crescimento de audiência (gap de mercado) | Médio | Médio | P3 |
| **EG-25** Vitrine pública do grupo (página com ofertas + link de entrar no grupo) | Produto | Crescimento + SEO de cauda longa | Médio | Alto | P3 |
| **EG-26** Aquecimento guiado de número + "garantia anti-ban 7 dias" | Produto | Maior dor do mercado; argumento que ninguém tem | Alto | Alto | P3 |
| **EG-27** Relatório de dados próprio trimestral (horário que converte, loja que converte) | GEO/IA | Fonte citável por IAs e imprensa; PR digital | Alto | Médio | P2 |
| **EG-28** Guest posts/listas "melhores bots para afiliados" (Pai das Ofertas, OfertasBot etc.) | SEO | Links + menção onde ele também não está | Médio | Médio | P2 |
| **EG-29** Calculadora de comissão/ROI de afiliado (ferramenta grátis) | SEO | Ele tem calculadora de ROI; nós temos risco e tempo | Médio | Baixo | P2 |
| **EG-30** Checagem de texto proibido pela Shopee antes de enviar | Produto | Gap de mercado (suspensão de afiliado) | Médio | Médio | P3 |
| **EG-31** Monitoramento mensal: "Afilira" e "melhor bot de afiliados" em ChatGPT/Gemini/Perplexity | GEO/IA | Medir se passamos à frente | Médio | Baixo | P1 |
| **EG-32** Google Ads na marca e em "bot de afiliados" (o Afilira já roda Ads) | Vendas/Growth | Proteger a marca e disputar o termo; ver PLANO_GOOGLE_ADS_2026-08-04 | Médio | Baixo | P2 |

## Roadmap

**Sprint 0–30 dias (P1, alto impacto/baixo esforço):** EG-02, EG-03, EG-05, EG-06, EG-07,
EG-09, EG-10, EG-11, EG-31 → depois EG-01, EG-08, EG-12.

**Escala 30–90 dias (P2 — retenção, autoridade, painel):** EG-13, EG-14, EG-15, EG-16, EG-17,
EG-19, EG-20, EG-22, EG-27, EG-28, EG-29, EG-32, EG-04.

**Domínio 90+ dias (P3 — diferenciais e gaps):** EG-18, EG-26, EG-24, EG-25, EG-30, EG-21, EG-23.
EG-21 e EG-23 aumentam RAM → só com estimativa e OK (política de memória).

---

## Métrica de "vender tanto quanto ele"
Não há dado público de vendas do Afilira. Proxy que dá para medir: impressões e posição nos termos
do cluster "bot" (Search Console), taxa de citação nas IAs (playbook mensal), e nosso funil
(hoje 516 visitas → 119 cadastros → 12 pagantes em 30 dias, 2,3% visita→pagante).
