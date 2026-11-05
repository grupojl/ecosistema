-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'GRACE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('MANUAL', 'ONLINE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('TEXT', 'PDF');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TIKTOK');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('PENDING', 'CONNECTED', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "TestQuestionKind" AS ENUM ('QUALITY', 'SECURITY');

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "data_retention_days" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "org_chart_template" TEXT,
ADD COLUMN     "population" INTEGER;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "period" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "billingMode" "BillingMode" NOT NULL DEFAULT 'MANUAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "graceDays" INTEGER NOT NULL DEFAULT 10,
    "messageCap" INTEGER,
    "isPilot" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "markedPaidBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipal_entities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "municipal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_permissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "KnowledgeKind" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileSizeBytes" INTEGER,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "authorUid" TEXT NOT NULL,
    "reviewerUid" TEXT,
    "reviewNote" TEXT,
    "indexedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "KnowledgeKind" NOT NULL,
    "content" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'ARCHIVED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "accountRef" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "ChannelStatus" NOT NULL DEFAULT 'PENDING',
    "secretKey" TEXT,
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entityId" TEXT,
    "kind" "TestQuestionKind" NOT NULL DEFAULT 'QUALITY',
    "question" TEXT NOT NULL,
    "expected" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "TestQuestionKind" NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" INTEGER NOT NULL,
    "covered" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_gaps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entityId" TEXT,
    "questionNormalized" TEXT NOT NULL,
    "sampleQuestion" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "information_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "tone" TEXT,
    "language" TEXT,
    "visibleEntityIds" JSONB NOT NULL DEFAULT '[]',
    "allowedChannels" JSONB NOT NULL DEFAULT '[]',
    "rateLimitPerMinute" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_organization_id_status_idx" ON "subscription_invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "subscription_invoices_subscriptionId_idx" ON "subscription_invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX "municipal_entities_organization_id_parentId_idx" ON "municipal_entities"("organization_id", "parentId");

-- CreateIndex
CREATE INDEX "entity_links_organization_id_idx" ON "entity_links"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_links_fromEntityId_toEntityId_key" ON "entity_links"("fromEntityId", "toEntityId");

-- CreateIndex
CREATE INDEX "entity_permissions_organization_id_idx" ON "entity_permissions"("organization_id");

-- CreateIndex
CREATE INDEX "entity_permissions_entityId_idx" ON "entity_permissions"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_permissions_collaboratorId_entityId_key" ON "entity_permissions"("collaboratorId", "entityId");

-- CreateIndex
CREATE INDEX "knowledge_items_organization_id_entityId_status_idx" ON "knowledge_items"("organization_id", "entityId", "status");

-- CreateIndex
CREATE INDEX "knowledge_versions_organization_id_idx" ON "knowledge_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_versions_itemId_version_key" ON "knowledge_versions"("itemId", "version");

-- CreateIndex
CREATE INDEX "mandates_organization_id_createdAt_idx" ON "mandates"("organization_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "entity_channels_entityId_provider_key" ON "entity_channels"("entityId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "entity_channels_organization_id_provider_accountRef_key" ON "entity_channels"("organization_id", "provider", "accountRef");

-- CreateIndex
CREATE INDEX "test_questions_organization_id_kind_active_idx" ON "test_questions"("organization_id", "kind", "active");

-- CreateIndex
CREATE INDEX "quality_runs_organization_id_kind_createdAt_idx" ON "quality_runs"("organization_id", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "information_gaps_organization_id_status_lastSeenAt_idx" ON "information_gaps"("organization_id", "status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "information_gaps_organization_id_questionNormalized_key" ON "information_gaps"("organization_id", "questionNormalized");

-- CreateIndex
CREATE INDEX "api_profiles_organization_id_parentId_idx" ON "api_profiles"("organization_id", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_organization_id_profileId_idx" ON "api_keys"("organization_id", "profileId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipal_entities" ADD CONSTRAINT "municipal_entities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipal_entities" ADD CONSTRAINT "municipal_entities_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "municipal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "municipal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "municipal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_permissions" ADD CONSTRAINT "entity_permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_permissions" ADD CONSTRAINT "entity_permissions_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_permissions" ADD CONSTRAINT "entity_permissions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "municipal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "municipal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_channels" ADD CONSTRAINT "entity_channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_channels" ADD CONSTRAINT "entity_channels_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "municipal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "municipal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_runs" ADD CONSTRAINT "quality_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_gaps" ADD CONSTRAINT "information_gaps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_gaps" ADD CONSTRAINT "information_gaps_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "municipal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_profiles" ADD CONSTRAINT "api_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_profiles" ADD CONSTRAINT "api_profiles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "api_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "api_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

