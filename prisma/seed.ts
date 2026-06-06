import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('Fai$9kD2', 10)

  const user1 = await prisma.user.upsert({
    where: { username: 'faissal' },
    update: {},
    create: { username: 'faissal', name: 'Faïssal', password },
  })

  const password2 = await bcrypt.hash('Nou@7xL3', 10)

  const user2 = await prisma.user.upsert({
    where: { username: 'nouria' },
    update: {},
    create: { username: 'nouria', name: 'Nouria', password: password2 },
  })

  console.log('Seeded users:', user1.username, user2.username)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
