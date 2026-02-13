import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteTestUsers() {
  console.log('Deleting all users and related data...');
  
  // Delete in correct order due to foreign key constraints
  await prisma.timeEntry.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.member.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('✅ All users and related data deleted!');
  await prisma.$disconnect();
}

deleteTestUsers().catch(console.error);
