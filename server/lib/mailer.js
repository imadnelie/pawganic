import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendResetPasswordEmail({ to, resetLink }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@pawganic.local";
  const t = getTransporter();
  const text = `You requested a password reset for Pawganic.\n\nUse this link to reset your password:\n${resetLink}\n\nThis link expires in 1 hour.`;

  if (!t) {
    console.log(`[mail-fallback] To: ${to} | Reset link: ${resetLink}`);
    return;
  }

  await t.sendMail({
    from,
    to,
    subject: "Pawganic Password Reset",
    text,
  });
}
