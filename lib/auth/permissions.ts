import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const sessionUser = await requireUser();
  const user = await prisma.userProfile.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, role: true, isActive: true, name: true },
  });

  if (!user) throw new Error("UNAUTHENTICATED");
  if (!user.isActive) throw new Error("ACCOUNT_DISABLED");
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

