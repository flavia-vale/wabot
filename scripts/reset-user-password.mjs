import 'dotenv/config'
import bcrypt from 'bcryptjs'
import db from '../src/db.js'

function readArg(name) {
  const prefix = `--${name}=`
  const inline = process.argv.find(arg => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(`--${name}`)
  if (index !== -1) return process.argv[index + 1]

  return null
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

const email = (readArg('email') || process.env.RESET_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = readArg('password') || process.env.RESET_PASSWORD || process.env.ADMIN_PASSWORD || ''

try {
  if (!email || !password) {
    fail('Uso: RESET_EMAIL="admin@example.com" RESET_PASSWORD="nova-senha" node scripts/reset-user-password.mjs')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('RESET_EMAIL precisa ser um e-mail válido.')
  } else if (password.length < 8) {
    fail('RESET_PASSWORD precisa ter no mínimo 8 caracteres.')
  } else {
    const passwordHash = await bcrypt.hash(password, 10)
    const updated = await db.user.update({
      where: { email },
      data: { passwordHash, status: 'active', lastActivityAt: new Date() },
      select: {
        id: true,
        email: true,
        status: true,
        adminUser: { select: { id: true, role: true, status: true } },
      },
    })

    console.log(JSON.stringify({
      ok: true,
      userId: updated.id,
      email: updated.email,
      status: updated.status,
      adminRole: updated.adminUser?.role ?? 'bootstrap',
      adminStatus: updated.adminUser?.status ?? 'bootstrap',
    }))
  }
} catch (err) {
  if (err?.code === 'P2025') {
    fail(`Usuário não encontrado para o e-mail ${email}. Crie a conta no Wabot antes de resetar a senha.`)
  } else {
    fail(err?.message || 'Falha ao resetar senha.')
  }
} finally {
  await db.$disconnect()
}
