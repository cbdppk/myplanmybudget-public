CREATE TABLE "AssistantFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'COMPLAINT',
  "sourcePage" TEXT NOT NULL DEFAULT 'assistant',
  "sourceQuestion" TEXT,
  "status" "ContactInquiryStatus" NOT NULL DEFAULT 'NEW',
  "handledById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantFeedback_status_createdAt_idx" ON "AssistantFeedback"("status", "createdAt");
CREATE INDEX "AssistantFeedback_category_status_createdAt_idx" ON "AssistantFeedback"("category", "status", "createdAt");
CREATE INDEX "AssistantFeedback_userId_createdAt_idx" ON "AssistantFeedback"("userId", "createdAt");
CREATE INDEX "AssistantFeedback_email_idx" ON "AssistantFeedback"("email");

ALTER TABLE "AssistantFeedback"
ADD CONSTRAINT "AssistantFeedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantFeedback"
ADD CONSTRAINT "AssistantFeedback_handledById_fkey"
FOREIGN KEY ("handledById") REFERENCES "UserProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
