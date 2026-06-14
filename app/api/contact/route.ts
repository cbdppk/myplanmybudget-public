import { z } from "zod";
import { prismaAdmin } from "@/lib/prisma";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";

const ContactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(190),
  subject: z.string().max(160).optional().or(z.literal("")),
  message: z.string().min(10).max(4000),
});

export async function POST(request: Request) {
  const key = `contact:${getClientKey(request)}`;
  const rate = await checkRateLimit(key, 10, 60_000);
  if (!rate.allowed) {
    return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid contact payload." }, { status: 400 });
  }

  const inquiry = await prismaAdmin.contactInquiry.create({
    data: {
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim().toLowerCase(),
      subject: parsed.data.subject?.trim() || null,
      message: parsed.data.message.trim(),
    },
    select: { id: true, createdAt: true },
  });

  const admins = await prismaAdmin.userProfile.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prismaAdmin.auditEvent.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        action: "CONTACT_INQUIRY_RECEIVED",
        meta: { inquiryId: inquiry.id, at: inquiry.createdAt.toISOString() },
      })),
    }).catch(() => undefined);
  }

  return Response.json({ ok: true, inquiryId: inquiry.id });
}
