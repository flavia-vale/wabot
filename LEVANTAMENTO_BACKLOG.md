# Levantamento de backlog — wabot

Este documento foi atualizado para evitar ambiguidade: o arquivo `BACKLOG.md` contém issues em **3 status** (`open`, `in-progress`, `done`).

## Visão geral do BACKLOG.md (todos os status)

- **Total de issues mapeadas:** 43
- **open:** 13
- **in-progress:** 0
- **done:** 30

> Exemplo citado ("senha com 1 caractere") **existe sim no backlog** como:
> **BUG-002 · Sem validação de tamanho mínimo de senha** com **Status: done**.

## Recorte priorizado para planejamento imediato (somente `open`)

### Resumo executivo (abertas)

- **Total de issues abertas:** 13
- **Alta prioridade:** 4
- **Média prioridade:** 5
- **Baixa prioridade:** 4

### Prioridade 1 — Crítica para operação / valor imediato

1. **BUG-020 · Página `/dashboard/logs` retorna 404 em produção**
2. **FEAT-002 · Conexão WhatsApp — estado desconectado e pareamento por número**
3. **FEAT-005 · Grupos alvo por grupo monitorado**
4. **BUG-XXX · Título curto** *(placeholder; precisa triagem)*

### Prioridade 2 — Importante para UX e expansão funcional

1. **UX-008 · Card "Carregar grupos existentes" deve ser o primeiro da página**
2. **UX-009 · Card "Adicionar manualmente" deve ser ocultado**
3. **FEAT-004 · Conversor AliExpress**
4. **FEAT-006 · Filtros por grupo monitorado**
5. **FEAT-010 · Instruções inline nas telas de credenciais**

### Prioridade 3 — Melhorias incrementais

1. **FEAT-007 · Welcome message por grupo de disparo**
2. **FEAT-008 · Toast notifications no dashboard**
3. **FEAT-009 · Modal de confirmação customizado**
4. **FEAT-011 · Feed Global**
5. **FEAT-012 · Postar no Status do WhatsApp**

## Itens relevantes já resolvidos (`done`) para referência

- **BUG-001** · validação de formato de email.
- **BUG-002** · validação de tamanho mínimo de senha (caso citado).
- **BUG-003** · retorno silencioso de `wa-groups` sem conexão.
- **SEC-001** · bypass de HMAC no webhook.

## Recomendações

- Manter este documento com **duas visões**: geral (todos os status) e foco de execução (somente `open`).
- Quando surgir issue conhecida fora do backlog, registrar imediatamente no padrão do próprio `BACKLOG.md`.
- Substituir `BUG-XXX` por issue completa (contexto, reprodução, impacto e critério de aceite).
