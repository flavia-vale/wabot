# Segunda verificação de UX/UI — 2026-05-06

## Contexto

Esta verificação revisa o código atual do dashboard após a informação de que outro agente teria corrigido as issues de UX/UI previamente documentadas. A análise cobre as telas e componentes auditados em `docs/design-audit/` e valida sinais objetivos no código-fonte.

## Resultado executivo

**Conclusão:** as correções de UX/UI solicitadas nas issues ainda **não aparecem implementadas no código-fonte atual deste branch**. O branch atual contém os arquivos de documentação das issues, mas os componentes e telas seguem majoritariamente com a implementação anterior.

Evidências principais:

- `Alert` ainda usa `role="alert"` e `aria-live="polite"` fixos para todos os tipos.
- `ConfirmDialog` ainda não define `role="dialog"`, `aria-modal`, labels por id ou gestão de foco.
- `DashboardLayout` ainda declara `menuOpen` e `handleNavigate`, mas não renderiza menu mobile/drawer.
- `Envio` ainda usa `confirm()` nativo e `localStorage` para suprimir confirmação de broadcast.
- `Credenciais` ainda renderiza campos sensíveis como inputs de texto comuns e não sincroniza `initialData` depois do carregamento.
- `Grupos` ainda não possui loading inicial para grupos cadastrados nem loading por item ao adicionar grupo.

## Status por tela/componente

| Área | Status de implementação das issues | Evidência resumida |
|---|---|---|
| Login / Cadastro | Não implementado | Ainda há card escuro no cadastro com labels fixos em cinza, sem `autoComplete` e sem mostrar/ocultar senha. |
| Layout / Navegação | Não implementado | `menuOpen` existe, mas não há drawer/mobile nav; sem `aria-current`. |
| Início / Status do Bot | Não implementado | Retry não limpa erro/loading; cards continuam como `button` com `router.push`; sem progresso ou próximo passo. |
| Conexão WhatsApp | Não implementado | Erros de status seguem silenciosos; feedback segue como parágrafos; sem loading inicial de status. |
| Credenciais | Não implementado | Campos sensíveis sem máscara; `PlatformCard` inicializa `values` com `initialData`, mas não sincroniza mudanças. |
| Grupos | Não implementado | Sem `loadingGroups`; erros como parágrafos; sem loading por item; formulário manual sem labels visíveis. |
| Configurações do Bot | Não implementado | Permite plataformas vazias; feedback de salvar como parágrafo; loading genérico. |
| Envio de Mensagens | Parcial mínimo | Usa `Alert` em alguns erros, mas broadcast ainda usa `confirm()` nativo e confirmação suprimível por `localStorage`. |
| Logs | Não implementado | Busca sem label visível/ARIA; erro por `title`; busca local conflita com paginação. |
| Planos | Não implementado | Erros de checkout/cópia seguem como parágrafos; link de indicação em layout horizontal fixo. |
| Componentes compartilhados | Não implementado | `Alert`, `ConfirmDialog`, `LoadingState` e `EmptyState` seguem APIs antigas. |

## Novos itens de melhoria identificados nesta segunda verificação

1. **Risco de falsa sensação de conclusão:** como os arquivos de issues foram adicionados, mas o código não mudou, é fácil confundir documentação com implementação. Recomenda-se criar um checklist de rastreabilidade `issue -> PR de implementação -> status`.
2. **Ausência de testes de interação:** o projeto não possui scripts de teste automatizado além de `lint` e `build`. Recomenda-se adicionar testes de componentes/fluxos críticos com Playwright ou Testing Library.
3. **Falta de PRs pequenos por domínio:** as correções devem ser divididas por área (`componentes`, `login`, `layout`, `envio`, etc.) para reduzir risco de regressão.
4. **Prioridade recomendada:** implementar primeiro componentes compartilhados (`Alert`, `ConfirmDialog`, `LoadingState`) porque desbloqueiam melhorias consistentes em várias telas.

## Cenários testados nesta verificação

- Validação estática do dashboard com ESLint.
- Build de produção do dashboard com Next.js.
- Varredura textual de sinais de implementação, incluindo `aria-current`, `role="dialog"`, `aria-modal`, `role="status"`, `inputMode`, `autoComplete`, `confirm(`, `broadcastConfirmShown`, `sensitive`, `initialData`, `loadingGroups`, `addingKey`, `statusLoading`, `statusError`, `aria-pressed` e componentes locais esperados.

## Recomendação de entrega ao cliente

**Não considero esta a melhor versão para entregar ao cliente como “correções aplicadas”.** Ela compila e passa lint, mas as melhorias de UX/UI e acessibilidade documentadas ainda estão pendentes no código atual. A versão é aceitável como entrega de documentação/backlog de auditoria, não como entrega de produto corrigido.

Para entregar ao cliente como melhoria real de produto, recomenda-se:

1. Implementar primeiro as issues P0/P1 dos componentes compartilhados.
2. Implementar P0/P1 de Login, Layout, Início, Conexão WhatsApp, Credenciais, Grupos e Configurações.
3. Rodar validação manual dos fluxos críticos em mobile e desktop.
4. Adicionar pelo menos testes E2E básicos para login, navegação, conexão WhatsApp mockada, credenciais, grupos e envio.
