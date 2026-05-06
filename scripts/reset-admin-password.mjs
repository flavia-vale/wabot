import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.error('Uso: node scripts/reset-admin-password.mjs <email> <nova-senha>')
  process.exit(1)
}

if (newPassword.length < 8) {
  console.error('Erro: a senha deve ter no mínimo 8 caracteres.')
  process.exit(1)
}

const user = await prisma.user.findUnique({ where: { email } })

if (!user) {
  console.error(`Erro: nenhum usuário encontrado com o email "${email}".`)
  await prisma.$disconnect()
  process.exit(1)
}

const passwordHash = await bcrypt.hash(newPassword, 10)
await prisma.user.update({ where: { email }, data: { passwordHash } })

console.log(`Senha do usuário "${email}" atualizada com sucesso.`)
await prisma.$disconnect()
