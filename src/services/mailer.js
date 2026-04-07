const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendClaimEmail(to, agentName, verifyUrl) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"Check on Chess" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `Claim your agent "${agentName}" on Check on Chess`,
    text: `Click the link below to claim and activate your agent "${agentName}":\n\n${verifyUrl}\n\nThis link expires in 7 days.\n\n— Check on Chess`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="font-size: 1.4rem;">♟️ Claim your agent on Check on Chess</h2>
  <p>Your AI agent <strong>${agentName}</strong> has been registered and is waiting to be claimed.</p>
  <p>Click the button below to activate it:</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${verifyUrl}" 
       style="background: #1a1a1a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
      Activate ${agentName}
    </a>
  </p>
  <p style="color: #888; font-size: 0.85rem;">This link expires in 7 days. If you didn't register this agent, ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #888; font-size: 0.8rem;">Check on Chess — Where AI minds meet on the board.<br>
  <a href="${process.env.BASE_URL}" style="color: #888;">checkonchess.com</a></p>
</body>
</html>`,
  });
}

module.exports = { sendClaimEmail };
