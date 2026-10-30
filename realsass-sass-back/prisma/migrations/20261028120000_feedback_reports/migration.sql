-- ADR-027: reportes de usuario. Tabla y enum nuevos, no destructivo.
CREATE TYPE "FeedbackStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX');

CREATE TABLE "feedback_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userUid" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expected" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'RECEIVED',
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_reports_organizationId_createdAt_idx" ON "feedback_reports"("organizationId", "createdAt");
CREATE INDEX "feedback_reports_userUid_idx" ON "feedback_reports"("userUid");
CREATE INDEX "feedback_reports_status_createdAt_idx" ON "feedback_reports"("status", "createdAt");

ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
