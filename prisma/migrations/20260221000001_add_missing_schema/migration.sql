-- Add UserRole enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add role column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Add timezone column to Website table
ALTER TABLE "Website" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';

-- Create PasswordResetToken table
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_email_token_key" ON "PasswordResetToken"("email", "token");

-- Create PostVersion table
CREATE TABLE IF NOT EXISTS "PostVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "editedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blogPostId" TEXT NOT NULL,

    CONSTRAINT "PostVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PostVersion_blogPostId_idx" ON "PostVersion"("blogPostId");
CREATE UNIQUE INDEX IF NOT EXISTS "PostVersion_blogPostId_version_key" ON "PostVersion"("blogPostId", "version");
ALTER TABLE "PostVersion" DROP CONSTRAINT IF EXISTS "PostVersion_blogPostId_fkey";
ALTER TABLE "PostVersion" ADD CONSTRAINT "PostVersion_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create UserJob table
CREATE TABLE IF NOT EXISTS "UserJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "step" TEXT,
    "steps" TEXT[],
    "error" TEXT,
    "data" JSONB,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,

    CONSTRAINT "UserJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UserJob_userId_websiteId_idx" ON "UserJob"("userId", "websiteId");
CREATE INDEX IF NOT EXISTS "UserJob_userId_status_idx" ON "UserJob"("userId", "status");
ALTER TABLE "UserJob" DROP CONSTRAINT IF EXISTS "UserJob_userId_fkey";
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
