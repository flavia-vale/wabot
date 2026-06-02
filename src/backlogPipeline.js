import { promises as fs } from 'node:fs'
import path from 'node:path'

export const ISSUE_TYPES = ['Bug', 'Feature', 'Refactor', 'Security', 'Chore']
export const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
export const ISSUE_STATUSES = ['Backlog', 'Ready', 'In Progress', 'Review', 'QA', 'Done']
export const ISSUE_EPICS = ['WhatsApp', 'Faturamento', 'UX', 'Infra']

const ISSUE_BLOCK_RE = /<!--\s*START_ISSUE:\s*([A-Z0-9-]+)\s*-->([\s\S]*?)<!--\s*END_ISSUE:\s*\1\s*-->/g
const ISSUE_ID_RE = /^[A-Z0-9][A-Z0-9-]{1,48}$/

export function getBacklogPath(baseDir = process.cwd()) {
  return path.join(baseDir, '.backlog', 'backlog.md')
}

function stripInlineComment(value = '') {
  return String(value).replace(/\s+#.*$/, '').trim()
}

function extractField(block, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(new RegExp(`^-\\s+\\*\\*${escapedLabel}:\\*\\*\\s*(.+)$`, 'm'))
  return stripInlineComment(match?.[1] ?? '')
}

function extractTitle(block) {
  const match = block.match(/^###\s+(.*)$/m)
  return String(match?.[1] ?? '').trim()
}

function extractSection(block, title) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(new RegExp(`^####\\s+${escapedTitle}\\s*\\n([\\s\\S]*?)(?=^####\\s+|(?![\\s\\S]))`, 'm'))
  return String(match?.[1] ?? '').trim()
}

function extractAcceptanceCriteria(block) {
  const section = extractSection(block, 'Critérios de Aceite')
  if (!section) return []
  return section
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^-\s+\[([ xX])\]\s+(.*)$/)
      if (!match) return { done: false, text: line.replace(/^-\s*/, '') }
      return { done: match[1].toLowerCase() === 'x', text: match[2].trim() }
    })
}

function normalizeIssueStatus(status) {
  const normalized = ISSUE_STATUSES.find(item => item.toLowerCase() === String(status).trim().toLowerCase())
  return normalized || 'Backlog'
}

function normalizeIssueType(type) {
  return ISSUE_TYPES.find(item => item.toLowerCase() === String(type).trim().toLowerCase()) || 'Chore'
}

function normalizePriority(priority) {
  return ISSUE_PRIORITIES.find(item => item.toLowerCase() === String(priority).trim().toLowerCase()) || 'Medium'
}

export function parseBacklogMarkdown(markdown = '') {
  const issues = []
  const text = String(markdown ?? '')

  for (const match of text.matchAll(ISSUE_BLOCK_RE)) {
    const markerId = String(match[1] ?? '').trim()
    const rawBlock = match[0]
    const body = String(match[2] ?? '')
    const fieldId = extractField(body, 'ID')
    const id = fieldId || markerId

    issues.push({
      id,
      markerId,
      title: extractTitle(body).replace(/^\[[^\]]+\]\s*/, '') || id,
      type: normalizeIssueType(extractField(body, 'Tipo')),
      priority: normalizePriority(extractField(body, 'Prioridade')),
      status: normalizeIssueStatus(extractField(body, 'Status')),
      epic: extractField(body, 'Epic') || 'Infra',
      createdAt: extractField(body, 'Criado em'),
      description: extractSection(body, 'Descrição Técnica'),
      acceptanceCriteria: extractAcceptanceCriteria(body),
      rawBlock,
    })
  }

  return issues
}

export function groupIssuesByStatus(issues = []) {
  return ISSUE_STATUSES.map(status => ({
    status,
    issues: issues.filter(issue => issue.status === status),
  }))
}

export async function readBacklogPipeline({ filePath = getBacklogPath() } = {}) {
  let markdown = ''
  let fileExists = true

  try {
    markdown = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err
    fileExists = false
  }

  const issues = parseBacklogMarkdown(markdown)
  return {
    filePath,
    fileExists,
    statuses: ISSUE_STATUSES,
    issues,
    columns: groupIssuesByStatus(issues),
    total: issues.length,
    updatedAt: new Date().toISOString(),
  }
}

export function updateIssueStatusInMarkdown(markdown, issueId, nextStatus) {
  const id = String(issueId ?? '').trim()
  const status = ISSUE_STATUSES.find(item => item === String(nextStatus ?? '').trim())

  if (!ISSUE_ID_RE.test(id)) {
    const err = new Error('ID de issue inválido.')
    err.code = 'INVALID_ISSUE_ID'
    throw err
  }

  if (!status) {
    const err = new Error('Status inválido para o pipeline.')
    err.code = 'INVALID_ISSUE_STATUS'
    throw err
  }

  const text = String(markdown ?? '')
  const startRe = new RegExp(`<!--\\s*START_ISSUE:\\s*${id}\\s*-->`)
  const startMatch = startRe.exec(text)
  if (!startMatch) {
    const err = new Error('Issue não encontrada no backlog.')
    err.code = 'ISSUE_NOT_FOUND'
    throw err
  }

  const endRe = new RegExp(`<!--\\s*END_ISSUE:\\s*${id}\\s*-->`)
  const endMatch = endRe.exec(text.slice(startMatch.index))
  if (!endMatch) {
    const err = new Error('Bloco da issue está sem delimitador END_ISSUE correspondente.')
    err.code = 'ISSUE_BLOCK_CORRUPTED'
    throw err
  }

  const blockStart = startMatch.index
  const blockEnd = startMatch.index + endMatch.index + endMatch[0].length
  const block = text.slice(blockStart, blockEnd)
  const statusLineRe = /^(\s*-\s+\*\*Status:\*\*\s*)([^\n#]*?)(\s*(?:#.*)?)$/m

  if (!statusLineRe.test(block)) {
    const err = new Error('Linha de Status não encontrada no bloco da issue.')
    err.code = 'STATUS_LINE_NOT_FOUND'
    throw err
  }

  const updatedBlock = block.replace(statusLineRe, (_, prefix, _current, suffix) => `${prefix}${status}${suffix || ''}`)
  return `${text.slice(0, blockStart)}${updatedBlock}${text.slice(blockEnd)}`
}

export async function updateBacklogIssueStatus({ filePath = getBacklogPath(), issueId, status } = {}) {
  const markdown = await fs.readFile(filePath, 'utf8')
  const updatedMarkdown = updateIssueStatusInMarkdown(markdown, issueId, status)
  await fs.writeFile(filePath, updatedMarkdown, 'utf8')
  return readBacklogPipeline({ filePath })
}
