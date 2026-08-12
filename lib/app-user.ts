import { prisma } from "@/lib/prisma";
import { setDbIdentity } from "@/lib/security/db-context";

const DEMO_EMAIL = "demo@myplanmybudget.app";

export async function getOrCreateDemoUser() {
  setDbIdentity({ userEmail: DEMO_EMAIL });
  return prisma.userProfile.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      currency: "GHS",
    },
  });
}
