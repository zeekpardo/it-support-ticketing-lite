import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function makeAdmin(email) {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' }
  });
  
  console.log(`✅ User ${user.email} is now an admin!`);
  await prisma.$disconnect();
}

makeAdmin('hello@noba.cc').catch(console.error);
