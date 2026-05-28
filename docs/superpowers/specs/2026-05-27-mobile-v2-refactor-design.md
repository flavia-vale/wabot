# Mobile v2 — Refatoração do front das rotas `/m/*`

**Data:** 2026-05-27
**Branch:** `claude/epic-bardeen-ipF65`
**Escopo:** Front-end apenas. Não mexer em backend, API, banco, lógica de negócio ou dados.

## Contexto

O projeto Wabot tem uma versão mobile do dashboard sob `/m/*`. A versão atual usa
Tailwind com cores hard-coded e componentes minimalistas. O design v2 (entregue
via ZIP `Conversor_Bothandoff.zip`, pasta `conversor-bot/project/src/mobile-*.jsx`,
sem sufixo `-v1`) introduz:

- Sistema de design tokens via CSS variables
- Chrome (topbar + bottom nav de 5 tabs) reformulado
- Telas redesenhadas com foco em hierarquia visual e "1 ação primária"
- Novas telas: Espelhar, Conta, Modelos

## Mapeamento de Rotas

| Rota                         | Status   | Componente v2       | Observação                                     |
|------------------------------|----------|---------------------|------------------------------------------------|
| `/m`                         | refatora | `MobileHome`        | `mobile-home.jsx`                              |
| `/m/op/converter`            | mantém   | —                   | Sem v2 — não tocar                             |
| `/m/op/offer`                | refatora | `MobileCriar`       | `mobile-criar.jsx`                             |
| `/m/op/sends`                | DELETAR  | —                   | Consolidado em `/m/op/logs`                    |
| `/m/op/logs`                 | refatora | `MobileEnvios`      | `mobile-envios.jsx`                            |
| `/m/op/espelhar`             | NOVA     | `MobileEspelhar`    | `mobile-espelhar.jsx`                          |
| `/m/config/whatsapp`         | refatora | `MobileWhatsApp`    | `mobile-config.jsx`                            |
| `/m/config/groups`           | refatora | `MobileGroups`      | `mobile-config.jsx`                            |
| `/m/config/credentials`      | refatora | `MobileCreds`       | `mobile-config.jsx`                            |
| `/m/config/preferences`      | refatora | `MobilePrefs`       | `mobile-config.jsx`                            |
| `/m/help/tutorial`           | refatora | `MobileTutorial`    | `mobile-config.jsx`                            |
| `/m/account/subscription`    | refatora | `MobileAssinatura`  | `mobile-config.jsx`                            |
| `/m/account`                 | NOVA     | `MobileConta`       | `mobile-conta.jsx`                             |
| `/m/account/templates`       | NOVA     | `MobileModelos`     | `mobile-modelos.jsx`                           |

## Decisões de Design

### 1. CSS variables globais (não Tailwind)

Adicionar tokens em `dashboard/app/globals.css` (ou equivalente do projeto):

```css
:root {
  --bg: #EEF6F2;
  --bg-soft: #DDEDE5;
  --surface: #FCFEFD;
  --ink: #1F2D2A;
  --ink-soft: #5A6E68;
  --ink-faint: #8FA09A;
  --accent: #7CC9A9;
  --accent-strong: #3E9C7A;
  --accent-2: #D9CFEA;
  --accent-3: #F6E8D8;
  --line: rgba(31,45,42,0.10);
  --line-strong: rgba(31,45,42,0.18);
  --danger: #D97757;
  --success: #3E9C7A;
  --warn: #E8A45A;
}
```

Justificativa: replica fielmente o sistema do v2 e preserva o design system.
Páginas v2 usam inline styles com `var(--token)`, então o código fica idêntico.

### 2. Chrome (`MobileShell`)

Refatorar `dashboard/components/mobile/MobileShell.jsx`:

- **Topbar:** brand mark (quadrado com `b` em gradiente accent) + título + sino de notificações com dot vermelho condicional (`hasAlert`). Sem botão "Menu" nem link "Mobile".
- **Bottom nav:** 5 tabs — **Início, Espelhar, Criar (centro, destacado), Envios, Conta**. Tab central elevada (-10px), fundo `--ink`, com sombra.
- **Drawer:** removido (v2 não usa).
- **Conteúdo:** `padding-bottom: 92px` para safe area do nav.

### 3. Bibliotecas compartilhadas

Criar:

- `dashboard/components/mobile/MobileIcons.jsx` — biblioteca de SVGs (`<Icon name="..." size={x} />`). Cobre todos os ícones usados no v2: `check`, `arrow`, `sparkles`, `link`, `send`, etc.
- `dashboard/components/mobile/mobileStyles.js` — primitivos compartilhados: `mobi.btn(kind, full)`, `mobi.card`, `mobi.sectionLabel`, `mobi.pagePad` (extraído de `mobile-chrome.jsx`).

### 4. Conversão JSX (v2 sandbox → Next.js)

| V2 (sandbox global)                      | Next.js (este projeto)                        |
|------------------------------------------|------------------------------------------------|
| `<MobileFrame title active>`             | `<MobileShell title active>`                  |
| `<Icon name="x" size={n} />`             | `<MobileIcon name="x" size={n} />` (importado)|
| `mobi.btn(...)`, `mobi.card`             | Importado de `@/components/mobile/mobileStyles` |
| Constantes globais (`homeStyles`, etc)   | Constantes locais ao arquivo da página         |
| Mocks hard-coded                         | Mantém os mocks do v2 (sem trocar por dados reais — escopo é front) |

### 5. Hooks/observability preservados

- `useMobileRoutePerf('m/...')` — manter em todas as páginas
- `useMobileHomeData()` — manter na home
- `MobileAsyncState`, `VirtualList` — remover de páginas que o v2 não usa (a versão v2 dispensa esses padrões; mocks são síncronos)

## Arquivos afetados

**Criar (5):**
- `dashboard/components/mobile/MobileIcons.jsx`
- `dashboard/components/mobile/mobileStyles.js`
- `dashboard/app/m/op/espelhar/page.js`
- `dashboard/app/m/account/page.js`
- `dashboard/app/m/account/templates/page.js`

**Editar (12):**
- `dashboard/app/globals.css` (ou equivalente) — adicionar CSS vars
- `dashboard/components/mobile/MobileShell.jsx` — chrome v2
- `dashboard/components/mobile/routes.js` — novas rotas; remover `sends`
- `dashboard/app/m/page.js`
- `dashboard/app/m/op/offer/page.js`
- `dashboard/app/m/op/logs/page.js`
- `dashboard/app/m/config/whatsapp/page.js`
- `dashboard/app/m/config/groups/page.js`
- `dashboard/app/m/config/credentials/page.js`
- `dashboard/app/m/config/preferences/page.js`
- `dashboard/app/m/help/tutorial/page.js`
- `dashboard/app/m/account/subscription/page.js`

**Deletar (1):**
- `dashboard/app/m/op/sends/page.js` (+ diretório)

## Ordem de Execução

### Fase 1 — Infra (1 commit)
1. Adicionar CSS vars no `globals.css`
2. Criar `MobileIcons.jsx` e `mobileStyles.js`
3. Refatorar `MobileShell.jsx` (topbar + bottom nav v2)
4. Atualizar `routes.js`

### Fase 2 — Home (1 commit, checkpoint)
5. Refatorar `/m/page.js`
6. **CHECKPOINT:** validação manual da Home antes de seguir

### Fase 3 — Demais páginas (commits por seção)
7. Operações: `offer`, `logs`, `espelhar` (criar), deletar `sends`
8. Config: 4 páginas
9. Conta: criar `account`, `account/templates`, refatorar `account/subscription`
10. Help: `help/tutorial`

## Validação

- **Build:** `cd dashboard && npm run build` deve passar
- **Tipos/lint:** seguir o que o projeto já roda
- **Sem testes novos:** front puro com mocks; testes não fazem parte do escopo
- **Manual:** subir dashboard local e navegar pelas 13 rotas (12 existentes - 1 removida + 3 novas)

## Fora do Escopo

- Backend, API, banco, lógica de negócio
- Dados reais (mocks mantidos)
- `/m/op/converter` (sem v2)
- Testes automatizados novos
- Refatoração de hooks de dados existentes
- Acessibilidade adicional além do que o v2 já entrega

## Riscos

- **Bottom nav muda destinos:** "Envios" passa a apontar para `/m/op/logs` em vez de `/m/op/sends`. Após remoção de `sends`, qualquer link cru externo quebra (mas é uma feature interna, sem links públicos).
- **Drawer removido:** se algum link interno dependia do drawer, precisa ser realocado. Verificar nas próprias páginas v2 onde estão os links de configuração (provavelmente em `MobileConta`).
- **Inline styles:** aumenta tamanho do bundle por página. Aceito por fidelidade ao v2.
