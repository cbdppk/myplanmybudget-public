CREATE TABLE "AuthCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthCredential_userId_key" ON "AuthCredential"("userId");

ALTER TABLE "AuthCredential"
ADD CONSTRAINT "AuthCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
