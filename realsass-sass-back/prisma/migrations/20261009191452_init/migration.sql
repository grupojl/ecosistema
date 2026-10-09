-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isAffiliate" BOOLEAN NOT NULL DEFAULT false,
    "affiliateCode" TEXT,
    "referredByCode" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "slug" TEXT,
    "enabledProducts" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'AR',
    "ecosystemId" TEXT NOT NULL DEFAULT 'welver',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "storeStatus" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborators" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_data" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff',
    "accentColor" TEXT,
    "fontFamily" TEXT NOT NULL DEFAULT 'DM Sans',
    "borderRadius" TEXT NOT NULL DEFAULT '0.75rem',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "customCSS" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "valueIv" TEXT NOT NULL,
    "valueTag" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "description" TEXT,
    "systemTarget" TEXT NOT NULL DEFAULT 'all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secret_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "systemTarget" TEXT NOT NULL DEFAULT 'all',
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'email',
    "systemTarget" TEXT NOT NULL DEFAULT 'all',
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "alertAt" INTEGER NOT NULL DEFAULT 80,
    "resetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" JSONB NOT NULL DEFAULT '[]',
    "secretHash" TEXT NOT NULL,
    "secretPrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "retryPolicy" JSONB NOT NULL DEFAULT '{"maxAttempts":3,"backoffMs":1000}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_logs" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "duration" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "configType" TEXT NOT NULL,
    "configKey" TEXT,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "diff" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fulfillment_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_affiliateCode_key" ON "users"("affiliateCode");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_userId_key" ON "organizations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "collaborators_organizationId_idx" ON "collaborators"("organizationId");

-- CreateIndex
CREATE INDEX "collaborators_userId_idx" ON "collaborators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "collaborators_organizationId_email_key" ON "collaborators"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_collaboratorId_key" ON "invitations"("collaboratorId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_data_userId_key" ON "affiliate_data"("userId");

-- CreateIndex
CREATE INDEX "theme_configs_organizationId_idx" ON "theme_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "theme_configs_organizationId_name_key" ON "theme_configs"("organizationId", "name");

-- CreateIndex
CREATE INDEX "secret_configs_organizationId_idx" ON "secret_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "secret_configs_organizationId_key_key" ON "secret_configs"("organizationId", "key");

-- CreateIndex
CREATE INDEX "feature_flags_organizationId_idx" ON "feature_flags"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_organizationId_key_key" ON "feature_flags"("organizationId", "key");

-- CreateIndex
CREATE INDEX "content_templates_organizationId_idx" ON "content_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "content_templates_organizationId_key_key" ON "content_templates"("organizationId", "key");

-- CreateIndex
CREATE INDEX "quota_configs_organizationId_idx" ON "quota_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "quota_configs_organizationId_resource_key" ON "quota_configs"("organizationId", "resource");

-- CreateIndex
CREATE INDEX "webhook_endpoints_organizationId_idx" ON "webhook_endpoints"("organizationId");

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_webhookId_idx" ON "webhook_delivery_logs"("webhookId");

-- CreateIndex
CREATE INDEX "config_audit_logs_organizationId_createdAt_idx" ON "config_audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "config_audit_logs_configType_idx" ON "config_audit_logs"("configType");

-- CreateIndex
CREATE INDEX "markets_organization_id_is_active_idx" ON "markets"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "markets_organization_id_country_code_key" ON "markets"("organization_id", "country_code");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_data" ADD CONSTRAINT "affiliate_data_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_configs" ADD CONSTRAINT "theme_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_configs" ADD CONSTRAINT "secret_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_configs" ADD CONSTRAINT "quota_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_audit_logs" ADD CONSTRAINT "config_audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
