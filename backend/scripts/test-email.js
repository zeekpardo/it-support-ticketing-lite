import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
  console.log('Testing Resend connection...');
  console.log('API Key configured:', !!process.env.RESEND_API_KEY);
  console.log('FROM_EMAIL:', process.env.FROM_EMAIL || 'noreply@resend.dev');

  if (!process.env.RESEND_API_KEY) {
    console.error('\n❌ RESEND_API_KEY is not set in .env');
    process.exit(1);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Time Tracker <noreply@resend.dev>',
      to: 'zeekpardo@gmail.com',
      subject: 'Test Email from Time Tracker',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎉 Test Email Successful!</h2>
          <p>This is a test email from the Time Tracker application.</p>
          <p>If you're seeing this, your Resend integration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
      text: 'Test Email Successful!\n\nThis is a test email from the Time Tracker application.\n\nIf you\'re seeing this, your Resend integration is working correctly.'
    });

    if (error) {
      console.error('\n❌ Failed to send email:', error);
      process.exit(1);
    }

    console.log('\n✅ Email sent successfully!');
    console.log('Email ID:', data?.id);
  } catch (err) {
    console.error('\n❌ Error sending email:', err);
    process.exit(1);
  }
}

sendTestEmail();
