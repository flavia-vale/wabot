// Regrava public/materiais/checklist-operacao-whatsapp.{md,pdf} a partir de
// lib/checklist-operacao.js (fonte única). PDF de uma página, Helvetica com
// WinAnsiEncoding: acentos do português saem certos sem depender de fonte
// embutida. Uso: node scripts/build-checklist-operacao.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CHECKLIST_OPERACAO_BLOCKS,
  CHECKLIST_OPERACAO_INTRO,
  CHECKLIST_OPERACAO_NEXT_STEP,
  CHECKLIST_OPERACAO_TITLE,
} from '../lib/checklist-operacao.js'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destino = path.join(raiz, 'public/materiais')

export function buildMarkdown() {
  const partes = [`# ${CHECKLIST_OPERACAO_TITLE}`, '', CHECKLIST_OPERACAO_INTRO, '']
  for (const [titulo, itens] of CHECKLIST_OPERACAO_BLOCKS) {
    partes.push(`## ${titulo}`, ...itens.map((item) => `- [ ] ${item}`), '')
  }
  partes.push(CHECKLIST_OPERACAO_NEXT_STEP, '')
  return partes.join('\n')
}

// Helvetica 12pt cabe ~80 caracteres na largura útil de uma A4 com margem de 72pt.
function quebrar(texto, largura = 80) {
  if (texto.length <= largura) return [texto]
  const linhas = []
  let atual = ''
  for (const palavra of texto.split(' ')) {
    if (atual && `${atual} ${palavra}`.length > largura) { linhas.push(atual); atual = palavra } else atual = atual ? `${atual} ${palavra}` : palavra
  }
  if (atual) linhas.push(atual)
  return linhas
}

const escapar = (texto) => texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

export function buildPdf() {
  const linhas = [['16', CHECKLIST_OPERACAO_TITLE], ['12', ''], ...quebrar(CHECKLIST_OPERACAO_INTRO).map((t) => ['12', t]), ['12', '']]
  for (const [titulo, itens] of CHECKLIST_OPERACAO_BLOCKS) {
    linhas.push(['13', titulo], ...itens.map((item) => ['12', `[   ] ${item}`]), ['12', ''])
  }
  linhas.push(...quebrar(CHECKLIST_OPERACAO_NEXT_STEP).map((t) => ['12', t]))
  const corpo = ['BT', '72 780 Td', '16 TL']
  for (const [tamanho, texto] of linhas) corpo.push(`/F1 ${tamanho} Tf`, `(${escapar(texto)}) Tj`, 'T*')
  corpo.push('ET')
  const stream = Buffer.from(corpo.join('\n'), 'latin1')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  const partes = [Buffer.from('%PDF-1.4\n', 'latin1')]
  const offsets = []
  let tamanho = partes[0].length
  const adicionar = (buffer) => { partes.push(buffer); tamanho += buffer.length }
  objetos.forEach((conteudo, i) => {
    offsets.push(tamanho)
    adicionar(Buffer.from(`${i + 1} 0 obj\n${conteudo}\nendobj\n`, 'latin1'))
  })
  offsets.push(tamanho)
  adicionar(Buffer.concat([
    Buffer.from(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
    stream,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ]))
  const xref = tamanho
  const tabela = ['xref', `0 ${offsets.length + 1}`, '0000000000 65535 f ', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `)]
  adicionar(Buffer.from(`${tabela.join('\n')}\ntrailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'))
  return Buffer.concat(partes)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(path.join(destino, 'checklist-operacao-whatsapp.md'), buildMarkdown())
  fs.writeFileSync(path.join(destino, 'checklist-operacao-whatsapp.pdf'), buildPdf())
  console.log('ok: checklist-operacao-whatsapp.md e .pdf regravados')
}
