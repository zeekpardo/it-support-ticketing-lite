import { escapeHtml } from '../../../utils/sanitize.js';
import { sendEmail, APP_NAME } from '../client.js';
import { buildHtmlEmail, buildTextEmail } from '../templates.js';

// ==========================================
// Welcome Email Context Bridge
// ==========================================

// When admin creates a user, we stash context here so that
// the sendResetPassword callback in auth.js can send a welcome email instead
// of the generic "Reset your password" email.
const pendingWelcomeEmails = new Map();

export function markWelcomeEmail(email, context) {
  pendingWelcomeEmails.set(email.toLowerCase(), context);
}

export function consumeWelcomeContext(email) {
  const key = email.toLowerCase();
  const ctx = pendingWelcomeEmails.get(key);
  if (ctx) pendingWelcomeEmails.delete(key);
  return ctx;
}

// ==========================================
// Public Ticket Email Context Bridge
// ==========================================

// When a public ticket is submitted, we stash context here so that
// the sendMagicLink callback in auth.js can send a combined confirmation
// email instead of the generic "Sign in" email.
const pendingTicketEmails = new Map();

export function markPublicTicketEmail(email, context) {
  pendingTicketEmails.set(email.toLowerCase(), context);
}

export function consumePublicTicketContext(email) {
  const key = email.toLowerCase();
  const ctx = pendingTicketEmails.get(key);
  if (ctx) pendingTicketEmails.delete(key);
  return ctx;
}

// ==========================================
// Auth Emails
// ==========================================

export async function sendVerificationEmail({ user, url }) {
  return sendEmail({
    to: user.email,
    subject: `Verify your email - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: 'Verify your email address',
      greeting: user.name,
      paragraphs: [
        `Thanks for signing up for ${APP_NAME}! Please verify your email address by clicking the button below:`,
        "If you didn't create an account, you can safely ignore this email."
      ],
      button: { text: 'Verify Email', url },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: user.name,
      paragraphs: [
        { text: `Verify your email address\n\nThanks for signing up for ${APP_NAME}! Please verify your email by visiting:` },
        "If you didn't create an account, you can safely ignore this email."
      ],
      buttonText: 'Verify your email',
      buttonUrl: url
    })
  });
}

export async function sendPasswordResetEmail({ user, url }) {
  return sendEmail({
    to: user.email,
    subject: `Reset your password - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: 'Reset your password',
      greeting: user.name,
      paragraphs: [
        'We received a request to reset your password. Click the button below to choose a new one:',
        'This link will expire in 1 hour.',
        "If you didn't request a password reset, you can safely ignore this email."
      ],
      button: { text: 'Reset Password', url },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: user.name,
      paragraphs: [
        'Reset your password\n\nWe received a request to reset your password. Visit this link to choose a new one:',
        'This link will expire in 1 hour.',
        "If you didn't request a password reset, you can safely ignore this email."
      ],
      buttonText: 'Reset password',
      buttonUrl: url
    })
  });
}

export async function sendInvitationEmail({ email, inviterName, organizationName, inviteUrl }) {
  return sendEmail({
    to: email,
    subject: `You've been invited to ${organizationName} - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: "You've been invited!",
      greeting: null,
      paragraphs: [
        `<strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(organizationName)}</strong> on ${APP_NAME}.`
      ],
      button: { text: 'Accept Invitation', url: inviteUrl },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: null,
      paragraphs: [
        "You've been invited!",
        `${inviterName} has invited you to join ${organizationName} on ${APP_NAME}.`
      ],
      buttonText: 'Accept the invitation',
      buttonUrl: inviteUrl
    })
  });
}

export async function sendMagicLinkEmail({ email, url }) {
  return sendEmail({
    to: email,
    subject: `Sign in to ${APP_NAME}`,
    html: buildHtmlEmail({
      header: `Sign in to ${APP_NAME}`,
      greeting: null,
      paragraphs: [
        'Click the button below to sign in to your account. This link will expire in 5 minutes.',
        "If you didn't request this link, you can safely ignore this email."
      ],
      button: { text: 'Sign In', url },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: null,
      paragraphs: [
        `Sign in to ${APP_NAME}`,
        'Click the link below to sign in to your account. This link will expire in 5 minutes.',
        "If you didn't request this link, you can safely ignore this email."
      ],
      buttonText: 'Sign in',
      buttonUrl: url
    })
  });
}

export async function sendWelcomeEmail({ to, name, organizationName, setPasswordUrl }) {
  return sendEmail({
    to,
    subject: `Welcome to ${organizationName} - ${APP_NAME}`,
    html: buildHtmlEmail({
      header: `Welcome to ${organizationName}!`,
      greeting: name,
      paragraphs: [
        `An account has been created for you on <strong>${APP_NAME}</strong> by your organization administrator.`,
        'Click the button below to set your password and get started:'
      ],
      button: { text: 'Set Your Password', url: setPasswordUrl },
      showLinkFallback: true
    }),
    text: buildTextEmail({
      greeting: name,
      paragraphs: [
        `Welcome to ${organizationName}!`,
        `An account has been created for you on ${APP_NAME} by your organization administrator.`,
        'Visit the link below to set your password and get started:'
      ],
      buttonText: 'Set your password',
      buttonUrl: setPasswordUrl
    })
  });
}
