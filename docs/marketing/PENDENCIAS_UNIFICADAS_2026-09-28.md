# Tudo o que está em aberto — lista única (28/09/2026)

**Este é o documento para olhar.** Ele junta e substitui os "O que ainda falta"
dos cinco relatórios abaixo. Os relatórios continuam existindo como registro
(dados, URLs, passo a passo), mas a fila de trabalho mora aqui.

Fontes unidas: `ACOES_FLAVIA_2026-09-11.md`, `RESUMO_E_PLANO_2026-09-23.md`,
`BRIEFING_FABLE_MAQUINA_DE_VENDAS_2026-09-27.md`,
`PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md`,
`ANALISE_CONCORRENTE_PROAFILIADOS_2026-09-27.md`, mais a
`ANALISE_CONCORRENTE_AFILIRA_2026-09-28.md` (PR #1981) e a leva de indexação
da PR #1979 em `ACOES_FLAVIA` (+ o que eles mandam ler:
`PLANO_EXECUCAO_BACKLOG_PROAFILIADOS_2026-09-28.md`,
`DIAGNOSTICO_MAQUINA_DE_VENDAS_2026-09-27.md`, `PLANO_SEO_GEO_2026-09-27.md`).

## Decisões registradas (28/09/2026)

| Item | Decisão |
|---|---|
| 1.2 | Pedir depoimento às pagantes atuais que mais usam; agradecimento = **5 dias de PRO**. Comando e mensagem em `MENSAGENS_PRONTAS_2026-09-28.md` e `scripts/diag-clientes-depoimento.mjs` |
| 1.7 | O vídeo 1 (YouTube) **já está no TikTok e no Instagram** |
| 1.8 | Contato e mensagem escritos para cada canal: `MENSAGENS_PRONTAS_2026-09-28.md` |
| 1.9 CNPJ | **Não temos CNPJ** → B02 fora, segue sem razão social |
| 1.9 print | Print do painel de vendas com dados de exemplo **marcados como ilustrativos** (Claude faz; nunca venda zero) |
| 1.9 contadores | **Só um contador: ofertas enviadas nos últimos 30 dias** (número real do banco). Os demais são pequenos e ficam de fora (B05) |
| 1.9 pré-pago | **3 meses: 4% · 6 meses: 7%. Sem desconto para 12 meses (decidido: só esses dois)** (B11) |
| 1.9 sessão | **B25 parado: Flávia não sabe onde é a derrubada de 50 min.** Nada de número de queda é publicado até haver dado (ver 1.9) |
| D1 | **Sem carência de 48 h.** A partir do **5º dia do teste**, sinalizar no painel para a cliente |
| D2 | **Sim: subir o teto de 80 para 100 vagas** (ver 2.4) |
| D3 | Quando a correção estiver em `main`, Claude entrega o comando de reinício do `bot-supervisor` |
| D4 | **Não** ativar cobrança do Gemini |
| D5 | Telegram: **ainda não** |
| D6 | **Ainda não.** Guardado para pensar **depois de outubro** (campanha "Troque de robô" e Google Ads) |
| 1.12 | **Feito** (perfis sociais) → movido para a Parte 6 |

## Como está dividido

| Parte | O que é | Quem faz |
|---|---|---|
| **1 · Suas ações** | Só você consegue (conta externa, decisão, conversa com cliente, vídeo, OK) | Flávia |
| **2 · Ações de código** | Já decididas; é só pedir ("faz o item C3") | Claude (PR → `develop`) |
| **3 · Backlog de funcionalidades** | Coisas novas, ainda sem decisão de fazer. Nada aqui começa sem você dizer | decisão sua, depois código |
| **4 · Calendário** | As datas fixas juntas | — |
| **5 · Não fazer** | Já derrubado por dado | — |

Regras que valem para tudo: nada de anúncio pago antes da renovação de outubro;
sem CNPJ não há Reclame Aqui nem razão social; depoimento só de cliente real
com permissão; nunca prometer "não bane"; preço de concorrente só com ficha
datada; qualquer coisa que aumente RAM exige aviso e OK antes.

## O que decide a ordem (a "prioridade" em uma frase)

1. **Quem já viu funcionar e sumiu** (63 pessoas) é o maior vazamento medido:
   ativou → abriu pagamento é só 26%. Ação 1.1 e código C1.
2. **Renovação da turma de setembro** (26 clientes, 1ª quinzena de outubro) é o
   dado que destrava anúncio pago (D6, guardado). Só observar; 1.13 e 1.14.
3. **Indexação das páginas alteradas** é o que faz Google/IAs pararem de ler o
   texto velho. Barato (15 min/dia). 1.3.
4. O resto é construção de autoridade externa (vídeos, guest, criadores), que
   demora 30–60 dias para aparecer.

---

# PARTE 1 — Suas ações (Flávia)

Legenda: 🔴 esta semana · 🟠 até 15/10 · 🟡 até 27/10 · 🔁 recorrente.
Tempo é estimativa.

## 1.1 🔴 Conversar com os 63 que ativaram e sumiram — 20 min/dia

| | |
|---|---|
| **Por quê** | Maior perda absoluta da máquina. E-mail já provou que não funciona (zero respostas) |
| **Como** | SQL e mensagem-modelo em `DIAGNOSTICO_MAQUINA_DE_VENDAS_2026-09-27.md`, item 2. WhatsApp, 5 a 10 por dia. Uma pergunta só: "o que faltou?" |
| **Registrar** | 4 caixas: preço · função · medo de bloqueio · tempo/outro |
| **Meta** | ≥ 15 respostas, ≥ 5 voltam a pagar (14 dias) |

## 1.2 🔴 Depoimentos reais — 1 h

**Passo 1 (VPS, só leitura):** lista as pagantes atuais que mais usam e
renovaram, sem reembolso (saída de até 15 linhas):

```bash
cd ~/wabot && node scripts/diag-clientes-depoimento.mjs --top=15
```

**Passo 2:** mensagem pronta (com os **5 dias de PRO** de agradecimento) em
`MENSAGENS_PRONTAS_2026-09-28.md`. Chamar 3 a 5 por dia, do topo para baixo.

- Colher 3 a 5, com nome, foto e permissão por escrito. Sem reescrever.
- Frases que prometem resultado ("dobrar minhas comissões") ou "nunca banido"
  ficam de fora, ou a cliente confirma que disse exatamente aquilo.
- Me mandar: texto exato + nome + foto + autorização. Eu publico em
  `/espelha-grupos-e-confiavel`, `/estudos-de-caso`, home e `/precos` (isso
  também fecha o item **B27** do backlog do Pro Afiliados), com o aviso de que
  a cliente recebeu 5 dias de PRO como agradecimento.
- Também confirmar que os 5 textos que já estão no site são de clientes reais.

## 1.3 🔴 Indexação no Search Console — 10 por dia, 15 min/dia

As marcações `⏳` nas seções antigas de `ACOES_FLAVIA` estão desatualizadas.
Conferido em 28/09: o **B29 já está em `main`** (código com "Revisado em" e
`dateModified`). Então as páginas abaixo mudaram **duas vezes** e devem ser
pedidas **uma vez só**, agora. Ordem (Search Console → Inspeção de URL →
conferir em produção → Solicitar indexação):

| Dia | 10 páginas (`https://espelhagrupos.com.br` + caminho) |
|---|---|
| **A** (B29 + R4 + R6) | `/` · `/bot-afiliados-whatsapp` · `/bot-achadinhos-whatsapp` · `/bot-que-busca-ofertas-shopee-whatsapp` · `/shopee-afiliados-whatsapp` · `/mercado-livre-afiliados-whatsapp` · `/amazon-afiliados-whatsapp` · `/espelhar-grupos-whatsapp` · `/automacao-whatsapp-afiliados` · `/alternativas/achadinhos-bot` |
| **B** (R1 — falavam errado do produto) | `/bot-canais-whatsapp` · `/bot-comum-vs-espelha-grupos` · `/como-funciona-espelha-grupos-canais` · `/blog/bot-whatsapp-antiban-existe` · `/blog/shadowban-whatsapp-canais` · `/blog/como-evitar-banimento-whatsapp-afiliados` · `/blog/grupo-ou-canal-whatsapp-achadinhos` · `/blog/chip-dedicado-bot-whatsapp` · `/blog/migrar-grupo-achadinhos-para-canal` · `/diagnostico-antiban-whatsapp` |
| **C** (R7 + GEO + títulos) | `/blog/como-espelhar-mensagens-entre-grupos-whatsapp` (vídeo 1) · `/quem-somos` · `/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp` · `/melhores-bots-para-afiliados-whatsapp` · `/metodologia-uso-responsavel-whatsapp` · `/blog/como-ser-afiliado-shopee-whatsapp` · `/blog/como-divulgar-ofertas-amazon-whatsapp` · `/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` · `/alternativas/shozap` · `/alternativas/gigi-bot` |
| **D** (R3 + R2) | `/alternativas/fluxopromo` · `/seguranca-credenciais-afiliado` · `/conteudos` · `/glossario` · `/estudos-de-caso` · `/benchmarks/operacao-grupos-ofertas-whatsapp` · `/blog/como-escalar-grupos-sem-operacao-manual` · `/blog/checklist-padronizar-divulgacao-whatsapp` · `/blog/conferir-converter-link-afiliado-whatsapp` · `/blog/bot-para-afiliados-whatsapp-grupos-cupons` |
| **F** (PR #1979 — só depois do deploy em `main`) | Novas: `/guia/shopee-afiliados` · `/guia/amazon-afiliados` · `/guia/mercado-livre-afiliados` · `/guia/magalu-afiliados` · `/guia/shein-afiliados` · `/guia/aliexpress-afiliados`. Editadas (ganharam links em "Continue lendo"): `/padronizar-divulgacao-afiliado-whatsapp` · `/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo` |
| **E** (sobra) | `/materiais/checklist-operacao-whatsapp` · `/materiais/checklist-divulgacao-ofertas-grupos-whatsapp` |

- ⚠️ **Dia F depende de `develop → main`.** Conferido em 28/09: a #1979 (guias
  por loja + 2 páginas editadas) e a #1978 (card "Seu robô está funcionando?"
  só com pendência) estão em `develop`, **ainda não em `main`**. Valide em
  `http://178.105.54.0:3006` (`/guia/shopee-afiliados` termina com "Guias de
  outras lojas"), abra a PR `develop → main` e só então peça o Dia F. A #1979
  registrou esse pedido como linha 🔝 nova no `ACOES_FLAVIA`; aqui ele fica
  **depois do Dia A**, porque A/B corrigem texto que já está no Google.
- Já pedidas em 28/09 (não repetir): `/precos`, `/espelha-grupos-e-confiavel`,
  `/alternativas/achadinho-pro`, `/programa-de-afiliados`,
  `/quanto-ganha-afiliado-shopee`, `/blog/como-divulgar-ofertas-mercado-livre-whatsapp`,
  `/espelhar-grupos-de-ofertas-vale-a-pena`, `/politica-de-reembolso`,
  `/alternativas/proafiliados`.
- Antes de pedir cada página, abrir em produção e ver o texto novo. Se ainda
  estiver o velho, não pedir (gasta a cota).
- **Não pedir** as 9 LPs de cidade/nicho (congeladas).
- Depois de cada dia, marcar ✅ na tabela detalhada de `ACOES_FLAVIA` e me
  avisar; eu atualizo este documento.

## 1.4 🔴 Bing Webmaster Tools — 10 min

Inspeção de URL de `/`, `/precos`, `/bot-afiliados-whatsapp`,
`/blog/como-espelhar-mensagens-entre-grupos-whatsapp` (post do vídeo),
`/shopee-afiliados-whatsapp`, `/bot-achadinhos-whatsapp`. Se não estiver
atualizada: "Enviar URL". Decide se o ChatGPT (que busca pelo Bing) lê a versão
atual. Depois dos pedidos de indexação acima, enviar as mesmas URLs no Bing.
Também `/llms.txt` e `/pricing.md`.

## 1.5 🔴 Conferir o Dia 7 (venceu 28/09) — 10 min

Inspeção de URL de `/alternativas/busqy`, `/afilira`, `/divulga-ninja`,
`/afiliado-inteligente`. Precisa dizer "URL está no Google". Se continuar
"Detectada", o problema é link interno/conteúdo repetido, não indexação. Me
avisar o resultado.

## 1.6 🔴 Planejador de Palavras-Chave — 10 min

Volume e concorrência de `automação para afiliados` e `automação para afiliado
shopee`. Me mandar os dois números. Decide se o hub dos 3 modelos disputa o
Google ou fica só como página de resposta para IA.

## 1.7 🟠 Vídeos 2 a 8 — 2 h/semana, um por semana

Título = a pergunta, literal; sempre "Espelha Grupos" na legenda; nunca "anti-ban".
Ordem: (2) Bot para afiliados no WhatsApp: como funciona o Espelha Grupos ·
(3) Espelha Grupos é confiável? (rosto; LinkedIn só tela) · (4) Robô que busca
ofertas da Shopee sozinho · (5) Ferramenta para divulgar ofertas em grupos: 6
opções comparadas em 2026 · (6) Como postar em vários grupos ao mesmo tempo sem
spam · (7) Quanto custa um bot de afiliados? Basic R$39, Pro R$69 · (8) Dá para
usar pelo celular, sem computador? O vídeo 1 **já está no YouTube, TikTok e Instagram** (28/09); repetir o mesmo
caminho nos próximos. Cada vídeo publicado → me avisar para embutir na
página-resposta certa.

## 1.8 🟠 Menções de terceiros (autoridade externa) — semanas 2–8

**Contato e mensagem escritos para cada linha:** `MENSAGENS_PRONTAS_2026-09-28.md`
(seção 1.8). Onde não tenho o e-mail/contato exato (editores, criadores), o
arquivo diz onde procurar; nada foi inventado.

| Ação | Como | Tempo |
|---|---|---|
| **Guest-parágrafo** em `superfrete.com/blog/grupos-vendas-whatsapp` e `remessaonline.com.br/blog/grupo-de-promocoes-no-whatsapp` | E-mail/formulário ao editor com o texto-padrão de 62 palavras | 1 h |
| **Criadores pequenos do YouTube** (7 nomes) | Acesso PRO + programa de afiliadas 30% recorrente + pedir "Espelha Grupos" no título | 2 h, semanas 3–6 |
| **Telegram oficial** (Shopee, Mercado Livre) | Checklist gratuito, só com autorização do admin. Conteúdo, não anúncio | 1 h/semana, semanas 4–8 |
| **Quora pt-BR** | Resposta completa + UMA menção, declarando o vínculo | 30 min/resposta |
| **Medium** (opcional) | Republicar 4–6 posts com canonical | 3 h |

## 1.9 🟠 Dados que só você tem (destravam itens de código)

Cada linha destrava um item da Parte 2. Sem o dado, o item fica parado — nada
será inventado.

| Tema | Situação (28/09) | Destrava |
|---|---|---|
| **CNPJ / razão social** | ✅ **Decidido: não temos.** B02 fica fora; segue sem `legalName`/`taxID`. Sem CNPJ também não há Reclame Aqui | B02 (descartado) |
| **Print do painel de vendas** | ✅ **Feito:** imagem ilustrativa ("exemplo ilustrativo — dados fictícios") colocada na home, em `/precos` e em `/vendas-e-comissao-afiliado-whatsapp` (componente `PainelVendasIlustrativo`). Ao ir para `main`, pedir reindexação dessas 3 URLs | B04 |
| **Contadores de uso** | ✅ **Só "ofertas enviadas nos últimos 30 dias"**, número real, por snapshot diário. Afiliadas ativas, lojas e dias de sessão ficam de fora por serem pequenos | B05 |
| **Pré-pago 3 e 6 meses** | ✅ **3 meses = 4% · 6 meses = 7%. Sem 12 meses (decidido).** Basic R$ 39: 3 m = R$ 112,32, 6 m = R$ 217,62; Pro R$ 69: 3 m = R$ 198,72, 6 m = R$ 385,02 (sobre 30 dias/mês). Falta só o código | B11 |
| **Números agregados de sessão** | ⏳ **Parado.** Flávia não sabe onde é a derrubada de 50 min. Não achei derrubada proposital a cada 50 min no código; a queda de ~50 min em `docs/rca/whatsapp-sessao.md` era um defeito já corrigido, e a única derrubada de propósito que achei é `reception_self_heal`. O histórico de eventos guarda só 14 dias. Sem dado, **nada é publicado**; reabrir só se aparecer a origem da derrubada | B25 |
| **Prints de preço + data** de concorrentes (página de preços inteira) | ⏳ Pendente. Ofertiva já tem ficha (22/09). Faltam: Afilira, GoGoBot, Afiliado Analytics, Afiliados Pro Bot, Whats.Ly, Pai das Ofertas, DisparaPromo, Growify, e Comission (site nunca achado — me mande o link ou print de onde a IA citou) | B26 e fichas |
| **Conta de teste WhatsApp** disponível | ⏳ Pendente | B40 (Status) e validação da conversão pública |

## 1.10 Decisões (28/09) — todas respondidas

| # | Decisão | Resultado | O que acontece agora |
|---|---|---|---|
| D1 | ~~Carência de 48 h~~ → **sinalizar no painel a partir do 5º dia do teste** | Sem carência. Aviso no painel a partir do dia 5 | C1 reescrito. `TRIAL_ANCHOR_ON_CONNECT` (teste contado da 1ª conexão) **não foi decidido**: fica desligado até você dizer |
| D2 | Teto de vagas 80 → 100 | **Sim** | Claude prepara os comandos e a estimativa de RAM (+20 vagas ≈ +7 GB, 22,6 GB livres, swap zero) e entrega antes de 15/10. Reinício do supervisor anunciado, de madrugada, junto com D3 |
| D3 | Reiniciar `bot-supervisor` | Combinado: **Claude entrega o comando quando a correção estiver em `main`** | Reconecta TODAS as sessões — anunciar antes. Destrava P1-4 |
| D4 | Cobrança do Gemini | **Não** | Rodada do Gemini continua manual |
| D5 | Telegram | **Ainda não** | Segue B34 no backlog |
| D6 | "Troque de robô" (EG-14) e Google Ads (EG-32) | **Ainda não.** Guardado para depois de outubro | Ver "Guardado para depois de outubro" na Parte 5 |

## 1.11 🟠 Admin no GitHub — 5 min, ninguém além de você consegue

**Branch protection** em `develop` e `main`: Settings → Branches → Require
status checks → marcar `quality` e `no-undef`. Sem isso, PR com lint vermelho
entra e quebra o staging (aconteceu duas vezes no mesmo dia).

## 1.12 ✅ Perfis sociais — feito (28/09)

Movido para a Parte 6.

## 1.13 🔁 Rodadas e conferências

| Quando | O quê | Como |
|---|---|---|
| **30/09** | Medição curta: export do Search Console (3 meses + série diária `Gráfico.csv`), `diag-origem-cadastros --dias 30`, `diag-paginas-seo --dias 30` | Me mandar as saídas |
| **~11/10** | Rodada manual de IA (10 perguntas do `ROTEIRO_MEDICAO_IA.md`, aba anônima, sem pergunta extra) — só se não esperar a de 27/10 | Opcional |
| **1ª quinzena de outubro** | **Renovação da turma de setembro** (26 clientes) — só observar. É o dado que decide anúncio pago | `diag-ltv-retencao.mjs` |
| **até 15/10** | Executar D2 (teto 100), já aprovado | Claude entrega os comandos |
| **27/10** | **Rodada mensal completa**: Trilhas A, B, C + nova D (B15 inclui "grátis", "Telegram", "comissão", "Pro Afiliados vale a pena"), 18 consultas × 4 IAs, conta neutra, ChatGPT com busca; `node scripts/validar-medicao-ia.mjs` antes de fechar | 2 h |
| **27/10** (junto) | `diag-funil-ativacao --dias 30`, `diag-ltv-retencao`, `diag-motivo-nao-renovou`, `diag-origem-cadastros --dias 30`, `diag-vagas-robos`, `diag-financeiro-periodo.mjs 30d`, SQL de `Subscription` e `referredBy` (lista completa em `DIAGNOSTICO_…` §6) | Me mandar; eu atualizo `SERIE_HISTORICA_SEO.md` (coluna nova) |
| **27/10** | Reavaliar anúncio pago com a renovação em mãos | — |
| **Mensal** | Cloudflare: `node scripts/diag-acesso-robos-ia.mjs` (19 robôs em 200) + coluna "Unsuccessful" do AI Crawl Control para Claude-User/GPTBot | 5 min |
| **Opcional** | Regra na Cloudflare contra robôs de ataque (`.env`, `/server-status`, porta 8080). Não vaza nada hoje | passo a passo em `SESSAO_2026-09-23_PROMPTS_E_DECISOES.md` |

## 1.14 Fora dos 5 relatórios, mas aparece neles

- **Site de matemática (BH)** e Cuponito: itens do implementador de cada site
  (`PROMPT_MATEMATICA_BH_PENDENTES_2026-09-18.md`; decidir o telefone (31) ×
  (32) e ficha do Google + 10 avaliações). Não fazem parte do Espelha Grupos —
  listado só para não se perder.
- **Prompts de segurança e funil comercial** (texto pronto em
  `SESSAO_2026-09-23_PROMPTS_E_DECISOES.md`): rodar em outra sessão "quando der".

---

# PARTE 2 — Ações de código (Claude)

Tudo em PR contra `develop`, validado em staging antes de `main`. Para
começar qualquer uma: "faz o C3". Ordem = impacto ÷ esforço.

## 2.1 Prontas para fazer (sem depender de você)

| # | O quê | Por quê / métrica | Origem |
|---|---|---|---|
| **C1** | ✅ **(a) feito** (tela de decisão no dia 5, `trialDecision.js`, sem carência). **(b) decidido (28/09): painel + e-mail + mensagem no próprio número conectado.** Auditado: **painel** (tela do dia 5 e faixa) e **e-mail** (`trialProof.js`, jornada do teste vencido) **já existem**. **Mensagem no próprio número: NÃO implementada, e não deve ser feita sem a sua janela de reinício.** Não há hoje nenhum caminho de "mandar mensagem para o próprio número": o robô só escuta o WhatsApp da cliente. Fazer exige (1) comando novo no protocolo do supervisor (`src/supervisor/protocol.js`), (2) tratador no `bot-worker` que envia ao próprio JID uma vez por dia e só para quem tem `contactPhoneOptInAt`, com o mesmo texto de prova do e-mail e sem promessa, (3) reiniciar o `bot-supervisor`, que reconecta TODAS as sessões (junta com a janela do D3). Risco: mensagem automática sai da conta da cliente para a própria conversa "Você"; baixo, mas é envio pela conta dela. **Decisão sua:** ligar isso junto com o reinício do D3, ou deixar só painel + e-mail. **Sem carência de 48 h.** `TRIAL_ANCHOR_ON_CONNECT` segue desligado até decisão | ativou → abriu pagamento **26% → 40%** (+16 pagantes/mês); ler em 30 dias | Diagnóstico, ação 1 |
| **C2** | ✅ **Diagnóstico feito (28/09, produção):** a chave do Mercado Pago está ok; 9 recusas por antifraude (`rejected_high_risk`) em 7 dias, 5 contas com checkout repetido e idêntico, 6 checkouts abandonados sem cartão. 3 contas voltaram a pagar na 2ª ou 3ª tentativa; 2 não voltaram (uma com 4 recusas seguidas, outra com 1). Contas identificadas só pelo script na VPS, sem nome no repositório. **Falta código:** não repetir checkout idêntico e mostrar o pagamento avulso (Pix) logo após a recusa. **Diagnóstico da recorrência**: por que 13 assinaturas ficam pendentes e 11 cancelam (`diag-assinatura-recusada.mjs`); depois oferecer cobrança automática no 1º pagamento e no painel de quem paga avulso. *Status: há uma PR de "assinatura" mergeada em 28/09; falta confirmar com dado se a meta foi atingida* | pagantes com assinatura ativa **4 de 35 → ≥ 50%** | Diagnóstico, ação 3 |
| **C3** | ✅ **Já feito** (Trilha D com 8 consultas, B15 com 4 consultas em `src/ops/aiCitation.js`, teste em `test/ai-citation.test.js`; roteiro atualizado). **Trilha D no medidor** (8 consultas de intenção de compra) em `ROTEIRO_MEDICAO_IA.md`, `scripts/medir-citacao-ia.mjs` e no teste que trava as consultas; conferir se as 4 consultas do B15 (grátis, Telegram, comissão, Pro Afiliados vale a pena) entraram na mesma rodada | linha de base em 27/10 | SEO-GEO F1, B15 |
| **C4** | ✅ **Já feito** (`FATOS_ERRADOS_IA.md`). **Registro de "fatos errados ditos pelas IAs"** (Telegram, Basic manual, 4 lojas, 20 origens) com a fonte citada | zerar a lista | SEO-GEO F4 |
| **C5** | ✅ **Já feito (auditado em 28/09, sem mudança de código):** as 12 páginas-resposta já emitem `FAQPage` pelos seus renderizadores — `faqs` nas comerciais (`/bot-afiliados-whatsapp`, `/espelhar-grupos-de-ofertas-vale-a-pena`), `plainAnswers` no hub (`/automacao-whatsapp-afiliados`), `faq` via `buildArticleJsonLd` (`/melhores-bots-para-afiliados-whatsapp`, `/metodologia-uso-responsavel-whatsapp`, `/espelha-grupos-e-confiavel`, blogs) e FAQPage próprio em `/postar-em-varios-grupos…` e `/padronizar-divulgacao…`. Não criei a "fonte única de 10 perguntas": copiaria texto para páginas que já têm FAQ própria e coerente. **FAQ com schema nas 12 páginas-resposta** (hoje só as comerciais). Fonte única de 10 perguntas ("é grátis?", "tem Telegram?", "mostra comissão?", "é confiável?", "bloqueia o número?"); só onde falta | 12/12 páginas | SEO-GEO D3, B14 |
| **C6** | ✅ **Já feito (auditado 28/09):** as 7 páginas da lista já ganharam título novo nos lotes 1 e 2 de 27/09 (PR #1924) e aguardam reindexação (levas R4/R6). **Não mexer de novo** até a medição diária pós-indexação, senão o dado se mistura. Só resta medir (30/09 e 27/10). **Próximas 8 páginas com impressão e pouco clique** (títulos): `/alternativas/achadinhos-bot` (6.508 imp., CTR 1,38%), `/blog/como-divulgar-ofertas-amazon-whatsapp`, `/blog/melhores-horarios-…`, `/blog/como-ser-afiliado-shopee-whatsapp` (pos. 9,4), `/alternativas/shozap`, `/alternativas/gigi-bot`, `/alternativas/fluxopromo`. *Parte foi feita no lote 2 de 27/09 — conferir o que resta antes de mexer.* **Não mexer** em título que está subindo fora dessa lista | +60 cliques/mês; medir pela série DIÁRIA | SEO-GEO D1 |
| **C7** | ✅ **Já feito (auditado 28/09):** Shopee, Mercado Livre **e Amazon** já se linkam nos dois sentidos (post → página de loja como "próximo passo" e página de loja → post). **Tier 1 pela porta que já abre**: post "como ser afiliado Shopee" e `/quanto-ganha-afiliado-shopee` apontam para `/shopee-afiliados-whatsapp` como "próximo passo", e ela linka de volta; mesmo desenho para ML e Amazon. *Parcialmente feito em 27/09 (links "guia completo" em Shopee e ML) — conferir Amazon* | 3 páginas de loja com consulta-cabeça em posição < 20 | SEO-GEO D2 |
| **C8** | ✅ **Conteúdo pronto** em `docs/repo-publico/` (README, GLOSSARIO gerado do `/glossario`, EXEMPLO_MENSAGEM). ⏳ **Falta você:** criar o repositório público `espelhagrupos/docs` no GitHub e copiar esses 3 arquivos (criar repositório em conta externa é ação sua; eu não publico). **Repositório público `espelhagrupos/docs`** (glossário, metodologia, exemplos de mensagem convertida; sem abrir código do produto) | 2 domínios de terceiro citando o nome | Plano 18/09 §4.2 item 11 |
| **C9** | **Ligar B20 de ponta a ponta**: usar os links `/r/:hash` no envio e mostrar oferta/destino no painel (a fundação já mede cliques) | 1º passo do "qual grupo rende" | Pro Afiliados B20 |
| **C10** | **B41 — credencial sem cookie** para Amazon (StoreID) e Mercado Livre (etiqueta/link). Maior fricção do onboarding (3 de 6 lojas pedem extensão Cookie Editor, só computador). **Primeiro medir** o que a conversão perde sem cookie (link curto × link com tag) | onboarding mais curto | Pro Afiliados B41 |
| **C11** | ✅ **Já feito (auditado):** modelos `moda`, `casa`, `tech`, `bebe` e `beleza` já existem além dos 2 genéricos (`mobileTemplateStore.js`, `mobileOfferComposer.js`). **B08 — modelos prontos por nicho** (moda, casa, tech, bebê, beleza) além dos 2 genéricos | 1º envio mais rápido | Pro Afiliados B08 |
| **C12** | ⏳ **Bloqueado por dado:** só entra FAQ/comparativo onde houver ficha datada; faltam os prints de preço (1.9). Nada a fazer sem eles. **B14/B26 lacunas restantes**: FAQ e comparativos só onde falta e existe ficha datada. Seis dos oito comparativos pedidos já existem; PromoBot/OfertasBot **não entram** sem ficha (OfertasBot é o site do PromoBot) | — | Pro Afiliados |

> A ficha do Ofertiva (22/09) ainda não tem página pública `/alternativas/ofertiva`. Não criei item: vai contra "parar de criar `/alternativas/*`". Se quiser, diga.

## 2.1b Da análise do Afilira (28/09) — código e conteúdo

Ele foi aberto em 04/05/2026 (ME em Capão da Canoa/RS), vende 47/97/197, **não
tem trial** e cresce por SEO em massa + GEO + Google Ads. O que ele faz melhor:
palavra exata no H1 e hero "máquina funcionando". O que nós fazemos melhor: 7
dias com tudo liberado, comissão no painel e espelhamento desde o Basic. IDs
`EG-xx` vêm do documento dele.

| # | O quê | Métrica / observação | Origem |
|---|---|---|---|
| **A1** | ⏳ **Bloqueado por dado:** a ficha do Afilira é de 17/09 (transcrita por você) e o item exige **reconferir o preço antes de publicar**. Me mande o print da página de preços do Afilira com a data de hoje e eu faço a tabela. **Tabela "preço por grupo" na `/precos` e na home**: Espelha R$ 69 (até 50 grupos, espelhamento) × Afilira Starter R$ 47 (1 origem + 1 destino), Pro R$ 97 | Só com a ficha datada de `competitors-data.js` (transcrita em 17/09; **reconferir o preço antes de publicar**) | EG-02 |
| **A2** | **H1/title da home com a palavra exata** ("bot para afiliados…"), dor como sub-headline. *Conferir antes o H1 atual: pode ter mudado nos lotes de 27/09* | CTR da home e posição em "bot de afiliados". Não mexer se estiver subindo | EG-03 |
| **A3** | ✅ **Feito (PR do loop, 28/09):** seção "O que o Espelha Grupos não faz" em `/espelha-grupos-e-confiavel` (só WhatsApp, sem garantia de bloqueio, sem promessa de ganho, sem substituir a revisão), só com fatos da ficha técnica. `updatedAt` da página = 28/09. **Pedir reindexação dessa URL depois do `main`.** **Seção "O que o Espelha Grupos não faz"** em `/espelha-grupos-e-confiavel`. *A página já tem números e reembolso desde 27/09; falta só essa seção* | IA deixa de ler "espelhar grupos" como golpe | EG-05 |
| **A4** | **Motivo visível para oferta que ficou de fora** (tela Envios). *A tela já mostra "bloqueados por repetição/regra"; conferir o que falta antes de mexer* | Menos ticket "não enviou" | EG-08 |
| **A5** | **Robots e JSON-LD para IA**: conferir `robots.txt` (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Google-Extended), `SoftwareApplication` com `Offer` por plano, `Speakable`, `Organization` com `foundingDate` | Acesso dos robôs já 19/19 em 200; `taxID`/`legalName` seguem em B02 | EG-11 |
| **A6** | **6 posts "suporte como conteúdo"** das nossas RCAs: "bot conectado mas não envia", "oferta sem foto no WhatsApp", "número banido, o que fazer", "link de afiliado não gera comissão", "como aquecer número", "Shopee suspendeu afiliado". Sem prometer anti-ban; cada página nasce com 3+ links internos | cauda longa; série diária | EG-12 |
| **A7** | **Reformatar `/alternativas/afilira`** (já existe) com tabela preço-por-grupo + CTA de teste. *Não é página nova* | comparativo converte 3% hoje | EG-10 |
| **A8** | **5 páginas por loja com a palavra exata** no title/H1 (353 impressões, 7 cliques). *Junto com C6/C7* | consulta-cabeça em posição < 20 | EG-13 |
| **A9** | ✅ **Feito (PR do loop, 28/09):** `/ferramentas/calculadora-comissao-afiliado-whatsapp` (cliques × conversão × valor médio × comissão − custo; ponto de equilíbrio; sem nenhuma média de mercado, exemplo marcado como exemplo). Entrou em `/ferramentas`, registry e datas. Teste `free-tools-commission-calculator`. **Pedir reindexação depois do `main`.** **Calculadora de comissão/ROI de afiliado** (ferramenta grátis; já existem as de risco e de tempo) | cauda longa + e-mail com consentimento | EG-29 |
| **A10** | **Relatório trimestral com dado próprio** (horário e loja que mais convertem), só com números do nosso banco | fonte citável por IA | EG-27 |
| **A11** | **Monitoramento mensal**: incluir "Afilira", "melhor bot de afiliados para WhatsApp" e "alternativa ao Afilira" na rodada de 27/10 (junto de C3) | placar da rodada | EG-31 |

Já coberto por outro item (não duplicar): EG-01 = **B11** · EG-06 = **1.2** ·
EG-07 = **B03** (feito) · EG-09 = **B07** e PR #1978 (feito) · EG-15 e EG-28 =
**1.8**.

## 2.2 Prontas, esperando um dado ou ação (Parte 1.9)

| Item | Espera por | Estrutura já pronta? |
|---|---|---|
| ~~B02 CNPJ / razão social~~ | **descartado: sem CNPJ** | — |
| ~~B04 print do painel de vendas~~ | **feito** (imagem ilustrativa nas 3 páginas) | — |
| B05 contadores no hero | ✅ **Código pronto (PR do loop, 28/09):** a home mostra "N envios de ofertas nos últimos 30 dias" só se o número real passar de 1.000 e o arquivo tiver menos de 3 dias; senão some. **Falta você na VPS (prod e staging):** rodar `cd ~/wabot && node scripts/gerar-contadores-publicos.mjs` uma vez e agendar no cron `20 4 * * * cd ~/wabot && node scripts/gerar-contadores-publicos.mjs` (sem processo PM2 novo, sem RAM extra). **OK dado**: só "ofertas enviadas 30 d" (real); falta snapshot | não (hero lê arquivo estático validado, sem processo residente) |
| B11 pré-pago 3 e 6 meses | **aprovado: 3 m 4%, 6 m 7%; sem 12 meses** | não (fluxo separado e idempotente; recorrência intocada) |
| B25 "números do mês" | **parado**: sem dado sobre a derrubada de 50 min | não |
| B27 depoimentos | ⏳ **Bloqueado por dado seu:** faltam os textos exatos, nomes, fotos e autorizações por escrito (item 1.2). Componente compartilhado só depois de haver ao menos 3 depoimentos reais. textos, fotos, permissões | componente compartilhado a fazer |
| B26 comparativos / fichas | prints de preço | fichas em `dashboard/lib/competitors-data.js` |

## 2.3 Precisam de validação dedicada antes de liberar (risco de comissão/envio)

| Item | Risco | Condição |
|---|---|---|
| B12 `/ferramentas/testar-link` (conversão pública) | Link sem comissão sem credencial; abuso/gasto de API | Rate limit, lojas permitidas, consentimento de e-mail, sem acesso às credenciais de ninguém |
| B21 comissão Shopee por destino | Atribuição não é causal, cobertura parcial | Mostrar cobertura e "não atribuído"; totais iguais ao relatório Shopee. Depende de C9 |
| B22 mensagens recorrentes (com imagem) | Duplicar após restart, fuso, fila cresce | Idempotente, 1 ocorrência pendente por agenda, **sem processo PM2 novo** |
| B40 Status do WhatsApp como destino | Envio indevido, risco alto | Feature flag desligada, conta de teste, sem fallback para grupos/contatos |
| P1-4 loja não suportada (link some em silêncio) | Mexe em `bot-worker`; reconecta sessões | Depende de D3 (janela do supervisor) |

## 2.4 Esperam dado de outubro

- **Capacidade** (Diagnóstico ação 10): **D2 aprovado (80 → 100 vagas)**.
  Levo antes de 15/10 os comandos, a estimativa de RAM (+20 vagas ≈ +7 GB) e o
  reinício anunciado do supervisor. Alternativa mais leve segue disponível
  (1 número por conta em teste). Meta: vagas livres nunca abaixo de 10; o
  sinal que decide é o **swap**.
- **B39 (camada grátis permanente)** e **B37 (vários números)**: aviso e
  aprovação de memória obrigatórios (0,35 GB por sessão) — ver Parte 3.

## 2.5 Acompanhar (não é trabalho novo)

- Depois de cada rodada de indexação: conferir "Revisado em" e `dateModified`
  nas páginas pedidas.
- `validate:editorial-freshness` avisa páginas > 120 dias sem revisão (17
  editoriais). A data só muda quando o conteúdo for de fato revisado.
- O código de B29 (data visível + JSON-LD) está feito e em `main`; o que falta
  é só a indexação (1.3).

---

# PARTE 3 — Backlog de novas funcionalidades

Nada aqui é pedido em aberto: são ideias com evidência, esperando a sua decisão
de "fazer" (e, quando indicado, o aviso de memória). IDs vêm da análise do Pro
Afiliados (B) ou dos outros relatórios.

## P2 — 30 a 90 dias (retenção, painel, autoridade)

| ID | Funcionalidade | Impacto | Esforço | Observação |
|---|---|---|---|---|
| B31 | **Onboarding por nicho** (template + preset anti-ban + fontes sugeridas no cadastro); medir tempo até o 1º envio | Alto | Médio | Ataca a renovação do Basic (6%) |
| B32 | **Alertas fora do painel** (e-mail/WhatsApp) quando a sessão cai ou a fila para; `receptionHealth` já detecta | Médio | Médio | Retenção |
| B18 | **Barra inferior no celular** (Início · Espelhamento · Criar oferta · Envios · Menu) | Médio | Médio | CTR celular menor (3,52% × 4,85%) |
| B17 | **Tema escuro** no painel | Baixo | Médio | Precisa entrar no design system v2 antes |
| B23 | **Alternar lojas** (rodízio por destino) | Baixo | Médio | Entra no `destinationRouting` |
| B24 | **Anti-link** para grupos onde o número é admin | Médio | Médio | — |
| B30 | **Vídeo "do QR ao primeiro envio em 5 min"** | Médio | Médio | Primeira entrega feita; o resto é a sequência de vídeos (1.7) |

## P3 — 90+ dias (diferenciais e paridade)

| ID | Funcionalidade | Impacto | Esforço | Observação |
|---|---|---|---|---|
| B33 | **Vitrine pública do grupo** (página por cliente com últimas ofertas + botão entrar). SEO programático: ~8.950 buscas/mês por "entrar em grupo de ofertas" | Alto | Alto | Nenhum dos dois concorrentes tem |
| B35 | **Verificação da oferta antes de sair** (preço atual, cupom válido, estoque) — vira promessa "não posta oferta morta" | Alto | Alto | Ninguém tem |
| B34 | **Telegram** como destino e origem | Alto | Alto | 10 de 14 concorrentes têm; demanda de busca baixa (50/mês contra ~8.950); objeção de venda alta. Decisão D5 |
| B39 | **Camada grátis permanente limitada** (ex.: 1 destino, 10 ofertas/dia, sem anúncio) | Alto | Alto | **MEMÓRIA — SUPER SINALIZAR** antes; decidir só com o dado de outubro |
| B36 | **Mais lojas** (TikTok Shop, Awin, Natura): começar por Awin | Médio | Alto | Não prometer em texto público antes de existir |
| B37 | **Vários números na mesma conta** (cobrança por conexão) | Médio | Alto | **MEMÓRIA — SUPER SINALIZAR** (~0,35 GB por sessão) |
| B38 | **Copiar Tudo** (mídia, enquete, figurinha) por fonte | Baixo | Alto | — |

## Do Afilira (28/09) — entram no backlog, sem decisão ainda

| ID | Funcionalidade | Prazo | Impacto | Esforço | Observação |
|---|---|---|---|---|---|
| EG-17 | **Página `/status` pública** (uptime de conexão, conversão e envio) | P2 | Médio | Médio | Responde "o robô caiu?" sem ticket |
| EG-19 | **Ofertas automáticas para ML/Amazon** + feed para quem não tem grupo de origem | P2 | Alto | Alto | Responde o "feed da comunidade" dele. Avisar carga/RAM antes |
| EG-20 | **Filtros por destino** (loja e categoria por grupo) + ordem das lojas | P2 | Médio | Médio | Paridade com o Pro dele |
| EG-04 | **Hero da home com painel "ao vivo"** (demo marcada como ilustrativa) | P2 | Médio | Médio | Padrão novo: **entra antes no design system v2** |
| EG-22 | Postar no **Status** do WhatsApp | P2 | Médio | Médio | = B40 (flag desligada, conta de teste) |
| EG-18 | **ROI multi-loja** (Shopee + ML + Amazon por grupo e oferta) | P3 | Alto | Alto | Começa em C9/B21 |
| EG-24 | **Boas-vindas no privado** + link de convite rastreado | P3 | Médio | Médio | Crescer o grupo |
| EG-25 | **Vitrine pública do grupo** | P3 | Médio | Alto | = B33 |
| EG-26 | **Aquecimento guiado de número** (sem garantia de anti-ban) | P3 | Alto | Alto | "Garantia anti-ban 7 dias" **fica de fora** (regra: nunca prometer) |
| EG-30 | **Checagem de texto proibido da Shopee** antes de enviar | P3 | Médio | Médio | Dor real: suspensão de afiliado |
| EG-21 / EG-23 | Telegram / vários números | P3 | Médio | Alto | = B34 / B37; **MEMÓRIA — SUPER SINALIZAR** |

## Ideias do "espaço em branco" (nenhum concorrente atende) — sem prioridade ainda

1. **Qual grupo/oferta me deu dinheiro** (venda × origem × destino × oferta, também ML/Amazon) — começa em C9 e B21.
2. **Não repetir o que o grupo já viu** em 7/30 dias + "verificação antes de postar" (B35).
3. **Página de "Proteção do número: os números do mês"** (B25, depende de dado seu).
4. **Crescer o grupo, não só abastecê-lo** (contador de entradas/saídas, vitrine B33).
5. **Pré-pago com desconto de 3 e 6 meses** (B11: 4% e 7%; sem 12 meses). Falta só o código.
6. **Programa de indicação dentro do produto** — o link já aparece na 1ª oferta publicada (feito em 27/09); falta ver se gera cadastro (meta: ≥ 5 com `referredBy` em 30 dias, hoje 0).

---

# PARTE 4 — Calendário

| Data | O quê | Quem |
|---|---|---|
| **28/09** (hoje) | Indexação Dia A (10 páginas) · Bing · conferir Dia 7 · validar staging e abrir `develop → main` (libera o Dia F e o card do painel) | Flávia |
| **29/09** | Indexação Dia B · Planejador de Palavras-Chave | Flávia |
| **30/09** | Medição curta (Search Console + 2 diagnósticos) · indexação Dia C | Flávia |
| **1–2/10** | Indexação Dias D, E e F (F só depois do `main`) · WhatsApp para os 63 (contínuo, 5–10/dia) · depoimentos (1.2, comando + mensagem prontos) | Flávia |
| **Semana de 5/10** | Guest-parágrafo (1.8) · vídeo 2 | Flávia |
| **1ª quinzena de outubro** | Renovação da turma de setembro (só observar) | — |
| **até 15/10** | Claude entrega comandos do teto 100 (D2, aprovado) · janela do supervisor (D3) assim que a correção estiver em `main` | Claude + Flávia |
| **~11/10** | Rodada de IA opcional | Flávia |
| **27/10** | Rodada mensal completa + reavaliar anúncio pago | Flávia + Claude |
| **Mensal** | Cloudflare (robôs de IA) | Flávia |
| **Semanal, até semana 8** | 1 vídeo | Flávia |

Metas de referência (do diagnóstico de 27/09): cadastros/mês 214 → 240 (27/10)
→ 300 (27/12); ativou → abriu pagamento 26% → 40%; cadastro → pagante 11% →
15%; renovação da coorte de setembro ≥ 70% (≥ 18 de 26); citação por IA
(Trilha A) 6/20 → 10/20 → 14/20; menções de terceiros 0 → 2 → 8. A meta de 90
dias (~100 clientes) **não cabe no teto atual de 80 vagas**, por isso D2 (80 → 100, aprovado)
precisa estar pronto até 15/10.

---

# PARTE 5 — Não fazer (derrubado por dado ou por regra)

- **Anúncio pago** antes da renovação de outubro.
- **Cobrança do Gemini** (D4: não).
- **Carência de 48 h** no vencimento do teste (D1: não; o aviso é no painel a partir do dia 5).
- **CNPJ/razão social no site** (não existe; B02 descartado).
- **Pesquisa por e-mail** (zero respostas). Conversa vai para o WhatsApp.
- **Mais páginas `/alternativas/*`** sem bloco de conversão (já são 23; convertem 3% contra 12–14% das comerciais).
- **Páginas por cidade/nicho**, "robô" como termo, "espelhamento de grupos" como porta de entrada no Google.
- **Listicle do ofertasbot.com**: é do PromoBot (concorrente). Inclusão descartada em 19/09. Isso também vale para o B10 do Pro Afiliados: **não pedir inclusão**.
- **Reclame Aqui / razão social / G2** sem CNPJ e sem clientes dispostas a avaliar.
- **Diretórios em massa ou pagos** (BetaList, There's An AI For That); Product Hunt/AlternativeTo/SaaSHub agora.
- **Avaliação fabricada, depoimento reescrito, thread promocional.**
- **Prometer anti-ban ou Telegram**; citar preço de concorrente sem ficha datada.
- **Mexer em checkout, Pix, cartão** (24 de 29 pagam).
- **Mais `llms.txt`/schema** como alavanca; medir "BOTinho".
- **Prometer Awin/Rakuten/Lomadee** em texto público antes de existir no código.
- **Rodar de novo o Planejador/Trends completo** antes de outubro.

---

## Guardado para depois de outubro (decidir só após a renovação e o dado de 27/10)

- **D6:** campanha "Troque de robô" (1º mês R$ 39 no PRO para quem vem de outro
  bot — EG-14) e **Google Ads** na marca / "bot de afiliados" (EG-32). Não
  preparar landing nem código antes.
- **D5:** Telegram como destino/origem (B34).

---

# PARTE 6 — Já feito (curto, para ninguém refazer)

- **28/09:** vídeo 1 também no TikTok e no Instagram; perfis sociais (item 1.12) concluídos.
- **27–28/09:** as 7 PRs (tela do dia 5, assinatura, ficha técnica, títulos, indicação, "é confiável" com números, dados da pagadora) validadas em staging e em `main`.
- Páginas: "espelhar grupos vale a pena?", comparativo AchadinhosBot refeito, `/politica-de-reembolso`, hub dos 3 modelos, FAQ+tabela em `/bot-afiliados-whatsapp`, títulos (2 lotes), topo da metodologia, ficha técnica, definição da marca. SEO-GEO A2, A3 e B1–B8 no ar.
- **Pro Afiliados:** B01, B03, B06, B07, B09, B13, B19, B42 implementados; B16 e B28 já existiam; B29 no ar; B30 com o vídeo 1 no blog e no painel.
- Indexação 28/09 (10 páginas + `/alternativas/proafiliados`); dias 1–9 concluídos.
- Rodada manual de IA de 27/09 (19 de 36; marca "o que é" de 0/4 para 3/4); retenção corrigida (7 de 7 de agosto renovaram).
- Validadores de SEO, frescor e CSV de medição no gate.

---

# Conflitos entre os relatórios (resolvidos aqui)

| Assunto | O que os documentos diziam | Decisão deste documento |
|---|---|---|
| Status das levas de indexação | Seções antigas de `ACOES_FLAVIA` ainda mostram `⏳`, embora várias páginas tenham sido pedidas em 28/09 | Vale a lista da 1.3, calculada removendo o que foi pedido em 28/09 |
| Afilira: números do funil | A análise usa "516 visitas → 119 cadastros → 12 pagantes" (dado de 11/09) | Vale o de 27/09: 214 cadastros → 24 pagantes em 30 dias (11%) |
| Afilira: "nenhum depoimento hoje" | Diz que foram removidos por falta de lastro | O site tem 5 textos ainda por confirmar (1.2); publicar só os confirmados |
| EG-16 Reclame Aqui | Mandava reivindicar o perfil | Bloqueado: sem CNPJ |
| EG-32 Google Ads / EG-14 "Troque de robô" | Marcados P2 | Fora da fila: **D6 = ainda não**, guardado para depois de outubro |
| EG-26 "garantia anti-ban 7 dias" | Proposta como diferencial | Descartada: nunca prometer anti-ban. Só o aquecimento guiado entra no backlog |
| EG-02 preço do Afilira na página | Tabela pública "preço por grupo" | Só com ficha datada e reconferida |
| Reindexação B29 | "quando B29 chegar em `main`" | Conferido em 28/09: **já está em `main`**. Pedir agora, junto com as levas que se sobrepõem |
| E-mail "o que faltou" | `RESUMO_E_PLANO_2026-09-23` mandava disparar e-mail | Cancelado. WhatsApp (1.1) |
| Retenção "6–17%" | Aparecia como gargalo | Corrigido em 27/09: 7 de 7 renovaram; só a renovação de outubro decide |
| Carência de 48 h (C1) | Diagnóstico propunha 48 h com tela de pagamento | Decisão D1: **sem carência**; aviso no painel do 5º dia em diante |
| B02 CNPJ | Esperava dado oficial | Sem CNPJ: descartado |
| B10 (Reclame Aqui + ofertasbot) | Backlog Pro Afiliados mandava fazer | Descartado: sem CNPJ; ofertasbot é do PromoBot |
| B28 | Backlog mandava criar `/programa-de-afiliados` | Já existe em `/parceiro-influenciador` e `/painel/afiliados`; `/programa-de-afiliados` é comparativo dos programas das lojas |
| Vídeos | "Vídeo 1 é B30" e "vídeos 2–8 são C1" | Mesma trilha; 1 publicado, 2–8 em 1.7 |
| Rodada de IA | "próxima ~11/10" e "27/10" | 27/10 é a oficial (mensal); 11/10 é opcional |

> Se algum item aqui já estiver feito e eu não vi, me avise que eu marco. Ao
> concluir qualquer item, atualize **este** arquivo (e só ele); os cinco
> relatórios de origem não precisam mais de atualização diária.
