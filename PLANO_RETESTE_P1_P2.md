# Plano de reteste — Prioridades P1 e P2

Escopo: executar reteste funcional das issues abertas de maior impacto (P1/P2), com evidência objetiva para atualizar o backlog.

## Pré-requisitos

- API e dashboard rodando localmente.
- Banco configurado e com dados de teste.
- Sessão WhatsApp de QA disponível para fluxo de conexão e grupos.
- Usuário de teste autenticado (token válido).

---

## P1 — Execução imediata

## 1) BUG-020 — `/dashboard/logs` retorna 404 em produção

**Objetivo:** confirmar que a rota carrega corretamente (sem 404).

**Passos:**
1. Subir aplicação em ambiente o mais próximo possível de produção.
2. Acessar `/dashboard/logs` autenticado.
3. Validar carregamento da página e requisição da API de logs.

**Evidência esperada:**
- HTTP 200 na página `/dashboard/logs`.
- API `/api/logs` respondendo com dados (ou lista vazia válida).
- Screenshot da tela de logs carregada.

**Status de saída:**
- `validated-done` se página e API carregarem sem 404.
- `validated-open` se ocorrer 404/erro de rota.

---

## 2) FEAT-002 — Conexão WhatsApp (desconectado + pareamento por número)

**Objetivo:** validar disponibilidade dos dois métodos de conexão no estado desconectado.

**Passos:**
1. Garantir bot desconectado.
2. Abrir aba WhatsApp no dashboard.
3. Verificar se aparecem opções de conexão esperadas.
4. Testar fluxo de pareamento por número.

**Evidência esperada:**
- UI mostra claramente opções de conexão no estado desconectado.
- Fluxo de pareamento finaliza sem erro crítico.

**Status de saída:**
- `validated-done` se ambos os fluxos estiverem acessíveis e funcionais.
- `validated-open` se UI não oferecer os métodos esperados.

---

## 3) FEAT-005 — Grupos alvo por grupo monitorado

**Objetivo:** validar segmentação de destino por grupo monitor.

**Passos:**
1. Criar 2 grupos monitor e 2 grupos de post.
2. Configurar alvo específico por monitor (A->Post1, B->Post2).
3. Enviar mensagem com link no Monitor A.
4. Enviar mensagem com link no Monitor B.

**Evidência esperada:**
- Mensagem originada no A só dispara no Post1.
- Mensagem originada no B só dispara no Post2.
- Sem broadcast indevido para todos os grupos de post.

**Status de saída:**
- `validated-done` se a segmentação funcionar como configurada.
- `validated-open` se ainda disparar para todos.

---

## 4) BUG-XXX — Placeholder

**Objetivo:** transformar placeholder em issue testável.

**Passos:**
1. Identificar bug real associado ao placeholder.
2. Documentar reprodução mínima.
3. Definir impacto e critério de aceite.

**Evidência esperada:**
- Issue reescrita com título, contexto, passos, esperado x obtido.

**Status de saída:**
- `triaged` quando a issue deixar de ser placeholder.

---

## P2 — Alto impacto UX/adoção

## 5) UX-008 — Card “Carregar grupos existentes” primeiro

**Passos:** abrir `dashboard/grupos` e validar ordem visual dos cards.

**Evidência esperada:**
1. Carregar grupos existentes
2. Monitorar
3. Postar
4. (Sem card manual, conforme UX-009)

---

## 6) UX-009 — Ocultar “Adicionar manualmente”

**Passos:** abrir `dashboard/grupos` e validar ausência do card manual.

**Evidência esperada:** card/formulário manual não aparece para usuário final.

---

## 7) FEAT-004 — Conversor AliExpress

**Passos:**
1. Cadastrar credenciais necessárias da plataforma.
2. Enviar mensagem com link AliExpress em grupo monitorado.
3. Validar conversão e disparo.

**Evidência esperada:** link convertido corretamente e enviado ao destino.

---

## 8) FEAT-006 — Filtros por grupo monitorado

**Passos:**
1. Definir filtro A para Monitor A, filtro B para Monitor B.
2. Enviar mensagens que só passam no filtro de cada monitor.
3. Validar aplicação independente por monitor.

**Evidência esperada:** cada monitor aplica apenas seu próprio filtro.

---

## 9) FEAT-010 — Instruções inline em credenciais

**Passos:** abrir telas de credenciais e validar textos de ajuda contextual.

**Evidência esperada:** instruções claras na própria tela, reduzindo erro de configuração.

---

## Template de evidência (usar por issue)

- **Issue:**
- **Ambiente/Data:**
- **Build/Commit testado:**
- **Pré-condições:**
- **Passos executados:**
- **Resultado obtido:**
- **Resultado esperado:**
- **Status final:** `validated-done` | `validated-open` | `triaged`
- **Anexos:** screenshot/log/request-response

## Critério de fechamento desta rodada

- Executar 100% das 9 issues de P1/P2.
- Publicar relatório final com status por issue e evidências anexas.
- Atualizar `BACKLOG.md` com status validados.
