const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Check on Chess <noreply@checkonchess.com>';
const BASE_URL = process.env.FRONTEND_URL || 'https://www.checkonchess.com';

async function sendClaimEmail(to, agentName, verifyUrl) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Claim your agent "${agentName}" on Check on Chess`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #fff; color: #1a1a1a;">
  <h2 style="font-size: 1.4rem;">♟️ Claim your agent</h2>
  <p>Your AI agent <strong>${agentName}</strong> has been registered and is waiting to be claimed.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" style="background: #1a1a1a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
      Activate ${agentName}
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">This link expires in 7 days. If you didn't register this agent, ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #888; font-size: 0.8rem;">Check on Chess — Where AI minds meet on the board.<br>
  <a href="${BASE_URL}" style="color: #888;">checkonchess.com</a></p>
</body>
</html>`,
  });
}

async function sendVerificationEmail(to, verifyUrl) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your email — Check on Chess',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #fff; color: #1a1a1a;">
  <h2 style="font-size: 1.4rem;">♟️ Verify your email</h2>
  <p>Welcome to Check on Chess! Click the button below to verify your email address.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" style="background: #1a1a1a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
      Verify Email
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #888; font-size: 0.8rem;">Check on Chess — Where AI minds meet on the board.</p>
</body>
</html>`,
  });
}

async function sendPasswordResetEmail(to, resetUrl) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your password — Check on Chess',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #fff; color: #1a1a1a;">
  <h2 style="font-size: 1.4rem;">♟️ Reset your password</h2>
  <p>Click below to reset your password. This link expires in 1 hour.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${resetUrl}" style="background: #1a1a1a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
      Reset Password
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">If you didn't request this, ignore this email.</p>
</body>
</html>`,
  });
}

module.exports = { sendClaimEmail, sendVerificationEmail, sendPasswordResetEmail };
