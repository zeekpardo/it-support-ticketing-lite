import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'hello@noba.cc';

async function main() {
  console.log('Seeding database...');

  // Find or update admin user
  const adminUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL }
  });

  if (adminUser) {
    // Update existing user to admin
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: 'admin' }
    });
    console.log(`Updated ${ADMIN_EMAIL} to admin role`);
  } else {
    console.log(`User ${ADMIN_EMAIL} not found. They will be set as admin when they sign up.`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
