# Análise profunda do concorrente Pro Afiliados (proafiliados.com) — 27/09/2026

## O que ainda falta (mapa atualizado em 28/09/2026)

Fonte do status: `PLANO_EXECUCAO_BACKLOG_PROAFILIADOS_2026-09-28.md`.

### Pendências imediatas ou bloqueadas

- [ ] **B02, B04, B05, B10, B11, B25 e B27:** obter, respectivamente, dados oficiais de CNPJ/razão social, print sanitizado, snapshot de uso, acesso aos serviços externos, tabela aprovada de descontos, agregados mensais e depoimentos autorizados. Nada deve ser inventado.
- [ ] **B15:** executar a medição externa nas quatro IAs; roteiro e medidor já estão instrumentados.
- [ ] **B14 e B26:** completar FAQ/comparativos somente onde ainda há lacuna e existe ficha datada; seis dos oito comparativos já existiam.
- [ ] **B12, B21, B22 e B40:** fazer validação funcional dedicada antes de liberar; conversão pública, atribuição, recorrência e Status podem afetar comissão ou envio.
- [ ] **B20:** a fundação de cliques já existe, mas ainda falta usar os links no envio e mostrar oferta/destino no painel.
- [ ] **B08, B17, B18, B23, B24, B31–B39 e B41:** continuam no backlog sem execução comprovada. B37 e B39 exigem aviso e aprovação de memória antes de qualquer implementação.
- [ ] Pedir a reindexação B29 quando a versão com “Revisado em” estiver em produção e medir o efeito do vídeo B30.

### Já executado ou confirmado

- [x] **B01, B03, B06, B07, B09, B13, B19 e B42** foram implementados.
- [x] **B16** já existia: pareamento por código de 8 dígitos.
- [x] **B28** já existia em `/parceiro-influenciador` e `/painel/afiliados`; não foi movido para a URL editorial `/programa-de-afiliados`.
- [x] **B29** foi implementado no código; resta a reindexação externa.
- [x] **B30** teve a primeira entrega: vídeo publicado e incorporado ao blog e à tela de Espelhamento.

> O backlog original abaixo registra a análise de 27/09. Em conflito de status, prevalece este mapa e o plano de execução de 28/09.

**Método.** Site público inteiro lido em 27/09/2026 (48 URLs do sitemap, JSON-LD,
robots, llms.txt), área logada percorrida com conta de teste (todas as 10 telas
do menu, modal de planos, tema claro/escuro, versão celular) e mapa das 36 rotas
de API que o painel dele chama. Nosso lado: código do repo (`dashboard/`,
`src/billing/plans.js`), site em produção e as medições já registradas em
`docs/marketing/SERIE_HISTORICA_SEO.md` e `RESUMO_E_PLANO_2026-09-23.md`.
Tudo que é fato dele tem data; o que é hipótese está marcado como hipótese.

⚠️ **A nossa ficha pública dele está desatualizada.** `/alternativas/proafiliados`
e `competitors-data.js` (verificados em 31/07 e 04/08) dizem "grátis para sempre,
24/7, 5 plataformas, tag proafiliados". Em 27/09 o modelo é outro (abaixo).
Corrigir é o item 1 do backlog: página de comparação com fato errado é a
primeira coisa que a IA e a cliente checam.

---

## 0. Resumo executivo (o que decide)

| | Pro Afiliados | Espelha Grupos |
|---|---|---|
| Promessa (H1) | "Seu grupo de ofertas no piloto automático" | "Chega de copiar e colar oferta uma por uma" |
| Porta de entrada | **Grátis para sempre** (2 h/dia, linha de crédito na mensagem, 1 anúncio a cada 30 envios) | Teste de 7 dias |
| Pago | Premium R$ 50 (24 h, sem linha, com anúncio) · Premium Plus R$ 100 (sem anúncio) · Pix 1–12 meses, −10/−20/−30 % | Basic R$ 39 · Pro R$ 69 · Mercado Pago (Pix/cartão), recorrência opcional |
| Canais | WhatsApp **+ Telegram** (cruzado), Status, Canais, Comunidades, vários números | WhatsApp (grupos, canais, comunidades); Stories em andamento |
| Lojas | **12** (9 diretas + Awin, Lomadee, Rakuten) | 6 |
| Origem de ofertas | Copiar dos grupos + **Encontrar ofertas** (radar sobre TODAS as contas conectadas dos usuários dele) + **Ofertas da comunidade** (fontes de outros usuários, 22 nichos) | Espelhamento + garimpo automático Shopee (Pro) |
| Prova social | 4 contadores "reais, atualizados a cada hora" (+3.700 afiliados, +209 mil msgs/24 h, +20 mi links/30 d, +1.100 grupos/24 h) | "0,8 s", "24/7", "6 lojas" (nenhum número de uso) |
| Confiança | CNPJ + razão social no rodapé e no JSON-LD; sem reembolso; sem depoimento | Reembolso 7 dias, suporte humano no WhatsApp, LGPD; **sem CNPJ**, sem depoimento |
| Relatórios | Histórico **só das últimas 24 h**; sem vendas/comissão; sem cliques | Histórico completo + **painel de vendas e comissão Shopee** |
| Proteção do número | Espera global, horário do robô, variação de tempo, alternar lojas. Na conta de teste o padrão estava **"Enviar sem nenhuma espera (perigoso)" LIGADO** | Anti-banimento por destino (presets, teto hora/dia, descanso, variação de texto), dedup |
| SEO | 48 URLs: 7 LPs transacionais, 11 páginas "alternativa a X", 9 guias por loja, 8 posts, comparativo, ranking próprio; toda página "atualizada em 27/09" | ~130 rotas indexáveis, comparativos (47 % das impressões), Tier 1 por loja, llms.txt, pricing.md |
| GEO | JSON-LD com `legalName`/`taxID`, `AggregateOffer`, FAQPage; robots libera 7 bots de IA nominalmente; llms.txt | JSON-LD (Organization, SoftwareApplication, FAQ), llms.txt, pricing.md, `/api/public/plans`; ChatGPT já é 26 % dos cadastros |

**Por que ele "sempre aparece":** (1) grátis permanente sem cartão, sem telefone,
sem nome = cadastro em 20 segundos; (2) rede de satélites com o mesmo dono
(gruposdowpp.com.br, criarfigurinha.com, nexoafiliados.com, proafiliados.com.br)
apontando para ele; (3) 11 páginas "alternativa ao X" + ranking próprio em que
ele é o nº 1 + 9 guias por loja, tudo com data de hoje; (4) Telegram e 12 lojas
respondem "sim" a mais perguntas que nós.

**Onde ele é frágil e nós já somos fortes:** medição (vendas, comissão,
histórico), proteção do número por destino, marca d'água/card, cupom, reembolso,
suporte humano. Nada disso está dito no nosso site com número ou imagem, e é o
que a Perplexity e o ChatGPT usam para nos descartar (ver
`roadmap-2026-09-critica-e-revisao.md` § 1).

---

## 1. Vantagem do concorrente — o que ele tem e nós não temos

### 1.1 Produto (verificado na área logada)

| Recurso dele | Como funciona | Temos? |
|---|---|---|
| **Telegram** (MTProto, sessão de usuário; grupos, supergrupos, canais; WA↔TG cruzado) | Aba "Telegram" na mesma tela de conexão; número + código + senha 2FA | Não |
| **Encontrar ofertas (radar)** | Toda oferta com link compatível capturada por QUALQUER conta conectada de QUALQUER usuário vira um feed; a cliente filtra por palavra livre ("perfume"), escolhe destinos e espera por palavra; produto repetido some por 7 dias | Só Shopee, só Pro, via busca própria (não depende de outros usuários) |
| **Ofertas da comunidade** | Lista as fontes (grupos/canais WA e TG) que outros usuários monitoram, em 22 nichos; ela escolhe quais seguir. Na conta de teste apareciam **centenas** de fontes, incluindo lixo ("despedida de hadacita", "Netflix Brasil", "Trabalho de Práticas") | Não |
| **12 lojas** (+TikTok Shop, Terabyte, Pró Spin, Awin, Lomadee, Rakuten) | Cadastro por link colado: ele extrai o ID sozinho | 6 lojas |
| **Deep link em domínio próprio** (sshopee.me, melila.me, amzzn.me, magazineluiza.me, awin1.me) | Tenta abrir o app da loja; cai no web | Temos `/r/:hash` só como rastreador interno (não é deep link) |
| **Vários números na mesma conta** | "+ Conexão"; cada conexão extra = assinatura própria | 1 sessão por conta |
| **Copiar Tudo** (texto, foto, vídeo, áudio, enquete, figurinha, localização, contato) | Por fonte | Não (só oferta com link) |
| **Mensagens agendadas** por intervalo, horário diário ou dias da semana, com imagem | Tela própria | Agendamento de oferta sim; recorrência não |
| **Enviar aviso** (texto/foto para N grupos) | Aba da tela Enviar | Parcial (Enviar agora) |
| **Status do WhatsApp** como destino | Checkbox em Ajustes | Não |
| **Anti-link + boas-vindas com menção** (bot admin) | Por grupo | Boas-vindas sim; anti-link não |
| **Alternar lojas** (rodízio de loja por grupo) | Global ou por função | Não |
| **Link do grupo no fim da mensagem** ("para mais gente entrar") | Checkbox | Temos `{{grupoLink}}` no template (não é um toggle) |
| **"Encaminhada de canal seu"** (mostra a oferta como encaminhada do canal dela para ganhar seguidores) | Automático | Temos botão "Ver canal" (Pro) |
| **Pareamento por código de 8 dígitos** (sem câmera) | Alternativa ao QR | Não (só QR) |
| **Tema claro/escuro** | Toggle no topo | Só claro |
| **Diagnóstico "Seu robô está funcionando?"** com "Faltam 2 passos", barra "Passo 2 de 3 · Leva uns 5 minutos" e botão que resolve | Card fixo no topo de TODAS as telas | Checklist de ativação só na home |
| **"Como usar esta tela"** (2 linhas + "← Início" + "Próximo: …") em toda tela | Banner fixo | Não |
| **Indique e ganhe** 15 dias de Premium + código personalizado (até 5) | Em Ajustes | Temos programa com comissão em PIX (mais forte, e escondido) |
| **Promoção Instagram** (seguir + comentar + repostar = 15 dias grátis) | No painel e no FAQ | Não |
| **Contador de membros** ("0 entraram · 0 saíram · saldo") | Card na home | Não |
| **Modelos prontos** (5 templates com `{NOME_DO_PRODUTO}`, `{PRECO_ANTIGO}`, `{PRECO_NOVO}`, `{DESCONTO}`, `{CUPOM}`, `{LINK}`) | Já vêm criados; ela só escolhe | Temos 30+ variáveis, mas a cliente começa do zero |

### 1.2 Precificação e embalagem da oferta

- **"Todas as funções em todos os planos, inclusive no grátis."** É a frase que
  abre a página de preços, o guia, o FAQ e o comparativo. Ele não vende
  recurso; vende **tempo (2 h → 24 h) e limpeza (com/sem anúncio)**. Isso
  elimina a objeção "será que o plano barato tem o que eu preciso?", que a
  nossa divisão Basic/PRO cria de propósito.
- Grátis **sem cartão, sem telefone, sem nome**: o formulário de cadastro tem
  só e-mail, senha e código de indicação. O nosso exige celular (trava contra
  teste repetido). Ele aceita o abuso em troca de volume.
- **Pix pré-pago de 1 a 12 meses com desconto progressivo** e "não há cobrança
  automática; se não renovar, volta ao grátis". Vende paz: ninguém fica preso.
  Efeito colateral: o cliente que não renova não some, continua no grátis
  espalhando a marca dele nos grupos.
- **O anúncio é o modelo de negócio**: no grátis, cada mensagem termina com
  "esta oferta foi buscada automaticamente pela ferramenta proafiliados.com" e
  sai 1 post com imagem a cada 30 envios por grupo. Cada cliente grátis é
  outdoor dele dentro de grupos de afiliados (o público exato). O modal de
  planos mostra "exemplos reais dos anúncios enviados" — transparência que
  desarma a reclamação.
- Conexão extra = assinatura própria: monetiza agência sem plano "agência".

### 1.3 Provas sociais e gatilhos de conversão

- 4 contadores no hero declarados "números reais da plataforma, arredondados
  para baixo e atualizados a cada hora". Não dá para auditar, mas o efeito é
  de escala. Nós não mostramos nenhum número de uso.
- Mock de conversa no hero mostrando a mensagem **antes** (com convite e @ de
  outro afiliado riscados) e **depois** (link dela, foto, preço). Explica o
  produto em 3 segundos.
- Ranking editorial próprio ("Melhores bots de ofertas 2026") com ele em 1º e
  "transparência: é o nosso produto". Aparece na SERP e é citado por IA.
- CNPJ e razão social no rodapé de toda página e no `Organization` do JSON-LD
  (a objeção "é confiável?" que a IA fez a nós em 23/09, ele responde).

### 1.4 Ecossistema de conteúdo e presença digital

- **Arquitetura do site (48 URLs):** 7 LPs transacionais (`/bot-de-ofertas-whatsapp`,
  `/bot-shopee-afiliados`, `/bot-mercado-livre-afiliados`, `/bot-telegram-afiliados`,
  `/converter-link-afiliado`, `/automacao-afiliados-whatsapp`,
  **`/espelhar-grupos-whatsapp`** — ele disputa a NOSSA expressão de marca),
  11 páginas `/alternativa/<concorrente>` (não temos página sobre 8 delas:
  Afilira, Divulgador Inteligente, Divulga Ninja, Gigi Prime Bot, Busqy,
  PromoBot, DivulgaLinks, OfertasBot), 9 guias `/guia/<loja>-afiliados`
  (cadastro no programa + onde achar o ID), 8 posts, `/comparativo`,
  `/lojas` + 3 páginas de rede (Awin, Lomadee, Rakuten).
- **Frescor artificial:** todas as páginas exibem "Atualizado em 27 de setembro
  de 2026" e `lastmod` do sitemap = hoje. Hipótese: carimbo automático diário.
  Funciona como sinal de frescor para Google e IA.
- **Satélites do mesmo dono:** gruposdowpp.com.br (diretório de grupos de
  WhatsApp, "maior do Brasil", com categoria Afiliados e link "Parceiro" no
  login/cadastro dele), criarfigurinha.com, nexoafiliados.com e
  proafiliados.com.br (mesmo CNPJ, já registrado no nosso
  `PLANO_MAQUINA_DE_VENDAS_IA`). É link building próprio e captura de tráfego
  de quem procura grupo para divulgar — o cliente dele nasce ali.
- **Redes:** Instagram @proafiliadosbot (único canal de suporte declarado:
  "Esqueceu a senha? Fale com o suporte"), YouTube @proafiliadosbot, Twitter
  @proafiliadosbot. Meta Pixel + verificação de domínio Facebook = roda
  anúncio pago na Meta.
- **Terceiros:** no ranking de 14 bots do ofertasbot.com ele aparece
  ("freemium; contra: tag/anúncio do dono"). Nós **não aparecemos**. Reclame
  Aqui: nenhum dos dois tem perfil reivindicado; só a página automática
  "detector de site confiável" dele. Não encontrei reclamação pública dele
  (busca em 27/09) — nem elogio.

---

## 2. Usabilidade, UI/UX e painéis internos

### 2.1 Jornada e onboarding

**Pro Afiliados.** O painel é uma única página (`/dashboard#seção`) que carrega
tudo de uma vez (a lista de fontes da comunidade sozinha tem 165 KB de HTML).
O menu segue a jornada: *Comece por aqui (1. Minhas lojas → 2. Conectar
WhatsApp → 3. Meus grupos) → Enviar → Acompanhar → Robô no automático →
Conta*. Em **toda** tela ficam fixos: (a) o card "Seu robô está funcionando?
Ainda não. Falta pouco! Faltam 2 passos" com barra de progresso, tempo
estimado e o botão da próxima ação; (b) o banner "Como usar esta tela" com duas
frases e os botões "← Início" / "Próximo: …". A cliente nunca se perde e nunca
precisa decidir o que fazer. Vocabulário: "Copiar daqui / Postar aqui",
"Enviar sem nenhuma espera (perigoso)", "Deixe 1 se não souber". Zero jargão.

Fricções observadas nele: não há redefinição de senha self-service (manda falar
com suporte no Instagram); o histórico só guarda 24 h; a tela Encontrar ofertas
pede "Salvar" depois de ligar o toggle e avisa "Ainda não salvo" no horário —
estado pendente em dois lugares; a espera entre mensagens vinha desligada na
conta de teste ("perigoso" ligado), ou seja, o padrão seguro depende da cliente;
a lista da comunidade expõe nomes de grupos de outros usuários (ruído e
privacidade).

**Espelha Grupos.** Menu por categoria (Início → Criar & enviar → Acompanhar →
Configuração → Conta), checklist de ativação só na home, tutorial em tela
própria, cadeados PRO nos itens. É mais rico (18 itens contra 10) e por isso
mais pesado para quem chega: "Minhas credenciais", "Testar conversão",
"Templates", "Cupons", "Anti-banimento", "Filas" são substantivos de sistema,
não passos. O que ele resolve com um card fixo, nós resolvemos com uma tela a
mais.

### 2.2 Design visual e percepção de valor

| | Pro Afiliados | Espelha Grupos |
|---|---|---|
| Tema | Escuro por padrão (#09090B), claro opcional | Claro (`--bg #EEF6F2`) |
| Tipografia | Bricolage Grotesque (títulos) + Inter | Figtree |
| Cor | Verde WhatsApp-like + amarelo de alerta + mascote robô | Verde menta + lilás PRO + 💜 |
| Leitura | "SaaS de tecnologia", masculino, denso, gamer | "Feito para afiliada", leve, acolhedor |
| Hierarquia | Cards com borda 1 px, título + 1 frase + toggle; botão primário verde de largura total | Cards KPI, tags de plano, mais texto por tela |
| Celular | Barra inferior fixa (Início · Grupos · **Enviar** em destaque · Fila · Menu) | Menu lateral responsivo |

Ele parece **mais produto** (tema escuro, mascote, contadores, barra inferior);
nós parecemos **mais gente** (tom, cores, texto). Nenhum dos dois é "premium".
A nossa vantagem de percepção está no tom; a dele, na sensação de app.

### 2.3 Painéis e dados

- **Home dele:** diagnóstico + 4 cards (Conexão, Fila, Grupos onde posta,
  Pessoas nos grupos entraram/saíram) + "Últimos envios". Nenhum gráfico,
  nenhum número de dinheiro. **Retenção vem do diagnóstico, não do dado.**
- **Home nossa:** 4 números + "Comissão Shopee hoje" (PRO) + funções mais
  usadas. Vendas e Envios em telas próprias com gráficos. **Temos o dado que
  ele não tem** (vendas, comissão por produto, histórico completo, o que foi
  bloqueado por repetição) e é isso que faz uma afiliada abrir o painel todo
  dia — desde que ela saiba que existe antes de assinar.
- Fila dele: contagem regressiva por item, cancelar 1 ou limpar tudo, "esta
  tela se atualiza sozinha". A nossa Filas é PRO e é configuração, não
  visualização ao vivo do que vai sair.

### 2.4 Comparação tela a tela (27/09/2026 — conta Basic paga no nosso painel × conta grátis no dele)

| Tela | Pro Afiliados | Espelha Grupos | Quem leva e por quê |
|---|---|---|---|
| **Início** | Card fixo "Seu robô está funcionando? Ainda não. Falta pouco!" + barra "Passo 2 de 3 · leva uns 5 minutos" + 4 cards (conexão, fila, grupos, membros entraram/saíram) + últimos envios | "Primeiros passos 0/5 · ≈ 4 min", passos que se marcam sozinhos, atalho "Quer ver funcionando antes de conectar? Cadastre uma loja e teste um link" | **Empate técnico.** O nosso "testar antes de conectar" é melhor ideia; o dele repete o card em TODAS as telas e o nosso só na home |
| **Conexão** | Abas WhatsApp/Telegram; QR ou código de 8 dígitos; botões Pausar robô / Sair; "3 dicas para não bloquear" | "Conectar em 3 passos" ilustrado; QR ou **número de celular** ("Estou no celular — conectar por número"); resumo do ritmo | **Empate.** Os dois têm pareamento por número (o item B16 do backlog está errado: já temos) |
| **Lojas / credenciais** | 12 cards; cola o link de afiliado e ele extrai o ID sozinho; ML por etiqueta, Amazon por StoreID, sem cookie | 6 cards; aviso no topo "Baixe no Chrome o Cookie Editor (Amazon, ML e SHEIN é necessário)"; Magalu e SHEIN "mais rápida · 1 campo"; vídeo tutorial; texto "sem loja aqui o robô não publica" | **Ele.** Cookie por extensão exige computador e é a maior fricção do nosso onboarding. Amazon (StoreID) e ML (etiqueta) sem cookie viram item novo do backlog (B41) |
| **Grupos / espelhamento** | Lista única com dois botões por grupo: "Copiar daqui" / "Postar aqui"; filtro por tipo; marcar todos | "Espelhamento pausado · robô desconectado"; "Adicionar grupo de origem" / "de destino" em telas separadas; aviso "Canais bloqueados no Basic" | **Ele.** Um toque por grupo é mais rápido que dois fluxos. Nosso aviso de canais aparece antes de haver qualquer grupo |
| **Enviar oferta** | Link → modelo (5 prontos) → texto extra → grupos (buscar, marcar todos) → Enviar; aba "Enviar aviso" | "Criar oferta": cola link → Colar/Gerar; checkbox cupons; aviso amarelo "por enquanto o link não é convertido" quando não há credencial; "Enviar agora" em tela separada | **Ele.** Um formulário só, com destino escolhido na hora. Nosso aviso amarelo em conta sem credencial soa como defeito |
| **Fila / envios** | "Fila de envio": lista com contagem regressiva, cancelar 1, limpar tudo, atualiza sozinha | "Envios": abas Histórico / Próximos envios; resumo Hoje/7/30 dias (enviados, bloqueados por repetição, bloqueados pela regra, falhas, taxa de entrega); busca; filtros por status; caixa laranja "Fila de envio travada? Limpar ofertas da fila" | **Nós no dado, ele na leitura.** Temos 30 dias e motivo de bloqueio; ele tem 24 h. Mas a caixa laranja com botão destrutivo aparece mesmo com fila vazia — item novo B42 |
| **Histórico** | Últimas 24 h, 4 contadores (total, enviados, não enviados, esperando) | Ver linha acima (histórico completo) | **Nós.** |
| **Robô no automático** | "Encontrar ofertas": toggle + palavras-chave + onde postar + "mais opções (foto, lojas, espera)"; "Ofertas da comunidade": 22 nichos, centenas de fontes | "Ofertas automáticas" (PRO, com cadeado e prévia) | **Ele no alcance, nós na qualidade.** Ele posta o que outros usuários recebem; nós buscamos na Shopee por tema e desconto |
| **Ajustes** | 4 cards: espera entre mensagens (com "sem espera (perigoso)" ligado por padrão na conta teste), alternar lojas, horário do robô, como a mensagem sai (Status, link do grupo, texto no fim, modelo, "encaminhada de canal seu") + Indique e ganhe | Espalhado em 6 telas: Anti-banimento (PRO), Templates, Cupons, Credenciais, Testar conversão, Conta | **Ele na simplicidade, nós na proteção.** Nosso padrão de ritmo é seguro e por destino; o dele depende da cliente ligar |
| **Templates** | 5 modelos prontos ("MODELO 1…5") com 6 variáveis; "Editar modelos" | 2 modelos prontos ("Automático clássico", "Simples"), 17 variáveis (`{rating}`, `{vendas}`, `{cupom}`, `{{gancho}}`, `{{cta}}`…), "Frases que variam sozinhas" (PRO) | **Nós.** Mais poder e já vem com modelo. Item B08 vira "modelos por nicho", não "criar modelos" |
| **Vendas** | Não existe | Prévia bloqueada no Basic com números de exemplo e "Como funciona em 3 passos"; no PRO, comissão por dia e produto | **Nós.** A prévia bloqueada é o melhor upsell do painel; falta ela existir também fora do painel (site) |
| **Plano** | Modal "Planos & Tipos de Anúncios" com barra "120 min restantes hoje", 3 colunas e "exemplos reais dos anúncios" | Card escuro da assinatura atual (renovação em 17 dias, último pagamento, "Desligar cobrança automática") + 2 colunas Basic/PRO | **Empate.** O dele é mais honesto sobre o que a cliente ganha ao pagar; o nosso é mais claro sobre a cobrança |
| **Celular** | Barra inferior fixa (Início · Grupos · Enviar · Fila · Menu), tudo com um toque | Menu hambúrguer; card de passos ocupa a tela inteira antes de qualquer ação | **Ele.** Mantém B18 |
| **Tema** | Escuro (padrão) e claro | Claro | Ele em percepção de "app"; nós em legibilidade |

**Leitura geral da área logada.** Ele ganha em *quantidade de decisões por
tela* (uma tela, um toggle, um botão verde) e em *repetição do próximo passo*.
Nós ganhamos em *dado* (30 dias, motivo de bloqueio, vendas), em *proteção
padrão* e em *poder do template*. O que dói mais para quem chega é a nossa
tela de credenciais: cookie por extensão em 3 das 6 lojas, contra "cole o
link" em 12 lojas do lado dele.

**Correções ao backlog a partir desta rodada:** B16 (pareamento por número)
já existe — sai. B19 (fila ao vivo) existe parcialmente como aba "Próximos
envios" — vira "mostrar contagem regressiva e cancelar por item". B08 vira
"modelos por nicho" (já existem 2 genéricos). Entram B41 e B42 abaixo.

---

## 3. Vantagem própria — o que temos e ele não tem

| Diferencial nosso (verificado no código/site) | Ele | Como virar argumento de venda |
|---|---|---|
| **Painel de vendas e comissão da Shopee** (por pedido e por produto, diário) | Nada. Histórico de 24 h, sem venda | "Ele posta. Nós mostramos o que vendeu." Print real do painel na home e na página de preços; é o que o ChatGPT usa para recomendar "bot que mostra comissão" |
| **Histórico completo de envios** + motivo de bloqueio (repetição, loja não cadastrada) | 24 h | "Sabe o que saiu ontem, semana passada e por que não saiu" |
| **Marca d'água com o nome dela na foto** (PRO) | Nenhum concorrente anuncia | Resposta à dor "copiaram meu grupo inteiro" (o ChatGPT recomenda marca d'água sem citar produto) |
| **Card de oferta clicável** | Preview normal | Mostrar lado a lado no celular |
| **Conversão de cupom/voucher**, não só produto | Só produto | Página `/cupons` e argumento na comparação |
| **Anti-banimento por destino** (presets, intervalo, rajada, teto por hora/dia, descanso, variação de texto, descarte de oferta velha) | Espera global + horário; padrão inseguro | "Proteção que já vem ligada" — e provar com número: sessões ativas há X dias |
| **Sem tag, sem anúncio, em nenhum plano, inclusive no teste** | Grátis e Premium carregam anúncio | Já é o eixo da nossa página; manter e quantificar ("1 anúncio dele a cada 30 envios = 3 % das mensagens do seu grupo são propaganda de outro") |
| **Reembolso de 7 dias + cancelamento sem multa + suporte humano no WhatsApp** | Sem reembolso, suporte no Instagram | Bloco "Garantia" na página de preços; item que a IA premia em "é confiável" |
| **Garimpo Shopee por tema + desconto mínimo, sem depender de grupo de origem nem de outros usuários** | Radar depende do que outros usuários recebem (todo mundo posta a mesma oferta) | "Oferta que só o seu grupo viu" vs "a mesma oferta em 1.100 grupos" |
| **Guarda de link** (`mirrorLinkGuard`: se não converteu, não envia) | Ele também tira o link de loja sem cadastro | Paridade; dizer que temos |
| **Testar conversão** (cola o link, vê se sai com o SEU código) | Não tem | Quick win de confiança no onboarding e como ferramenta pública gratuita (`/ferramentas`) |
| **Programa de afiliados com comissão recorrente em PIX** | 15 dias de Premium | Página pública + link no painel; afiliadas são vendedoras profissionais |
| **Cartão + Pix com recorrência opcional** | Só Pix pré-pago | Não converter em argumento; oferecer o pré-pago com desconto como ele |
| **Instagram Stories** (Premium, em andamento) | Não tem | Quando sair: "WhatsApp + Stories no mesmo fluxo" |

---

## 4. Oportunidade de ouro — o que nenhum dos dois atende

Dores levantadas nas páginas dos dois, no ranking de terceiros, nas consultas de
IA já medidas (11/09, 23/09) e no nosso próprio dado de retenção (Basic renova
6 %):

1. **"Qual grupo/oferta me deu dinheiro?" por loja e por origem.** Nós temos
   comissão Shopee; ninguém cruza **venda × grupo de origem × grupo de destino
   × oferta** nem cobre ML/Amazon. Quem mostrar "este grupo-fonte rendeu R$ X
   este mês, aquele rendeu zero" vira ferramenta de decisão, não de disparo.
   Estratégia: começar com cliques por destino (o `/r/:hash` já existe como
   rastreador interno) e comissão Shopee por destino; depois ML/Amazon.
2. **Todo mundo posta a mesma oferta.** O radar dele industrializa isso: a
   oferta capturada em uma conta sai em todas. O membro de 5 grupos vê 5 vezes.
   Ninguém garante exclusividade nem valida a oferta na hora de sair (preço
   ainda vale? estoque acabou? cupom expirou?). Estratégia: "verificação antes
   de postar" (preço atual ≥ anunciado → não posta; cupom inválido → não
   posta) e "não repetir o que este grupo já viu em 7/30 dias" — já temos
   dedup e `queueExpiry`; falta virar promessa pública.
3. **Confiança auditável.** Nenhum dos dois tem depoimento com nome, perfil no
   Reclame Aqui, número de sessões ativas ou histórico de estabilidade. A IA
   perguntada "é confiável?" não tem de onde tirar. Quem publicar CNPJ +
   reembolso + 5 depoimentos + página de status/uptime + Reclame Aqui
   reivindicado fica sozinho nessa resposta.
4. **Medo de banimento com prova.** Os dois dizem "não garantimos". Ninguém
   mostra dado: idade média das sessões, % de números que caíram, o que o
   preset recomendado faz. Estratégia: página "Proteção do número: os números
   do último mês" alimentada por `diag-frota-cega`/`receptionHealth` (agregado,
   sem cliente).
5. **Crescer o grupo, não só abastecê-lo.** Ele conta entradas/saídas; nós nem
   isso. Ninguém entrega página pública do grupo/vitrine/link na bio (Promium e
   DivulgaLinks entregam). Demanda medida: ~8.950 buscas/mês por "entrar em
   grupo de ofertas" contra 50 por "bot telegram afiliados". Estratégia: uma
   página pública por cliente ("vitrine do grupo": nome, nicho, últimas 10
   ofertas, botão entrar) gerada pelo produto — SEO programático que a cliente
   divulga e que traz cadastro para nós.
6. **Quem começa não chega ao primeiro envio.** Ele aposta em "faltam 2
   passos"; nós em checklist + tutorial. Basic renovando 6 % diz que o valor
   não chega. Estratégia: medir tempo até primeira oferta enviada, e-mail
   "o que faltou" (já no plano de 23/09), e pré-configuração por nicho
   (template + fontes sugeridas + preset anti-ban) no cadastro.
7. **Mais de um número / equipe.** Ele cobra uma assinatura por conexão; nós
   não oferecemos. Agência pequena (3–5 números) não tem produto certo em
   nenhum dos dois.

**Posicionamento para capturar isso:** "O único robô que mostra o que vendeu e
protege o seu número — sem propaganda de ninguém no seu grupo." Simples
(3 passos), completo (mede), honesto (sem anúncio, reembolso, CNPJ).

---

## 5. SEO e presença em IAs (GEO)

### 5.1 Google

**Clusters a disputar, na ordem em que ele já ganha:**

| Cluster | Termos | Situação nossa | Ação |
|---|---|---|---|
| Categoria | `bot de afiliados whatsapp`, `bot de ofertas whatsapp`, `automação afiliados whatsapp`, `robô de ofertas` | Temos rotas, sem posição forte | Uma LP por termo com H1 exato, FAQ, prova (print de vendas) e 3+ links internos de páginas com impressão |
| Loja × ferramenta | `bot shopee afiliados`, `bot mercado livre afiliados`, `bot amazon afiliados` | Tier 1 existe (`/shopee-afiliados-whatsapp`…), 353 impressões | Renomear título/H1 para o padrão "Bot Shopee para afiliados no WhatsApp" e criar os **guias por loja** (cadastro no programa + onde achar o ID) que ele tem 9 e nós 0 |
| Tarefa | `converter link afiliado`, `espelhar grupos whatsapp`, `agendar ofertas whatsapp`, `postar em vários grupos` | `/espelhar-grupos-whatsapp` é nosso, mas ele criou a mesma URL | Reforçar a nossa com a ferramenta pública "Testar conversão" embutida (conteúdo interativo ganha de texto) |
| Alternativas | `alternativa ao X`, `X vs Y` | Nosso motor (47 % das impressões) | Cobrir os 8 concorrentes que ele cobre e nós não; atualizar ProAfiliados |
| Confiança | `<marca> é confiável`, `<marca> reclame aqui` | `/espelha-grupos-e-confiavel` existe | CNPJ, depoimentos, Reclame Aqui reivindicado |
| Dinheiro | `quanto ganha afiliado shopee` | feito | Adicionar "como saber quanto vendi" (página de vendas) |
| Risco | `whatsapp banido bot`, `bot whatsapp bloqueia número` | `/anti-ban-whatsapp`, `/faq-antiban-whatsapp` | Página com números reais (item 4 do § 4) |

**Autoridade / links:** ele tem satélites próprios; nós temos zero menção de
terceiro. Prioridade: (1) entrar no ranking do ofertasbot.com (pedir inclusão,
com ficha e print); (2) 1 vídeo no YouTube com o nome no título; (3) perfil
Reclame Aqui; (4) parcerias com diretórios de grupos (o gruposdowpp é dele; há
outros: prodivulgas.com, grupodewhatsapp.com); (5) guest post em blog de
afiliado Shopee.

**Higiene técnica que ele faz e nós não:** `dateModified` visível e no JSON-LD
em toda página; `Organization` com `legalName` + `taxID`; `SoftwareApplication`
com `AggregateOffer` (low/high price); breadcrumb visível; robots.txt liberando
nominalmente OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot,
Claude-User (o nosso libera `*`, que basta, mas o nominal é sinal de intenção
para quem lê).

### 5.2 Presença em IAs

O que já sabemos (23/09): ChatGPT traz 26 % dos cadastros; recomenda quando a
pergunta é "espelhar oferta" e nos deixa de fora em "bot para afiliados"; a
objeção é confiança (sem CNPJ). Ele responde as duas: "bot de afiliados" está no
title/H1/JSON-LD de tudo, e CNPJ está em todo rodapé.

Plano GEO, em ordem:

1. **Definição citável em toda superfície**: "Espelha Grupos é um bot de
   afiliados para WhatsApp que espelha ofertas, converte o link, busca ofertas
   da Shopee e mostra a comissão." Home, `/quem-somos`, llms.txt, pricing.md,
   `Organization.description`.
2. **CNPJ + razão social** no rodapé, em `/quem-somos` e no JSON-LD
   (`legalName`, `taxID`). É a única pendência que a IA nomeou.
3. **Página de fatos para IA** (`/fatos` ou reforço do llms.txt): tabela
   verificável de preço, lojas, canais, limites, reembolso, suporte, data de
   fundação, com `dateModified`. Ele espalha isso em FAQ de 40 perguntas.
4. **FAQPage em todas as páginas comerciais** com as perguntas que a IA faz
   ("é grátis?", "tem Telegram?", "mostra comissão?", "é confiável?", "bloqueia
   o número?").
5. **Menções de terceiros** (ranking ofertasbot, YouTube, Reclame Aqui,
   LinkedIn Pulse) — a IA cita quem é citado.
6. **Comparativos com os 8 concorrentes que faltam** + atualização do
   ProAfiliados: a IA responde "alternativa ao X" com quem tem a página.
7. **Medição mensal** (já existe `ROTEIRO_MEDICAO_IA.md`): adicionar as
   consultas "bot de afiliados grátis", "bot afiliados telegram e whatsapp",
   "bot que mostra comissão", "proafiliados vale a pena".

---

## 6. Backlog consolidado

Categorias: UI/UX · SEO · Vendas/Growth · Produto · GEO/IA. Impacto/Esforço:
Alto/Médio/Baixo. Prioridade: P1 (0–30 d, quick win) · P2 (30–90 d) · P3 (90+ d).

| ID | Tarefa | Categoria | Descrição breve e impacto esperado | Impacto | Esforço | Prio |
|---|---|---|---|---|---|---|
| B01 | Atualizar ficha e página `/alternativas/proafiliados` | SEO | Trocar "grátis 24/7, 5 plataformas, tag" por "grátis 2 h/dia, linha de crédito, 1 anúncio a cada 30 envios, 12 lojas, Telegram, Pix pré-pago sem reembolso"; registrar nexoafiliados/gruposdowpp como mesmo dono; datar 27/09. Evita fato errado na página que mais recebe busca de concorrente | Alto | Baixo | P1 |
| B02 | CNPJ e razão social no rodapé, `/quem-somos` e JSON-LD (`legalName`, `taxID`) | GEO/IA | Responde à objeção "não é confiável no sentido empresarial" | Alto | Baixo | P1 |
| B03 | Bloco "Garantia" na página de preços e na home | Vendas/Growth | Reembolso 7 dias, sem multa, suporte humano WhatsApp, sem anúncio em nenhum plano. Ele não tem nenhum dos quatro | Alto | Baixo | P1 |
| B04 | Print real do painel de vendas na home, em `/precos` e em `/vendas-e-comissao-afiliado-whatsapp` | Vendas/Growth | Prova visual do diferencial que a IA usa para recomendar; hoje é texto | Alto | Baixo | P1 |
| B05 | Contadores de uso no hero (afiliadas ativas, ofertas enviadas 30 d, lojas, dias de sessão) | Vendas/Growth | Paridade de prova social; vêm de `diag-*` já existentes, atualizados por cron diário | Alto | Médio | P1 |
| B06 | "Como usar esta tela" em toda tela do painel (2 linhas + próximo passo) | UI/UX | Reduz fricção sem redesenhar; copy vive em `logsCopy`-like | Médio | Baixo | P1 |
| B07 | Card de diagnóstico fixo "Seu robô está funcionando?" em todas as telas (não só home) | UI/UX | Passo N de 3, tempo estimado, botão que resolve; usa `ActivationChecklist` + `receptionHealth` | Alto | Médio | P1 |
| B08 | Modelos prontos por nicho (moda, casa, tech, bebê, beleza) além dos 2 genéricos | Produto | Já vêm "Automático clássico" e "Simples"; nicho aproxima do 1º envio | Médio | Baixo | P1 |
| B09 | Guias por loja `/guia/<loja>-afiliados` (6 lojas): cadastro no programa + onde achar o ID + como colar no painel | SEO | Cluster que ele tem 9 páginas e nós 0; linkar dos Tier 1 e do painel | Alto | Médio | P1 |
| B10 | Reivindicar Reclame Aqui + pedir inclusão no ranking do ofertasbot.com | GEO/IA | Duas menções de terceiro que a IA cita; ele já está no ranking | Alto | Baixo | P1 |
| B11 | Pré-pago com desconto (3/6/12 meses) via Mercado Pago, além da recorrência | Vendas/Growth | Paridade de paz de espírito; caixa antecipado; testar LTV contra 17 % de renovação | Alto | Médio | P1 |
| B12 | Página pública "Testar conversão" (`/ferramentas/testar-link`) sem login | SEO | Ferramenta interativa para `converter link afiliado`; captura e-mail | Médio | Baixo | P1 |
| B13 | Toggle "Colocar link do grupo no fim" e "Texto no fim de toda mensagem" na tela de espelhamento | Produto | Já existe via `{{grupoLink}}`; virar 2 checkboxes que ele tem | Baixo | Baixo | P1 |
| B14 | FAQPage com as 10 perguntas que a IA faz em todas as páginas comerciais | GEO/IA | "tem Telegram?", "é grátis?", "mostra comissão?", "bloqueia?"; respostas curtas e datadas | Médio | Baixo | P1 |
| B15 | Rodar as consultas de IA com os termos novos (grátis, Telegram, comissão, "proafiliados vale a pena") | GEO/IA | Placar base antes das mudanças | Médio | Baixo | P1 |
| B16 | ~~Pareamento por código de 8 dígitos~~ — **já existe** ("Estou no celular — conectar por número", conferido em 27/09) | Produto | Sai do backlog; entra como argumento na página de conexão | — | — | feito |
| B17 | Tema escuro no painel | UI/UX | Paridade de percepção "app"; tokens já existem no design system | Baixo | Médio | P2 |
| B18 | Barra inferior no celular (Início · Espelhamento · Criar oferta · Envios · Menu) | UI/UX | Uso é majoritariamente celular; CTR celular já é menor | Médio | Médio | P2 |
| B19 | Contagem regressiva e cancelar por item na aba "Próximos envios" | UI/UX | A aba já existe no Basic; falta o "sai em 4:32" e o cancelar 1 que ele tem | Médio | Baixo | P2 |
| B20 | Cliques por destino e por oferta no painel (usar `/r/:hash`) | Produto | Primeiro passo do "qual grupo rende" (gap 1) | Alto | Médio | P2 |
| B21 | Comissão Shopee por grupo de destino | Produto | Cruza `shopee-sales` com log de envio; ninguém tem | Alto | Alto | P2 |
| B22 | Mensagens recorrentes (intervalo, diário, dias da semana) com imagem | Produto | Paridade com "Mensagens agendadas"; reaproveita `agendados` | Médio | Médio | P2 |
| B23 | Alternar lojas (rodízio por destino) | Produto | Evita grupo só de Shopee; entra no `destinationRouting` | Baixo | Médio | P2 |
| B24 | Anti-link para grupos em que o número é admin | Produto | Paridade; pedido comum de admin de grupo | Médio | Médio | P2 |
| B25 | Página "Proteção do número: os números do mês" (idade média das sessões, % quedas, preset padrão) | GEO/IA | Único do mercado; responde ao maior medo com dado agregado | Alto | Médio | P2 |
| B26 | Comparativos dos 8 concorrentes que ele cobre e nós não (Afilira, Divulgador Inteligente, Divulga Ninja, Gigi Prime, Busqy, PromoBot, DivulgaLinks, OfertasBot) | SEO | Motor de 47 % das impressões; exige ficha com preço datado | Alto | Médio | P2 |
| B27 | 5 depoimentos com nome/foto/permissão em `/espelha-grupos-e-confiavel`, home e preços | Vendas/Growth | Já no plano de 23/09; ninguém no nicho tem | Alto | Baixo | P2 |
| B28 | Programa de afiliados público (`/programa-de-afiliados` com comissão em PIX) + card no painel | Vendas/Growth | Ele dá 15 dias; nós pagamos dinheiro e não contamos | Médio | Baixo | P2 |
| B29 | `dateModified` visível ("Revisado em …") + no JSON-LD em todas as páginas comerciais | SEO | Frescor; ele carimba diariamente | Baixo | Baixo | P2 |
| B30 | Vídeo YouTube "Espelha Grupos: do QR ao primeiro envio em 5 min" com o nome no título | GEO/IA | Menção de terceiro que a IA e o Google mostram | Médio | Médio | P2 |
| B31 | Onboarding por nicho (template + preset anti-ban + sugestão de fontes) no cadastro | Produto | Ataca Basic 6 % de renovação; mede tempo até 1º envio | Alto | Médio | P2 |
| B32 | Alertas fora do painel (e-mail/WhatsApp) quando a sessão cai ou a fila para | Produto | Retenção; `receptionHealth` já detecta | Médio | Médio | P2 |
| B33 | Vitrine pública do grupo (página por cliente com últimas ofertas + botão entrar) | Produto | Gap 5: ~9 mil buscas/mês por "entrar em grupo de ofertas"; SEO programático que a cliente divulga | Alto | Alto | P3 |
| B34 | Telegram como destino (e origem) | Produto | Paridade mais comum do mercado (10 de 14 concorrentes); demanda de busca baixa, objeção de venda alta | Alto | Alto | P3 |
| B35 | Verificação da oferta antes de sair (preço atual, cupom válido, estoque) | Produto | Gap 2: ninguém valida; vira promessa "não posta oferta morta" | Alto | Alto | P3 |
| B36 | Mais lojas: TikTok Shop, Awin (Kabum, Nike, Samsung), Natura | Produto | 12 dele vs 6 nosso; começar por Awin (rede = muitas lojas) | Médio | Alto | P3 |
| B37 | Vários números na mesma conta (cobrança por conexão) | Produto | Gap 7 (agência pequena); memória: SUPER SINALIZAR, ~0,35 GB por sessão | Médio | Alto | P3 |
| B38 | Copiar Tudo (mídia, enquete, figurinha) por fonte | Produto | Paridade para quem clona canal | Baixo | Alto | P3 |
| B39 | Camada gratuita permanente limitada (ex.: 1 grupo de destino, 10 ofertas/dia, sem anúncio) | Vendas/Growth | Porta de entrada que ele e mais 4 concorrentes têm; decidir com dado das renovações de outubro; custo de RAM por sessão grátis exige teto | Alto | Alto | P3 |
| B40 | Status do WhatsApp como destino | Produto | Paridade; baixo volume de pedido | Baixo | Médio | P3 |
| B41 | Credencial sem cookie para Amazon (StoreID) e Mercado Livre (etiqueta/link), como o concorrente | Produto | Maior fricção do onboarding hoje: 3 das 6 lojas pedem extensão Cookie Editor no Chrome (só computador). Verificar o que a conversão perde sem cookie (link curto oficial × link com tag) antes de decidir | Alto | Médio | P1 |
| B42 | Esconder a caixa "Fila de envio travada? Limpar ofertas da fila" quando a fila está vazia ou andando | UI/UX | Botão destrutivo laranja aparece em conta nova sem nenhum envio; só mostrar com item preso há mais de N minutos | Médio | Baixo | P1 |

### Roadmap no tempo

**Sprints iniciais (0–30 dias) — P1, alto impacto e baixo/médio esforço**
B01 (feito em 27/09), B02, B03, B04, B05, B06, B07, B08, B09, B10, B11, B12, B13, B14, B15, B41, B42.
Ordem sugerida: B01 → B02 → B03/B04 (mesma PR de página de preços) → B10 → B14
→ B09 → B05 → B06/B07 → B08/B13 → B11 → B12 → B15 (mede o efeito).

**Fase de escala (30–90 dias) — P2, retenção, autoridade e painel**
Retenção/painel: B18, B19, B20, B21, B22, B31, B32. Autoridade: B25,
B26, B27, B28, B29, B30. Paridade barata: B17, B23, B24.

**Fase de domínio (90+ dias) — P3, diferenciais e gaps**
B33 (vitrine), B35 (verificação de oferta), B34 (Telegram), B39 (grátis
permanente, só com dado de outubro), B36, B37, B38, B40.

---

## Anexos e evidências

- Prints da área logada dele (home, 10 telas, modal de planos, tema claro,
  celular), do nosso painel (18 telas, conta Basic, 27/09) e dos dois sites
  (hero, preços) ficaram na sessão desta análise; não foram commitados porque
  mostram o e-mail das contas de teste.
- Rotas de API que o painel dele chama (36), úteis para entender o modelo:
  `/api/dashboard/health` (diagnóstico com `issues[]` e `free_plan.minutes_remaining`),
  `/api/radar-ofertas/config`, `/api/global-feed/{config,sources}`,
  `/api/manual-templates`, `/api/message-delay`, `/api/bot/schedule`,
  `/api/rotate-global/config`, `/api/scheduled-broadcasts`, `/api/referral/{info,list}`,
  `/api/message-logs` (só 24 h), `/api/<loja>/credentials` × 12.
- Fontes públicas: proafiliados.com (home, /precos, /comparativo, /faq,
  /guia/como-usar, /sobre, /lojas, /espelhar-grupos-whatsapp,
  /blog/melhores-bots-de-ofertas-para-afiliados, /alternativa/shozap,
  /register, robots.txt, sitemap.xml, llms.txt), ofertasbot.com ranking de 14
  bots, gruposdowpp.com.br, reclameaqui.com.br (detector de site).
