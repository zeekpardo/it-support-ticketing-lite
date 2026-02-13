import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function makeAdmin(email) {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' }
  });
  
  console.log(`✅ User ${user.email} is now an admin!`);
  await prisma.$disconnect();
}

makeAdmin('hello@noba.cc').catch(console.error);
