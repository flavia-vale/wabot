# Divisão Basic/PRO do painel (2026-09-23)

Decisão da dona do produto, a partir do protótipo `Painel_Prototipo_standalone`
("Ver como Basic/PRO"). O protótipo foi usado **como referência de layout**; os
campos que ele mostra e o produto não tem (foto do perfil, fuso horário,
`{chamada}`/`{fechamento}`/`{frete}`/`{cupom}`, cliques totais da Shopee) ficaram
de fora de propósito.

## O que cada plano tem

| Basic | PRO (tudo do Basic +) |
|---|---|
| Espelhamento de grupos | Espelhamento de **canais** |
| Conversão de links das 6 lojas | Garimpo automático (ofertas automáticas, só Shopee) |
| Card de oferta clicável | Filas de ofertas |
| Mensagem reescrita do seu jeito | **Marca d'água** |
| Envio imediato ou agendado | Horário de descanso, máximo por dia, intervalo e **variação do texto** |
| Relatórios | **Painel de vendas e comissão da Shopee** |
| | Botão **"Ver canal"** |

Em negrito: o que **saiu do Basic** nesta mudança. Teste grátis ativo = PRO.
Premium herda tudo do PRO (e segue sendo o único com Instagram).

As listas moram em `DEFAULT_LANDING_PLANS` (`dashboard/lib/marketing-content.js`)
e o painel lê de `dashboard/lib/planFeatures.js`, que deriva delas — página de
preços, `/api/public/plans` (migration `20260923120000_sync_public_faq_plans_basic_pro`),
`pricing.md`, `llms.txt` e painel dizem a MESMA coisa.

## Onde a trava mora (backend é a autoridade)

| Recurso | Regra | Rota | Robô |
|---|---|---|---|
| Marca d'água | `canUseWatermark` | `PUT /groups/:id` → 403 ao ligar | `toPostDetail` tira a marca (`destinationImageModeWithoutWatermark`) |
| Botão "Ver canal" | `canUseChannelButton` | `PUT /groups/:id` → 403 ao ligar; salvar outra coisa limpa o botão | `toPostDetail` devolve `channelButtonJid: null` |
| Variação do texto | `canUseCopyVariation` | `PUT /config` → 403 ao ligar | já era só canal + preservação (PRO) |
| Vendas Shopee | `canUseShopeeSales` | `GET /shopee-sales` → 403 **antes** de chamar a Shopee | — |

Todas em `src/billing/plans.js`. `GET /groups` devolve o destino como o robô o
usa (`presentGroupsForPlan`): a tela nunca mostra marca/botão que não sai.

**Não regredir:**

- **Sem o PRO, card com marca vira card e foto com marca vira foto** — o
  formato não muda, só a marca sai. O texto da marca fica guardado: voltar ao
  PRO não pede para configurar de novo.
- A trava do robô é no chokepoint (`billing/groupEntitlements.js`), então vale
  para trial que venceu e para conta que desceu de plano — sem depender do script.
- Desligar e remover seguem liberados no Basic; só LIGAR exige o plano.
- `scripts/basic-sem-recursos-pro.mjs` grava a mudança no banco para as contas
  sem o PRO (read-only por padrão; `--aplicar` grava; backup antes em produção).
  A regra é importada de `src/billing/basicDowngrade.js`, nunca reescrita.

## Telas

| Peça | Onde |
|---|---|
| Etiqueta, cadeado, janela "Ver planos", página travada com prévia | `dashboard/components/pro/ProGate.js` |
| Prévias de exemplo (nunca dado real) | `dashboard/components/pro/previews.js` |
| Menu: Divulgar → Automatizar → Configurar → Preservação → Conta | `dashboard/app/painel/nav.js` |
| Ritmo dos envios na tela WhatsApp | `dashboard/components/pro/RhythmCard.js` |
| Minha conta | `dashboard/app/painel/conta/page.js` (+ `PATCH /api/auth/me/name`) |

- **Cores:** o PRO é verde + roxo (`--pro #6F4FE8`, `--pro-gradient` em
  `painel.css`). A fonte NÃO muda.
- **Marca:** "Espelha Grupos" no painel e na propaganda do Basic (`AD_TEXT`).
- **Item PRO no menu nunca some** — aparece com cadeado e abre a tela
  explicando o recurso.
- **Ritmo na tela WhatsApp = preset PADRÃO da Preservação** (`isDefault`). Não
  é teto novo: vale para quem usa o padrão; destino com ajuste próprio segue o
  dele. Sem preset padrão, o primeiro salvamento cria "Padrão".
- **Painel inicial:** 5º card "Comissão Shopee hoje". No Basic, embaçado e com
  cadeado, **sem chamada à API**. No PRO, 5 min de memória na aba (o serviço de
  vendas não tem cache e cada leitura vai à Shopee).
- **Vendas:** a API agora devolve `daily` (comissão por dia) e `topProducts`
  calculados sobre o período INTEIRO — calcular na tela a partir de uma página
  de pedidos daria número errado. Dia com comissão faltando vira `null`.
- **Minha conta:** o celular de cadastro é só leitura — ele é a trava contra
  teste grátis repetido.
- Mensagens no Basic salvam com `copyVariationEnabled: false` — senão a API
  recusaria (403) e o modelo não seria salvo.

⚠️ **Deploy reinicia o `bot-supervisor`** (`src/billing/` e `src/bot-worker.js`
estão em `WORKER_CODE_PATHS_RE`) e isso **reconecta todas as sessões WhatsApp**.
Anunciar antes. Sem esse reinício, os bots seguem com marca/botão para o Basic.

Testes: `test/plano-basic-pro-divisao.test.js`, `test/painel-basic-pro-telas.test.js`,
`test/minha-conta.test.js`, `test/groups-route-image-mode.test.js`,
`test/group-entitlements.test.js`, `test/shopee-sales-*.test.js`,
`test/painel-sidebar-nav.test.js`.
