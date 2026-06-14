import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// prisma.config.ts is used by the Prisma CLI (migrate, generate, studio, etc.).
// For runtime connection, lib/prisma.ts reads DATABASE_URL directly.
// DIRECT_URL (unpooled) is used here so migrations bypass the connection pooler.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL") ?? env("DATABASE_URL"),
  },
});
