/**
 * Email Module - Barrel Export
 *
 * Re-exports all public email functions for backward compatibility.
 * All existing imports from '../lib/email.js' resolve here automatically.
 *
 * To add a new mailer:
 *   1. Create a file in mailers/ (e.g. mailers/billing.js)
 *   2. Import shared utilities from ../client.js, ../templates.js, ../threading.js
 *   3. Export your send functions
 *   4. Re-export them below
 */

// Core
export { sendEmail, getFrontendUrl } from './client.js';
export { getOrgBranding } from './branding.js';

// Auth mailers
export {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendMagicLinkEmail,
  sendWelcomeEmail,
  markWelcomeEmail,
  consumeWelcomeContext,
  markPublicTicketEmail,
  consumePublicTicketContext,
} from './mailers/auth.js';

// Ticket mailers
export {
  sendTicketCommentEmail,
  sendTicketAssignmentEmail,
  sendMentionEmail,
  sendTicketSubmittedEmail,
  sendNewTicketAssignedEmail,
  sendPublicTicketConfirmationEmail,
  sendThreadedTicketReply,
  sendAutoReplyEmail,
} from './mailers/ticket.js';

// Software mailers
export {
  sendAccessRequestEmail,
  sendAccessStatusEmail,
  sendRenewalReminderEmail,
} from './mailers/software.js';

// Billing mailers
export {
  sendBillingThresholdEmail,
} from './mailers/billing.js';
