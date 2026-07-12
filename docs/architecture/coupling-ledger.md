# Livro-razão de acoplamento (coupling ledger)

Este documento existe para registrar, de forma explícita e datada, todo
acoplamento entre camadas que **quebra as fronteiras de arquitetura** definidas
em `AGENTS.md` e verificadas pela barreira de import (`npm run arch:check`,
`.dependency-cruiser.cjs`) — mas que foi conscientemente **allowlisted** por
não ser viável de corrigir no momento em que apareceu.

O objetivo não é impedir toda exceção (às vezes uma dívida técnica pontual é a
decisão certa), mas garantir que ela seja **visível, rastreável e com plano de
remoção**, em vez de virar acoplamento invisível que ninguém lembra por quê
existe.

## Quando registrar uma nova entrada

Registre uma entrada aqui **sempre que**:

- Você precisar adicionar uma nova exceção à allowlist de
  `.dependency-cruiser.cjs` (ex.: um novo `pathNot` na regra
  `no-src-to-dashboard`), **antes** de abrir a PR que introduz a exceção.
- Você perceber (durante debug, incidente ou revisão de código) um
  acoplamento escondido entre módulos que deveriam ser independentes, mesmo
  que a barreira automatizada ainda não cubra esse caso.

Cada entrada nova de allowlist **precisa** vir acompanhada de uma entrada
equivalente neste arquivo — a barreira de import por si só não impede
acoplamento novo, apenas o torna visível; este livro-razão é quem preserva o
"porquê" e o "quando remover".

## Template de entrada

Copie o bloco abaixo e preencha todos os campos ao registrar uma nova
entrada. Adicione a entrada mais recente no topo da seção "Entradas"
(ordem cronológica reversa).

```markdown
### <Título curto do acoplamento>

- **Data**: AAAA-MM-DD
- **O que quebrou**: <qual fronteira de arquitetura foi violada — ex.:
  "src/**/*.js importando dashboard/lib/**">
- **Acoplamento causador**: <arquivo(s) de origem> → <arquivo(s) de destino>,
  com uma frase explicando por que o acoplamento existe (motivo técnico ou
  de prazo, não só "foi mais rápido")
- **Como foi mitigado**: <allowlist na barreira? Isolamento parcial?
  Nenhuma mitigação ainda?>
- **Status**: Aberto (dívida de baseline) | Mitigado | Removido
```

Campos obrigatórios: Data, O que quebrou, Acoplamento causador, Como foi
mitigado. Campo recomendado: Status (Aberto/Mitigado/Removido) — permite
varrer o documento e saber rapidamente o que ainda está pendente de remoção.

---

## Entradas

### Reaproveitamento de `dashboard/lib` por `src/` (mensagens de oferta mobile)

- **Data**: 2026-07-12
- **O que quebrou**: `src/**/*.js` (runtime backend) importando
  `dashboard/lib/**` (código do frontend Next.js) — direção proibida pela
  regra `no-src-to-dashboard` de `.dependency-cruiser.cjs`.
- **Acoplamento causador**:
  - `src/offerAutomation/dispatcher.js` → `dashboard/lib/mobileOfferComposer.js`
    e `dashboard/lib/mobileTemplateStore.js`
  - `src/core/mirrorTemplate.js` → `dashboard/lib/mobileOfferComposer.js` e
    `dashboard/lib/mobileTemplateStore.js`

  Motivo: a lógica de composição de texto de oferta mobile
  (`buildMobileOfferText`) e de templates (`composeTemplates`) foi escrita
  originalmente em `dashboard/lib/` para uso pela UI do painel, e o backend
  (`bot-worker`/`offerAutomation`) passou a reaproveitar essas mesmas funções
  em vez de duplicá-las — criando uma dependência de runtime backend em
  direção ao código do frontend, que é o inverso do que a arquitetura
  pretende (frontend consome backend via API, não o contrário).
- **Como foi mitigado**: allowlisted explicitamente em
  `.dependency-cruiser.cjs` (regra `no-src-to-dashboard`, campo `from.pathNot`
  com exatamente estes 2 arquivos) para que a barreira de import continue
  verde sem mascarar violações **novas** — qualquer outro arquivo de `src/`
  que importe `dashboard/lib/**` no futuro ainda falha o `arch:check`.
- **Status**: Aberto (dívida de baseline) — plano é extrair
  `buildMobileOfferText`/`composeTemplates` para um módulo compartilhado fora
  de `dashboard/lib/` (ex.: `src/shared/` ou pacote isolado) na **Etapa 1** do
  saneamento técnico, removendo a necessidade da exceção. Quando isso
  acontecer, remover as 2 entradas de `pathNot` e marcar esta entrada como
  "Removido".
