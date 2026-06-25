import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const ecosystemSource = readFileSync(new URL('../ecosystem.config.cjs', import.meta.url), 'utf8')

test('dashboard PM2 apps iniciam Next diretamente sem wrapper npm', () => {
  assert.match(ecosystemSource, /name: 'dashboard',[\s\S]*?script: '\.\/node_modules\/next\/dist\/bin\/next',[\s\S]*?args: 'start'/)
  assert.match(ecosystemSource, /name: 'visual-staging',[\s\S]*?script: '\.\/node_modules\/next\/dist\/bin\/next',[\s\S]*?args: 'start'/)
  assert.equal(/name: 'dashboard',[\s\S]*?script: 'npm'/.test(ecosystemSource), false)
  assert.equal(/name: 'visual-staging',[\s\S]*?script: 'npm'/.test(ecosystemSource), false)
})
