import cron from 'node-cron';
import { prisma } from '../lib/auth.js';
import { notifyMultiple } from './notificationService.js';

const RENEWAL_THRESHOLDS = [
  { days: 30, label: '30_days' },
  { days: 14, label: '14_days' },
  { days: 3, label: '3_days' },
  { days: 1, label: '1_day' },
];

async function checkRenewalNotifications() {
  console.log('[Cron] Checking software renewal notifications...');

  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Get all inbox software with future renewal dates
    const softwareWithRenewals = await prisma.inboxSoftware.findMany({
      where: {
        renewalDate: { gte: now },
      },
      include: {
        software: { select: { name: true } },
        inbox: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
        admins: {
          include: {
            member: { select: { id: true } },
          },
        },
      },
    });

    let notificationsSent = 0;

    for (const sw of softwareWithRenewals) {
      const renewalDate = new Date(sw.renewalDate);
      renewalDate.setHours(0, 0, 0, 0);
      const diffTime = renewalDate.getTime() - now.getTime();
      const daysUntilRenewal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      for (const threshold of RENEWAL_THRESHOLDS) {
        if (daysUntilRenewal > threshold.days) continue;

        // Check if this notification was already sent
        const alreadySent = await prisma.softwareRenewalNotification.findUnique({
          where: {
            inboxSoftwareId_threshold_renewalDate: {
              inboxSoftwareId: sw.id,
              threshold: threshold.label,
              renewalDate: sw.renewalDate,
            },
          },
        });

        if (alreadySent) continue;

        // Recipients: all software admins
        const recipientIds = sw.admins.map((a) => a.member.id);
        if (recipientIds.length === 0) continue;

        const renewalDateFormatted = renewalDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        // Send notifications
        await notifyMultiple(prisma, {
          type: 'SOFTWARE_RENEWAL_REMINDER',
          recipientIds,
          organizationId: sw.inbox.organizationId,
          data: {
            softwareName: sw.software.name,
            daysUntilRenewal: threshold.days,
            renewalDateFormatted,
            cost: sw.cost ? parseFloat(sw.cost).toFixed(2) : null,
            billingCycle: sw.billingCycle,
            inboxName: sw.inbox.name,
            inboxId: sw.inbox.id,
            inboxSoftwareId: sw.id,
          },
          entityType: 'inbox_software',
          entityId: sw.id,
        });

        // Record that this notification was sent
        await prisma.softwareRenewalNotification.create({
          data: {
            inboxSoftwareId: sw.id,
            threshold: threshold.label,
            renewalDate: sw.renewalDate,
          },
        });

        notificationsSent++;
        break; // Only send the most urgent threshold per software per run
      }
    }

    console.log(`[Cron] Renewal check complete. Sent ${notificationsSent} notification(s).`);
  } catch (error) {
    console.error('[Cron] Error checking renewals:', error);
  }
}

export function startCronJobs() {
  // Run daily at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    checkRenewalNotifications();
  });

  console.log('[Cron] Scheduled renewal notification check at 8:00 AM daily');
}
