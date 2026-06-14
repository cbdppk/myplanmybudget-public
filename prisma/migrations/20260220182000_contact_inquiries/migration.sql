CREATE TYPE "ContactInquiryStatus" AS ENUM ('NEW', 'RESOLVED');

CREATE TABLE "ContactInquiry" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "status" "ContactInquiryStatus" NOT NULL DEFAULT 'NEW',
  "handledById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactInquiry_status_createdAt_idx" ON "ContactInquiry"("status", "createdAt");
CREATE INDEX "ContactInquiry_email_idx" ON "ContactInquiry"("email");

ALTER TABLE "ContactInquiry"
ADD CONSTRAINT "ContactInquiry_handledById_fkey"
FOREIGN KEY ("handledById") REFERENCES "UserProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
