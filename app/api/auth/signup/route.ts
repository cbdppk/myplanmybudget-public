import { randomBytes } from "node:crypto";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { sendEmail } from "@/lib/email/send";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const VERIFY_IDENTIFIER_PREFIX = "email-verify:";

function buildWelcomeEmail(name: string, verifyUrl: string): { subject: string; text: string; html: string } {
  const displayName = name || "there";
  const subject = "Welcome to MyplanMybudget — confirm your email";

  const text = [
    `Hi ${displayName},`,
    "",
    "Welcome to MyplanMybudget! We're excited to have you on board.",
    "",
    "Please confirm your email address by visiting the link below.",
    "This link expires in 24 hours.",
    "",
    verifyUrl,
    "",
    "Once confirmed, you can log in and start building your first budget in minutes.",
    "",
    "If you didn't create this account, you can safely ignore this email.",
    "",
    "— The MyplanMybudget team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:rgba(255,255,255,0.1);border-radius:10px;padding:8px 12px;margin-bottom:0;">
                    <span style="font-size:13px;font-weight:900;color:#22d3ee;letter-spacing:-0.5px;">M</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="font-size:15px;font-weight:700;color:#ffffff;">MyplanMybudget</span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                Welcome aboard, ${displayName}! 🎉
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.5;">
                You're one step away from taking control of your finances.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                Hi ${displayName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
                Thanks for signing up! Please confirm your email address to activate your account and get started.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:10px;background:#0f172a;">
                    <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Confirm my email address →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#94a3b8;word-break:break-all;">
                ${verifyUrl}
              </p>

              <!-- What you get -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <tr><td>
                  <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">What's waiting for you</p>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    ${[
                      ["📊", "A live budget dashboard updated with every transaction"],
                      ["🎯", "Savings goals with monthly progress tracking"],
                      ["🔮", "What-if simulations to plan smarter"],
                      ["📝", "Notes and reminders — all in one place"],
                    ].map(([icon, text]) => `
                    <tr>
                      <td style="padding:4px 10px 4px 0;font-size:16px;vertical-align:top;">${icon}</td>
                      <td style="padding:4px 0;font-size:13px;color:#475569;line-height:1.5;">${text}</td>
                    </tr>`).join("")}
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                This link expires in <strong>24 hours</strong>. If you didn't create this account, you can safely ignore this email — no action is needed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${new Date().getFullYear()} EyeHai Technologies · MyplanMybudget
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export async function POST(request: Request) {
  const ipKey = getClientKey(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String((body as { email?: string }).email ?? "").trim().toLowerCase();
  const password = String((body as { password?: string }).password ?? "");
  const name = String((body as { name?: string }).name ?? "").trim().slice(0, 80);
  const cfToken = String((body as { cfToken?: string }).cfToken ?? "");

  const routeRate = await checkRateLimit(`auth:signup:ip:${ipKey}`, 12, 60_000);
  if (!routeRate.allowed) {
    return Response.json({ error: "Too many signup attempts. Please try again shortly." }, { status: 429 });
  }
  if (email) {
    const emailRate = await checkRateLimit(`auth:signup:email:${email}`, 4, 60_000);
    if (!emailRate.allowed) {
      return Response.json({ error: "Too many signup attempts. Please try again shortly." }, { status: 429 });
    }
  }

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email is required." }, { status: 400 });
  }

  const turnstileOk = await verifyTurnstile(cfToken);
  if (!turnstileOk) {
    return Response.json({ error: "Bot check failed. Please try again." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { findUserByEmail, createAuthUser, saveCredentialHash } = await import("@/lib/data/auth");
  const { hashPassword } = await import("@/lib/auth/password");
  const { prismaAdmin } = await import("@/lib/prisma");

  const existing = await findUserByEmail(email);
  if (existing) {
    // Check if account was created via Google (no password credential set)
    const hasPassword = await prismaAdmin.authCredential.findUnique({
      where: { userId: existing.id },
      select: { id: true },
    });
    if (!hasPassword) {
      return Response.json({
        error: "This email is already registered via Google. Use 'Continue with Google' to sign in.",
        hint: "use_google",
      }, { status: 409 });
    }
    return Response.json({
      error: "An account with this email already exists. Sign in instead.",
      hint: "sign_in",
    }, { status: 409 });
  }

  const profile = await createAuthUser(email, name || undefined);
  await saveCredentialHash(profile.id, hashPassword(password));
  const displayName = name || email.split("@")[0];
  await prismaAdmin.user.upsert({
    where: { email },
    update: { profileId: profile.id, name: displayName },
    create: { email, name: displayName, profileId: profile.id },
  });

  // Generate and store email verification token
  const token = randomBytes(32).toString("hex");
  const identifier = `${VERIFY_IDENTIFIER_PREFIX}${email}`;
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prismaAdmin.verificationToken.deleteMany({ where: { identifier } });
  await prismaAdmin.verificationToken.create({
    data: { identifier, token, expires },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;
  const emailContent = buildWelcomeEmail(displayName, verifyUrl);

  await sendEmail({ to: email, ...emailContent });

  return Response.json({ ok: true, requiresVerification: true });
}
