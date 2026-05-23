# Mobile Frontend Governance (Fase 7+)

## 7) Boas práticas técnicas obrigatórias

### SSR / hidratação
- Não renderizar `new Date()` diretamente no SSR.
- Informações de "agora" devem vir de:
  - efeito client-side controlado (`useEffect`), ou
  - timestamp do servidor.

### Semântica e A11y
- Não usar `div` clicável: usar `button` ou `a`.
- Bottom nav deve usar `aria-current="page"` na tab ativa.
- Drawer deve suportar:
  - focus trap,
  - fechar com `ESC`,
  - fechar por clique no overlay.

### Performance
- Virtualizar listas longas de logs/envios quando necessário.
- Evitar múltiplos blurs pesados ao mesmo tempo em dispositivos low-end.
- Home deve consumir dados de forma agregada (uma fonte de dados por tela sempre que possível).

### Observabilidade
- Medir latência de montagem das rotas mobile.
- Registrar ações críticas: `retry`, `cancel`, `send`.

---

## 8) Estratégia de testes (staging 3006)

### Smoke
- Navegação entre todas as rotas mobile.
- Drawer abre/fecha com toque no botão, `ESC` e overlay.
- Bottom nav destaca estado ativo.

### Funcional
- Conversor: input → output visual.
- Oferta: template + placeholders + envio visual.
- Envios: fila/enviados/falhas + ações.
- Logs: expand/collapse + filtros.

### Regressão
- Web continua intacta.
- Sem mismatch de hidratação.
- Sem conflitos de scroll/gesture.

### Dispositivos
- iOS Safari.
- Android Chrome.
- Viewport narrow e medium.

---

## 9) Critérios de aceite por etapa

Cada PR só entra quando:
1. build ok,
2. sem erro crítico de console,
3. smoke da etapa aprovado no `3006`,
4. sem regressão web evidente,
5. rollback simples (feature flag/isolamento de rota).

---

## 10) Fluxo Git/Deploy

1. branch `codex/<feature>` saindo de `develop`;
2. PR para `develop`;
3. validar em staging `3006`;
4. só depois PR `develop -> main` para produção.
