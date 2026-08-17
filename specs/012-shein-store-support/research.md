# Phase 0 — Research: SHEIN como 5ª loja

**Fonte de verdade**: medições ao vivo de 2026-08-18 (5 links, 2 afiliados, 3 produtos), o plano de
referência aprovado e `scripts/diag-shein-affiliate-link.mjs` (read-only, já commitado e validado em
campo). **Nenhuma pesquisa nova na web e nenhum acesso à SHEIN foi feito nesta fase** — não é
necessário, e o repo trata acesso especulativo à loja como risco (captcha, 429).

Nenhum item ficou como NEEDS CLARIFICATION.

---

## D-001 — A comissão é creditada pelo link montado por nós

**Decisão**: implementar a loja. A conversão por parâmetro na URL credita a cliente.

**Rationale**: era a pergunta que bloqueava tudo (Tarefa 0 do plano de referência), pelo mesmo medo
do RCA da Amazon ("zero cliques por 8 dias") e do `partner_id` do ML (pendurar em página não-produto
não credita). A cliente confirmou o crédito pelo link montado, e o probe já havia validado a
mecânica dos parâmetros.

**Alternativas consideradas**: (a) rede de afiliados com API de deeplink (Awin/Admitad) — só valeria
se o programa próprio não creditasse; (b) endpoint interno do painel logado
(`/api/share/link/from/url`) — **descartado**: é scraping de painel autenticado, sem contrato de
estabilidade e contra os termos.

**Gate residual**: reconferir com um clique real em staging antes de promover para `main` (quickstart
passo 6). "A oferta saiu bonita" ≠ "a comissão foi creditada".

---

## D-002 — Resolução do oneLink: redirects manuais lendo `<input id="url">`

**Decisão**: portar `resolveOneLink` do script de diagnóstico para
`resolveSheinShortLink(url, { timeoutMs, fetchImpl })`, seguindo o padrão de
`resolveShopeeShortLink` (`src/converters/shopee.js:321`): redirects manuais, cookie jar, parada no
primeiro hop que já revela o produto.

**Rationale**: `https://onelink.shein.com/<n>/<code>` **não redireciona por HTTP no 1º hop** — serve
HTML com o destino num `<input id="url" value="...">` escondido, lido pelo JS da página; só depois
vem 302. `fetch(redirect:'follow')` perde o hop informativo, e meta-refresh não existe nessa página.
Por isso o padrão `<input id="url">` vem **primeiro** na lista de padrões de extração.

**Alternativas consideradas**: `fetch(redirect:'follow')` + `res.url` (não resolve — mesma lição do
incidente da Shopee); headless browser (dependência pesada, viola FR-024 e a política de memória).

---

## D-003 — Parar antes de `/risk/challenge`

**Decisão**: `SHEIN_RISK_RE = /\/risk\/(?:challenge|action)/i` checado antes de seguir qualquer hop;
ao detectar, para e usa o hop **anterior**.

**Rationale**: a cadeia termina no captcha do sistema de risco da SHEIN, que responde **HTTP 200**.
Seguir até lá descarta exatamente o hop onde estão `goods_id` e os parâmetros. Armadilha idêntica à
do ML (`/gz/account-verification` responde 200) e da Shopee (`unsupported.html`): **nunca concluir
"existe" por status 200 — olhar a URL final e o corpo.**

---

## D-004 — Não raspar título/preço da página de produto

**Decisão**: fora de escopo. Título e preço continuam vindo do texto do grupo de origem, como já
acontece hoje no espelhamento.

**Rationale**: medido do VPS (IP de datacenter, que é o que temos): `br.shein.com/...-p-<id>.html`
responde 200 mas redirecionada para `/risk/challenge`. Testado com cookies, com cabeçalhos completos
de navegador e com UA Googlebot (esse devolveu **429**). A home não tem nenhuma tag `og:`; listagens
e busca são 100% client-side.

**Consequência aceita**: ofertas de SHEIN saem sem título/preço raspados. O motor já degrada para
fallback (`inferTitleFromUrl` + `scrapeWarning`) — comportamento existente, nada de código novo.

---

## D-005 — Foto do produto vem do `og:image` do oneLink, com strip de CDN

**Decisão**: `fetchProductImage` (`src/converters/imageScrapers.js:419`) ganha um ramo `shein` que
lê o `og:image` da **página do oneLink** (não da página de produto) e remove o sufixo de thumbnail do
endereço em `img.ltwebstatic.com`.

**Rationale**: a página do oneLink serve `og:image` com a foto do produto. Removendo
`_thumbnail_405x552` do endereço, a original vem **1340x1785** — acima de
`IMAGE_HIRES_MIN_DIMENSION_PX = 800`, que é a barra que não se baixa. É o mesmo padrão de strip de
CDN já usado para Amazon (`_AC_SL1500_`) e Shopee (`_tn`, `@resize_w`).

**Detalhe de encaixe**: `buildManualLinkPreview` passa `sourceUrl = primary.url` (o link **original**
da mensagem) para `fetchProductImage`. Para SHEIN esse é justamente o oneLink — a foto vem sem hop
extra. O fallback genérico `resolveByHtmlLayers` já cobriria og:image, mas sem o strip devolveria a
miniatura de 405px; por isso o ramo dedicado.

**Fail-safe**: sem foto, a oferta sai mesmo assim (FR-019) — `buildManualLinkPreview` já degrada.

---

## D-006 — Frase promocional genérica entra na lista de títulos-lixo

**Decisão**: acrescentar a frase genérica da SHEIN a `BOGUS_SCRAPE_TITLES` /
`BOGUS_SCRAPE_TITLE_PATTERNS` (`src/converters/productInfoScraper.js:254`/`278`), como padrão
(frase em qualquer posição), não como casamento exato.

**Rationale**: o `og:title` do oneLink é sempre a mesma frase promocional ("Não perca esta oferta
grande na SHEIN! Economize muito agora!"), igual para todo produto. Sem a guarda, ela vazaria como
título da oferta — exatamente o que aconteceu com o "Oops! Seu navegador não é mais aceito!" da
Shopee em 2026-06. Padrão (regex), porque a frase pode variar de pontuação/locale.

---

## D-007 — SHEIN fica FORA do guard de title mismatch

**Decisão**: **não** incluir `shein` em `TITLE_MISMATCH_GUARD_PLATFORMS`
(`src/bot-worker.js:234`).

**Rationale**: o guard compara o texto da mensagem com o título raspado. Não há título raspado
confiável para SHEIN (D-004/D-006) — o guard com scrape instável bloquearia oferta boa
(`skip:title_mismatch`), o oposto do objetivo da feature.

---

## D-008 — Cupom/campanha sem gate de flag

**Decisão**: links de SHEIN sem produto (cupom, campanha, vitrine) convertem pelo mesmo mecanismo,
**sem** passar por `COUPON_LINK_CONVERT`.

**Rationale**: o flag existe para lojas onde converter cupom tem risco real (ML não credita em página
não-produto; Shopee podia gerar link quebrado que caía no `unsupported.html`). Na SHEIN o crédito é
por parâmetro em qualquer página — mesmo caso do Magalu, que sempre converteu cupom sem flag.

---

## D-009 — SHEIN fora de sondagem de sessão e de aviso de vencimento

**Decisão**: **não** acrescentar `shein` a `PLATFORMS_WITH_SESSION_CHECK`
(`src/credentialSaveCheck.js:25`) nem a `EXPIRY_ALERT_PLATFORMS`
(`src/credentialExpiry/policy.js:19`).

**Rationale**: os dois registries cobrem lojas cuja credencial vence ou é recusada (cookie de sessão
do ML/Amazon, chave da Shopee). O identificador da SHEIN é permanente — não vence, não é recusado.
Mesmo caso do Magalu, que já está de fora. Inventar sondagem que a loja não oferece produziria alarme
falso, e alarme falso recorrente treina a cliente a ignorar o alerta que importa.

---

## D-010 — Um único campo de credencial, com normalização no save

**Decisão**: `REQUIRED_FIELDS.shein = ['tag']` (um campo). O painel pede "o link de afiliada" e o
backend extrai o identificador em `sanitizeCredentialBody` (`src/credentialHealth.js:200`), aceitando
também o número puro.

**Rationale**: normalizar no `sanitizeCredentialBody` é o chokepoint que **toda** escrita de
credencial já atravessa (`PUT /credentials/:platform`) — garante que o que é gravado é sempre o
identificador limpo, independentemente de qual superfície salvou. Reaproveita a proteção em repouso
já existente (AES-256-GCM), sem migration de schema (`Credential.platform` é string livre,
`Credential.data` é JSON cifrado).

**Alternativas consideradas**: dois campos (link + número) — pior para a cliente e contraria FR-004;
extrair no frontend — deixaria o backend aceitando lixo vindo de outra superfície.

---

## D-011 — Recusar o formato de compartilhamento nas DUAS pontas

**Decisão**: recusar tanto na conversão (retorna `null`) quanto no save da credencial (erro com
explicação leiga).

**Rationale**: o formato `api-shein.shein.com/h5/sharejump/appjump?shc=<token>&link=<token>&url_from=GM7<id>`
tem prefixo `GM7` em vez de `affiliate_koc_`, não traz `goods_id`, e prende o produto num token
opaco. Trocar só a identificação nesse formato publicaria um link que **parece** convertido e pode
creditar a comissão a quem compartilhou — falha grave e silenciosa. Duas guardas independentes:
ausência de `goods_id` **ou** presença de `shc`/`link`.

Na credencial, é o erro mais provável da cliente (o botão "compartilhar" do app é mais visível que o
Gerador de Link do painel), por isso a mensagem precisa dizer **onde pegar o link certo**, não só
"link inválido" (SC-008).

---

## D-012 — Domínios reconhecidos

**Decisão**: `shein.com`, `br.shein.com`, `m.shein.com`, `us.shein.com`, `pt.shein.com`,
`onelink.shein.com`, `api-shein.shein.com`, `shein.top`.

**Rationale**: todos confirmados em campo. `s.shein.com` **não existe** — não colocar no `PATTERNS`
(reconhecer domínio inexistente é superfície de falsa detecção sem ganho). Manter o prefixo
`(?:[a-z0-9-]+\.)*` do padrão do repo, que exige ponto separador e por isso não casa host colado
(`notshein.com`).

Nota: como `shein.com` cobre os subdomínios pelo prefixo, a lista de host explícitos existe para
legibilidade e para as duplicações do painel, que usam alternância literal.

---

## D-013 — Migration só para `BotConfig.platforms`, e só DML

**Decisão**: mudar o default em `prisma/schema.prisma:294` **e** aplicar migration DML idempotente
(padrão de `20260710160000_group_image_mode_preview_default`), sem `ALTER TABLE`.

**Rationale**: o default do schema só vale para linhas novas; as contas existentes precisam do
`UPDATE`. DML puro convive com o WAL e o `busy_timeout` — não exige lock exclusivo, então **não**
aciona a pegadinha #8 (parar API/supervisor antes do migrate). Idempotente para poder rodar duas
vezes sem efeito.

---

## D-014 — Sem impacto de memória

**Decisão**: nenhuma sinalização de RAM necessária (REGRA #1 da política de memória não é acionada).

**Rationale**: nenhum processo PM2 novo, nenhum worker, nenhuma dependência, nenhum cache novo. O
resolvedor de short link vive dentro do pipeline já existente e não guarda estado entre mensagens; a
única memória adicional é o cache de imagem já existente (`setCached` em `imageScrapers.js`), que a
SHEIN apenas reusa.
