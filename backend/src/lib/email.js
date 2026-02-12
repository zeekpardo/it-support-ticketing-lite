import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'Time Tracker <noreply@resend.dev>';
const APP_NAME = process.env.APP_NAME || 'Time Tracker';

/**
 * Send an email using Resend
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] No RESEND_API_KEY set, logging email instead:');
    console.log({ to, subject, text: text?.substring(0, 200) });
    return { success: true, mock: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return { success: false, error };
    }

    console.log('[Email] Sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Error:', err);
    return { success: false, error: err };
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail({ user, url }) {
  return sendEmail({
    to: user.email,
    subject: `Verify your email - ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your email address</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>Thanks for signing up for ${APP_NAME}! Please verify your email address by clicking the button below:</p>
        <p style="margin: 30px 0;">
          <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${url}</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
      </div>
    `,
    text: `Verify your email address\n\nHi ${user.name || 'there'},\n\nThanks for signing up for ${APP_NAME}! Please verify your email by visiting:\n\n${url}\n\nIf you didn't create an account, you can safely ignore this email.`
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ user, url }) {
  return sendEmail({
    to: user.email,
    subject: `Reset your password - ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        <p style="margin: 30px 0;">
          <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${url}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
      </div>
    `,
    text: `Reset your password\n\nHi ${user.name || 'there'},\n\nWe received a request to reset your password. Visit this link to choose a new one:\n\n${url}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.`
  });
}

/**
 * Send organization invitation email
 */
export async function sendInvitationEmail({ email, inviterName, organizationName, inviteUrl }) {
  return sendEmail({
    to: email,
    subject: `You've been invited to ${organizationName} - ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited!</h2>
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on ${APP_NAME}.</p>
        <p style="margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Accept Invitation
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #6b7280; word-break: break-all;">${inviteUrl}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${APP_NAME}</p>
      </div>
    `,
    text: `You've been invited!\n\nHi there,\n\n${inviterName} has invited you to join ${organizationName} on ${APP_NAME}.\n\nAccept the invitation:\n${inviteUrl}`
  });
}
