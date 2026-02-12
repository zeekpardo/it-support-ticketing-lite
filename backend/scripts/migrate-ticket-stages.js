import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default stages that will be created for each project
const DEFAULT_STAGES = [
  { name: 'New Requests', slug: 'new_request', color: 'purple', position: 0, isDefault: true, isResolved: false },
  { name: 'In Progress', slug: 'in_progress', color: 'blue', position: 1, isDefault: false, isResolved: false },
  { name: 'Waiting for Info', slug: 'waiting_for_info', color: 'amber', position: 2, isDefault: false, isResolved: false },
  { name: 'Review', slug: 'review', color: 'cyan', position: 3, isDefault: false, isResolved: false },
  { name: 'Resolved', slug: 'resolved', color: 'green', position: 4, isDefault: false, isResolved: true }
];

// Map old enum status values to new stage slugs
const STATUS_TO_SLUG = {
  'NEW_REQUEST': 'new_request',
  'IN_PROGRESS': 'in_progress',
  'WAITING_FOR_INFO': 'waiting_for_info',
  'REVIEW': 'review',
  'RESOLVED': 'resolved'
};

async function migrateTicketStages() {
  console.log('Starting ticket stages migration...\n');

  // 1. Get all projects
  const projects = await prisma.project.findMany({
    include: {
      stages: true
    }
  });
  console.log(`Found ${projects.length} projects\n`);

  // 2. Create default stages for projects that don't have any
  for (const project of projects) {
    if (project.stages.length === 0) {
      console.log(`Creating default stages for project: ${project.name} (${project.id})`);

      await prisma.ticketStage.createMany({
        data: DEFAULT_STAGES.map(stage => ({
          ...stage,
          projectId: project.id
        }))
      });

      console.log(`  Created ${DEFAULT_STAGES.length} stages`);
    } else {
      console.log(`Project "${project.name}" already has ${project.stages.length} stages, skipping`);
    }
  }

  // 3. Get all tickets without a stageId
  const ticketsWithoutStage = await prisma.supportTicket.findMany({
    where: { stageId: null },
    select: {
      id: true,
      status: true,
      projectId: true
    }
  });
  console.log(`\nFound ${ticketsWithoutStage.length} tickets without a stage\n`);

  // 4. Update each ticket with the appropriate stageId
  let updated = 0;
  let errors = 0;

  for (const ticket of ticketsWithoutStage) {
    const targetSlug = STATUS_TO_SLUG[ticket.status];

    if (!targetSlug) {
      console.error(`Unknown status "${ticket.status}" for ticket ${ticket.id}`);
      errors++;
      continue;
    }

    // Find the matching stage for this project
    const stage = await prisma.ticketStage.findFirst({
      where: {
        projectId: ticket.projectId,
        slug: targetSlug
      }
    });

    if (!stage) {
      console.error(`Could not find stage with slug "${targetSlug}" for project ${ticket.projectId}`);
      errors++;
      continue;
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { stageId: stage.id }
    });

    updated++;
  }

  console.log(`\nMigration complete!`);
  console.log(`  Updated: ${updated} tickets`);
  console.log(`  Errors: ${errors}`);
}

migrateTicketStages()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
