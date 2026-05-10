import test from 'node:test'
import assert from 'node:assert/strict'
import { isAdminEmailBootstrapEnabled } from '../src/api/routes/admin.js'

test('admin email bootstrap defaults to enabled when env is missing', () => {
  const previous = process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  try {
    assert.equal(isAdminEmailBootstrapEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
    else process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = previous
  }
})

test('admin email bootstrap accepts true-like values', () => {
  const previous = process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = 'true'
  try {
    assert.equal(isAdminEmailBootstrapEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
    else process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = previous
  }
})

test('admin email bootstrap disables for explicit false-like values', () => {
  const previous = process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = 'false'
  try {
    assert.equal(isAdminEmailBootstrapEnabled(), false)
  } finally {
    if (previous === undefined) delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
    else process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = previous
  }
})
