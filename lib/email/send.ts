export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends an email via SMTP if SMTP_HOST/SMTP_USER/SMTP_PASS are configured.
 * In dev (or when SMTP is not configured) it logs to console and no-ops.
 *
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in your .env
 * to enable live email delivery.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean; reason?: string }> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() ?? `noreply@myplanmybudget.app`;
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "email_send_skipped",
        JSON.stringify({
          to: payload.to,
          subject: payload.subject,
          reason: "SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)",
        }),
      );
    }
    return { sent: false, reason: "SMTP not configured" };
  }

  // Dynamic import keeps nodemailer out of the bundle for edge/serverless
  // environments that don't configure SMTP.
  const nodemailer = await import("nodemailer").catch(() => null);
  if (!nodemailer) {
    console.error("email_send_error", "nodemailer not installed. Run: pnpm add nodemailer");
    return { sent: false, reason: "nodemailer not installed" };
  }

  const transporter = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? payload.text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    console.error("email_send_error", JSON.stringify({ to: payload.to, error: message }));
    return { sent: false, reason: message };
  }
}
