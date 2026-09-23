# Wabot — instruções para agentes de IA (Codex / Claude)

Este arquivo é carregado em TODA sessão e em TODO subagente — por isso ele é
curto de propósito. Aqui ficam só as regras que valem sempre. O detalhe de cada
assunto (RCAs, "não regredir", envs, diagnósticos) mora em `docs/rca/` e deve
ser lido **só quando o assunto aparece** (ver "Índice por tema" abaixo).
Codex lê `AGENTS.md` automaticamente; `CLAUDE.md` faz `@AGENTS.md`.

⚠️ **Não voltar a colar RCA aqui.** RCA novo vai para o `docs/rca/<tema>.md`
certo (ou um arquivo novo + uma linha no índice). Este arquivo passou de
~450 KB (~110 mil tokens por sessão) em 2026-09-23 porque cada incidente virou
seção fixa. Teto: `test/agents-md-enxuto.test.js` falha acima de 40 KB.

## Estilo de resposta com a usuária (obrigatório)

Postura ultra-sintética. Linguagem simples (pouco técnica), direta, sem
introduções. Ao responder problema/erro/dúvida, usar estritamente 4 pontos:

1. **O QUE ACONTECEU:** o problema em si, rápido e claro.
2. **PORQUE:** a causa, explicada de forma simples.
3. **O QUE DEVE SER FEITO:** o que corrigir.
4. **COMO:** passo a passo prático e direto.

Regra de ouro: não gastar tokens com texto longo ou introdução simpática.

## Economia de tokens (obrigatório)

- **Nada de correção ou implementação por suposição.** Toda causa raiz precisa
  de DADO (log, banco, medição, teste que reproduz). Hipótese não verificada é
  dita como hipótese, nunca como fato.
- **Faltou dado da VPS → pedir comando à usuária**, mas SEMPRE o mínimo:
  - um comando por pergunta que ele responde; nada de "rode tudo isto para ver";
  - a saída já filtrada no próprio comando (`grep -c`, `tail -n 20`, `wc -l`,
    `awk` somando, `LIMIT 20` no SQL, `head`), nunca log ou tabela inteira;
  - dizer em uma linha o que cada saída decide ("se der 0, a causa é X");
  - preferir os `scripts/diag-*.mjs` que já existem (read-only) a comando novo.
- **Ler o `docs/rca/<tema>.md` do assunto ANTES de investigar** — a maioria dos
  sintomas já tem causa, arquivo e diagnóstico registrados lá.
- **Ler só o trecho necessário** do arquivo (Grep → Read com offset/limit),
  não arquivo inteiro. `src/bot-worker.js` e os `docs/rca/*.md` são grandes.
- **Subagentes só quando compensa**: cada um recarrega este arquivo. Bug ou
  ajuste pequeno = sessão única, sem pipeline de vários agentes.

## Fluxo de desenvolvimento (canônico — não pule etapas)

1. Toda feature/fix nasce em uma branch a partir de `develop`.
2. PR é aberta **contra `develop`** (nunca direto para `main`).
3. Ao mergear em `develop`, o GitHub Actions (`.github/workflows/deploy.yml`)
   faz deploy automático para **staging** (`~/wabot-staging` no VPS, branch
   `develop`, PM2 apps `api-staging` + `visual-staging`).
4. Validação manual em `http://178.105.54.0:3006`.
5. Só depois de validado em staging, abrir PR de `develop` → `main`. O merge
   em `main` dispara o mesmo workflow para **produção** (`~/wabot` no VPS,
   branch `main`, PM2 apps `api` + `dashboard`).

Nunca pular staging. Nunca subir direto em `main`. Nunca fazer amend em
commits já mergeados — sempre criar commit novo.

## Processos PM2 (canônico — resumo)

| App                      | Ambiente | Responsabilidade                                              |
|--------------------------|----------|---------------------------------------------------------------|
| `api`                    | prod     | Fastify HTTP + JWT + rotas                                    |
| `dashboard`              | prod     | Next.js                                                       |
| `bot-supervisor`         | prod     | Ciclo de vida das sessões WhatsApp (fork dos bot-workers)     |
| `snapshot-cron`          | prod     | Cron diário de snapshots de canais                            |
| `api-staging`            | staging  | Espelho da API                                                |
| `visual-staging`         | staging  | Espelho do dashboard                                          |
| `bot-supervisor-staging` | staging  | Espelho do supervisor                                         |

- `BOT_SUPERVISOR_MODE`: `inline` (API faz `fork()` dos workers; deploy da API
  derruba sessões) ou `remote` (supervisor faz o `fork()`; deploy da API não
  toca nas sessões). Staging canônico = `inline`.
- Em `remote`, **deploy da API NÃO recarrega os bot-workers**: fix em
  `bot-worker.js`/`core/`/`converters/` só vale após
  `pm2 restart bot-supervisor --update-env` — que reconecta TODAS as sessões
  (anunciar antes). Confira o uptime do supervisor antes de achar que o fix falhou.
- Mudar env exige `pm2 delete` + `start` (não `restart --update-env`).
- Detalhes (cutover, pré-flight, guards, pegadinhas, `.env` mínimo, deploy):
  `docs/rca/deploy-e-infra.md`.

## Ambientes e portas (canônico — não inventar valores)

| Ambiente | Branch  | Diretório no VPS   | PM2 apps                        | Dashboard PORT | API_PORT | URL pública                   |
|----------|---------|--------------------|---------------------------------|----------------|----------|-------------------------------|
| Staging  | develop | `~/wabot-staging`  | `visual-staging`, `api-staging`, `bot-supervisor-staging` | `3006`         | `3004`   | `http://178.105.54.0:3006`    |
| Produção | main    | `~/wabot`          | `dashboard`, `api`, `bot-supervisor` | `3000`         | `3001`   | `http://espelhagrupos.com.br` |

O proxy do Next (`dashboard/app/api/[...path]/route.js`) já mapeia
`3006 → 3004` e `3000 → 3001` automaticamente via header `host`.

**Trocar portas exige mudança em 3 lugares ao mesmo tempo:**
1. `apiPortByDashboardPort` em `dashboard/app/api/[...path]/route.js`
2. defaults em `scripts/deploy_safe_staging.sh` (`VISUAL_BASE_URL` / `API_BASE_URL`)
3. esta tabela acima

## Política de memória (resumo — completa em `docs/rca/memoria-e-capacidade.md`)

- **REGRA #1 — SUPER SINALIZAR antes de executar** qualquer mudança que possa
  aumentar RAM (processo PM2 novo, worker, heap maior, cache em memória,
  BullMQ/Redis, staging ligado, dependência pesada, mais concorrência):
  estimativa de RAM + impacto no VPS + OK explícito da usuária.
- **REGRA #2** — sempre oferecer alternativa mais leve.
- **REGRA #3** — limpeza de memória só se segura e reversível (swap, desligar
  staging, teto de heap). Proibido sem OK: restart em massa, matar bot-worker,
  `FLUSHALL`/`del` em fila BullMQ, baixar timeouts.
- Estimativa: `RAM ≈ 1 GB + N_sessões × 0,18 GB + ~20%`; para decidir
  capacidade use **0,35 GB/sessão**. Servidor (2026-09-18): 30,6 GB, teto 80
  vagas, limite seguro da política ~71. Sinal que decide é o **swap**.

## Design system (canônico — toda alteração visual segue ele)

A fonte única de verdade visual é **`docs/design-system/design-system-v2.html`**
(Espelha Grupos · Design System v2, arquivo autocontido — abrir no navegador).
**Qualquer mudança visual no dashboard/painel/admin/site deve seguir esse
documento**: cores, tipografia (Figtree), forma e sombra, botões, campos, cards/
KPIs/tags, menu lateral, padrão de página, padrão PRO, planos e acesso, voz e
texto e o checklist de página nova.

Tokens principais (usar os tokens, nunca hex solto):

| Token | Valor | Token | Valor |
|---|---|---|---|
| `--bg` | `#EEF6F2` | `--accent` | `#7CC9A9` |
| `--bg-soft` | `#DDEDE5` | `--accent-strong` | `#3E9C7A` |
| `--surface` | `#FCFEFD` | `--accent-2` | `#D9CFEA` |
| `--ink` | `#1F2D2A` | `--accent-3` | `#F6E8D8` |
| `--ink-soft` | `#5A6E68` | `--pro` | `#6F4FE8` |
| `--ink-faint` | `#8FA09A` | `--pro-ink` / `--pro-soft` | `#4B34A8` / `#ECE7FA` |
| `--warn` | `#E8A45A` | `--danger` | `#D97757` |

**Não regredir:** padrão visual novo que não está no design system é decidido
com a dona do produto e entra no documento ANTES de ir para a tela — senão cada
tela volta a inventar o próprio estilo. Atualizar o design system = substituir o
arquivo (nova versão), não editar tela a tela.

## Triagem de novas demandas (implementar agora vs. backlog)

- **Sempre que surgir uma nova demanda**, pergunte à usuária se vamos
  implementá-la agora ou se ela prefere adicioná-la como issue ao backlog.
- Se a escolha for **backlog**, releia este `AGENTS.md` para entender o
  padrão de como as issues devem ser criadas (fluxo `feature → develop →
  main`, convenções de processos, portas, taxonomias e demais regras
  canônicas) antes de redigir a issue.

## Regras para qualquer agente de IA neste repo

- **Não faça push direto em `develop`. Sempre abra branch e PR contra `develop`.**
- **Sempre tente encontrar a causa raiz de algo, quando estivermos falando de
  erros e bugs.** Para ser assertivo pode me dar comandos para rodar na VPS. Mas
  só me peça realmente o necessário para não gastar tokens desnecessários.
- **MEMÓRIA — SUPER SINALIZAR** antes de qualquer mudança que aumente RAM
  (resumo em "Política de memória" acima; completa em `docs/rca/memoria-e-capacidade.md`).
- **Não trocar portas** sem atualizar os 3 lugares em "Ambientes e portas".
- **Não criar PR para `main` direto**, **não amend** em commits já mergeados
  — ver "Fluxo de desenvolvimento" acima.
- **Não rodar destrutivos** (`reset --hard`, `push --force`, `branch -D`,
  `rm -rf` em paths reais) sem permissão explícita.
- **Não mexer em `.env` ou banco** em produção sem confirmar com a usuária.
- Antes de "consertar" o deploy, conferir se a falha está no workflow
  (Actions) ou no smoke test pós-PM2 (`.env`/porta no VPS) — são causas
  diferentes com correções diferentes.
- Mudanças em banco/migrations sempre passam por staging antes de prod.
- Antes de mudar `DATABASE_URL`, conferir contagem de registros no banco
  atual (`sqlite3 <db> "SELECT COUNT(*) FROM User"`).
- Backups de prod são responsabilidade do `scripts/backup_prod.sh`
  (cron diário). Não tocar nele sem testar restauração.

## Índice por tema — leia o arquivo ANTES de mexer no assunto

| Mexeu em… | Leia |
|---|---|
| deploy, workflow, PM2, `.env`, supervisor, cutover inline/remote, pegadinhas, backup, Cloudflare, IndexNow | `docs/rca/deploy-e-infra.md` |
| RAM, capacidade, teto de robôs/vagas, heap do worker, staging liga/desliga | `docs/rca/memoria-e-capacidade.md` |
| sessão WhatsApp caindo/reconectando, QR/pareamento, 405/408/500, cegueira de recepção, retry-receipt | `docs/rca/whatsapp-sessao.md` |
| espelhamento (destinos, duplicatas, domínio próprio, texto adicional, tela Espelhamento) | `docs/rca/espelhamento.md` |
| fila de envio, BullMQ/DLQ, timeouts, dedupHits, `errorMsg`, atraso/vazão | `docs/rca/envio-e-filas.md` |
| foto/card de preview, marca d'água, `imageMode`, image scrapers | `docs/rca/imagem-e-preview.md` |
| conversão por loja (Shopee, ML, Amazon, SHEIN, AliExpress, vitrine, preço) | `docs/rca/lojas-conversao.md` |
| ofertas automáticas, busca Shopee, fila de revisão, "Criar oferta", motor de oferta | `docs/rca/ofertas-automaticas-e-criar-oferta.md` |
| cobrança, Mercado Pago, assinatura recorrente, ROI, Financeiro | `docs/rca/cobranca.md` |
| e-mails (motor, gatilhos, jornadas, voucher, senha, SMTP) | `docs/rca/emails.md` |
| credenciais de afiliado, criptografia, login/brute-force, aviso de código vencido | `docs/rca/credenciais-e-seguranca.md` |
| painel admin (clientes, tags, funil, capacidade na tela, contato ativo) | `docs/rca/admin.md` |
| SEO, marketing, páginas públicas, dados de mercado, marca | `docs/rca/seo-marketing.md` |
| Instagram Stories | `docs/rca/instagram.md` |
| plano Basic × PRO, cadeados do painel, menu, Minha conta | `docs/rca/planos-basic-pro.md` |

## Mapa de sintomas → onde olhar (atalhos mais usados)

Use para ir direto ao ponto. Cada linha: sintoma · arquivo principal ·
diagnóstico pronto (read-only, rodar no diretório do ambiente na VPS) · tema.

| Sintoma relatado | Código principal | Diagnóstico pronto | Tema |
|---|---|---|---|
| Oferta saiu **sem foto** / card vazio | `src/converters/imageScrapers.js`, `buildManualLinkPreview` em `src/bot-worker.js`, `src/core/previewImageFallbackPolicy.js` | `diag-preview-sem-imagem.mjs`, `diag-shopee-foto.mjs`, `diag-thumb-por-origem.mjs` | imagem-e-preview |
| Foto pequena/selo, card de tamanho variado, só aparece se clicar | `src/core/previewCardCanvas.js`, `src/core/cardPhoto.js`, `src/core/inlineThumbnail.js` | — | imagem-e-preview |
| Marca d'água não sai / some | `src/core/destinationWatermark.js`, `reportWatermarkMissing` em `src/bot-worker.js` | conferir uptime do `bot-supervisor` vs data do fix | imagem-e-preview |
| Link de loja não converteu / link errado / página não existe | `src/converters/<loja>.js`, `src/core/conversionScheduler.js` | `diag-ml-sends.mjs`, `diag-ml-social-featured.mjs`, `diag-amazon-clicks.mjs`, `diag-shein-shortlink.mjs` | lojas-conversao |
| Oferta espelhada saiu com link do concorrente | `src/core/mirrorLinkGuard.js` (se não converteu, não envia) | SQL: `success` com `convertedUrl = originalUrl` fora de `broadcast` | lojas-conversao |
| Preço errado na oferta | `src/converters/amazonPrice.js`, `src/converters/productInfoScraper.js` | `diag-amazon-preco.mjs` | lojas-conversao |
| "Faltou cadastrar a loja" / `skip:no_valid_conversions` | `src/credentialHealth.js`, `dashboard/lib/painel/logsCopy.js` | `diag-sem-etiqueta.mjs`, `diag-shopee-chave-por-conta.mjs` | credenciais-e-seguranca |
| "Criar oferta" da Shopee sem nome/preço; chave Shopee recusada (erro 10020/10035) | `src/converters/shopee.js`, `src/converters/offerEngine.js` | `diag-shopee-chave.mjs` (cada operação com a chave real + conta de controle), `diag-criar-oferta-shopee.mjs` | ofertas-automaticas-e-criar-oferta |
| Oferta de site próprio do grupo não espelha / link some | `src/core/customDomainLinkResolver.js` | `diag-dominio-proprio.mjs --horas=72` | espelhamento |
| Espelhou para grupo errado / não espelhou / duplicou | `src/core/destinationRouting.js`, `src/core/incomingFreshness.js` | `diag-mirror-duplicates.mjs`, `diag-oferta-descartada.mjs` | espelhamento |
| Fila não envia / envio atrasado / fila parada | `processSendJob` em `src/bot-worker.js`, `src/core/queueExpiry.js` | `diag-fila-grupo.mjs`, `diag-fila-parada.mjs` | envio-e-filas |
| Ofertas automáticas: só acessório, não envia | `src/offerAutomation/dispatcher.js`, `src/offerAutomation/searchListType.js` | `diag-busca-shopee.mjs`, `diag-offer-review.mjs` | ofertas-automaticas-e-criar-oferta |
| WhatsApp caindo / "conectado" sem receber / não conecta | `src/core/reconnectPolicy.js`, `src/core/receptionHealth.js`, `src/core/waVersion.js` | `diag-nao-conecta.mjs`, `diag-frota-cega.mjs` | whatsapp-sessao |
| "Servidor no limite de robôs" / sem vaga | `src/domain/session/startRefusal.js`, `src/supervisor/index.js` | `diag-vagas-robos.mjs`, `diag-clientes-sem-vaga.mjs` | memoria-e-capacidade |
| RAM/swap subindo | `src/ops/capacity/policy.js` | `diag-memoria-crescimento.mjs`, `diag-memoria-nativa.mjs` | memoria-e-capacidade |
| Pagamento recusado / assinatura "não concluída" | `src/domain/payments/subscriptionPolicy.js`, `src/api/routes/payments.js` | `diag-assinatura-recusada.mjs`, `testar-recorrencia.mjs`, `sincronizar-assinatura.mjs` | cobranca |
| E-mail não chegou | `src/email/dispatcher.js`, `src/emailTriggers/lifecyclePolicy.js` | `diag-email-vencimento.mjs` (antes: conferir `SMTP_*`) | emails |
| Tag Pagante/número repetido não aparece | `src/domain/admin/payingStatus.js`, `src/domain/admin/sharedPhoneStatus.js` | `diag-tag-pagante.mjs`, `backfill-numeros-whatsapp.mjs` | admin |
| Página/SEO sem impressão, cadastro sem origem | `dashboard/lib/seo-registry.mjs`, `src/domain/admin/signupOrigin.js` | `diag-paginas-seo.mjs`, `diag-origem-cadastros.mjs` | seo-marketing |
| Recurso aparece com cadeado / "só no PRO" / 403 `FEATURE_REQUIRES_PRO` | `src/billing/plans.js`, `dashboard/components/pro/ProGate.js` | `scripts/basic-sem-recursos-pro.mjs` (quem ainda guarda marca/botão/variação sem o PRO) | planos-basic-pro |
| Deploy vermelho | `.github/workflows/deploy.yml`, `scripts/deploy_safe_*.sh` | ver "Pegadinhas" | deploy-e-infra |

Se o sintoma não está no mapa: ler o tema no índice, depois `Grep` pelo texto
que a cliente viu na tela (ele sai de um arquivo de copy — é o caminho mais
curto até o código). Achou atalho novo útil? Acrescente uma linha aqui.
