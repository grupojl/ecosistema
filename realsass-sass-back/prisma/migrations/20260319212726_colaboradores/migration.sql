-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');

-- CreateTable
CREATE TABLE "collaborators" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "canViewListings" BOOLEAN NOT NULL DEFAULT true,
    "canCreateListings" BOOLEAN NOT NULL DEFAULT false,
    "canEditListings" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteListings" BOOLEAN NOT NULL DEFAULT false,
    "canViewStats" BOOLEAN NOT NULL DEFAULT false,
    "canManageLeads" BOOLEAN NOT NULL DEFAULT false,
    "canManageCollaborators" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateIndex
CREATE INDEX "collaborators_organizationId_idx" ON "collaborators"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "collaborators_organizationId_email_key" ON "collaborators"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_collaboratorId_key" ON "invitations"("collaboratorId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
