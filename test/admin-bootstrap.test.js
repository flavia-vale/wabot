import test from 'node:test'
import assert from 'node:assert/strict'
import { isAdminEmailBootstrapEnabled, isCanonicalOwnerAdminEmail, resolveAdminAccess } from '../src/api/routes/admin.js'

test('admin email bootstrap defaults to disabled when env is missing', () => {
  const previous = process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  try {
    assert.equal(isAdminEmailBootstrapEnabled(), false)
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


test('canonical owner emails are recognized without env bootstrap', () => {
  assert.equal(isCanonicalOwnerAdminEmail('flavia.vale@usp.br'), true)
  assert.equal(isCanonicalOwnerAdminEmail(' FLAVIAROBERTA.1496@GMAIL.COM '), true)
  assert.equal(isCanonicalOwnerAdminEmail('tacianeaas02@gmail.com'), true)
  assert.equal(isCanonicalOwnerAdminEmail('cliente@example.com'), false)
})

test('canonical owner email receives owner access even without AdminUser row or env flag', () => {
  const previous = process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  try {
    assert.deepEqual(
      resolveAdminAccess({ id: 'u1', email: 'flavia.vale@usp.br', status: 'active', adminUser: null }),
      { role: 'owner', adminUserId: null, bootstrap: true }
    )
  } finally {
    if (previous === undefined) delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
    else process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = previous
  }
})

test('canonical owner email bypasses inactive AdminUser record as break-glass recovery', () => {
  const access = resolveAdminAccess({
    id: 'u1',
    email: 'tacianeaas02@gmail.com',
    status: 'active',
    adminUser: { id: 'admin1', role: 'support', status: 'inactive' },
  })
  assert.deepEqual(access, { role: 'owner', adminUserId: 'admin1', bootstrap: true })
})

test('regular inactive AdminUser remains denied when env bootstrap is off', () => {
  const previous = process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
  try {
    const access = resolveAdminAccess({
      id: 'u1',
      email: 'cliente@example.com',
      status: 'active',
      adminUser: { id: 'admin1', role: 'support', status: 'inactive' },
    })
    assert.deepEqual(access, { role: null, adminUserId: 'admin1', bootstrap: false })
  } finally {
    if (previous === undefined) delete process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP
    else process.env.ALLOW_ADMIN_EMAIL_BOOTSTRAP = previous
  }
})
