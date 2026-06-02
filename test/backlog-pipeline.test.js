import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBacklogMarkdown, groupIssuesByStatus, updateIssueStatusInMarkdown } from '../src/backlogPipeline.js'

const sampleBacklog = `# Backlog

<!-- START_ISSUE: WABOT-001 -->
### [BUG] Falha no callback do Pix do Mercado Pago
- **ID:** WABOT-001
- **Tipo:** Bug                  # [Bug | Feature | Refactor | Security | Chore]
- **Prioridade:** High            # [Low | Medium | High | Critical]
- **Status:** Backlog             # [Backlog | Ready | In Progress | Review | QA | Done]
- **Epic:** Faturamento           # [WhatsApp | Faturamento | UX | Infra]
- **Criado em:** 2026-06-02

#### Descrição Técnica
O webhook do Mercado Pago retorna erro de validação quando o payload não possui o campo do endereço IP do cliente codificado em HTTPS.

#### Critérios de Aceite
- [ ] Criar a rota de contingência /pagamento-direto.
- [x] Adicionar tratamento de erro para ignorar validação de IP em ambiente local.
<!-- END_ISSUE: WABOT-001 -->

---

<!-- START_ISSUE: WABOT-002 -->
### [SECURITY] Blindar delays antiban
- **ID:** WABOT-002
- **Tipo:** Security
- **Prioridade:** Critical
- **Status:** QA
- **Epic:** WhatsApp
- **Criado em:** 2026-06-02

#### Descrição Técnica
Validar jitter e limites para envio em massa.

#### Critérios de Aceite
- [ ] Simular fila cheia.
<!-- END_ISSUE: WABOT-002 -->

---
`

test('parseBacklogMarkdown converts issue blocks into structured JSON', () => {
  const issues = parseBacklogMarkdown(sampleBacklog)

  assert.equal(issues.length, 2)
  assert.deepEqual(issues[0], {
    id: 'WABOT-001',
    markerId: 'WABOT-001',
    title: 'Falha no callback do Pix do Mercado Pago',
    type: 'Bug',
    priority: 'High',
    status: 'Backlog',
    epic: 'Faturamento',
    createdAt: '2026-06-02',
    description: 'O webhook do Mercado Pago retorna erro de validação quando o payload não possui o campo do endereço IP do cliente codificado em HTTPS.',
    acceptanceCriteria: [
      { done: false, text: 'Criar a rota de contingência /pagamento-direto.' },
      { done: true, text: 'Adicionar tratamento de erro para ignorar validação de IP em ambiente local.' },
    ],
    rawBlock: issues[0].rawBlock,
  })
  assert.equal(issues[1].type, 'Security')
  assert.equal(issues[1].priority, 'Critical')
})

test('groupIssuesByStatus creates the six canonical kanban columns', () => {
  const columns = groupIssuesByStatus(parseBacklogMarkdown(sampleBacklog))

  assert.deepEqual(columns.map(column => column.status), ['Backlog', 'Ready', 'In Progress', 'Review', 'QA', 'Done'])
  assert.equal(columns.find(column => column.status === 'Backlog').issues[0].id, 'WABOT-001')
  assert.equal(columns.find(column => column.status === 'QA').issues[0].id, 'WABOT-002')
})

test('updateIssueStatusInMarkdown only rewrites the selected status line', () => {
  const updated = updateIssueStatusInMarkdown(sampleBacklog, 'WABOT-001', 'Review')

  assert.match(updated, /- \*\*Status:\*\* Review\s+# \[Backlog \| Ready \| In Progress \| Review \| QA \| Done\]/)
  assert.match(updated, /<!-- START_ISSUE: WABOT-002 -->[\s\S]*- \*\*Status:\*\* QA[\s\S]*<!-- END_ISSUE: WABOT-002 -->/)
  assert.equal(parseBacklogMarkdown(updated).find(issue => issue.id === 'WABOT-001').status, 'Review')
})

test('updateIssueStatusInMarkdown rejects unknown statuses and IDs', () => {
  assert.throws(() => updateIssueStatusInMarkdown(sampleBacklog, 'WABOT-001', 'Blocked'), /Status inválido/)
  assert.throws(() => updateIssueStatusInMarkdown(sampleBacklog, 'WABOT-999', 'Done'), /Issue não encontrada/)
})
