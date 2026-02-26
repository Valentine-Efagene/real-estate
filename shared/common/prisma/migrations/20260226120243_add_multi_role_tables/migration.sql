-- AlterTable
ALTER TABLE `organization_members` ADD COLUMN `roleId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `tenant_membership_roles` (
    `tenantMembershipId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_membership_roles_roleId_idx`(`roleId`),
    PRIMARY KEY (`tenantMembershipId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_member_roles` (
    `organizationMemberId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `organization_member_roles_roleId_idx`(`roleId`),
    PRIMARY KEY (`organizationMemberId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `organization_members_roleId_idx` ON `organization_members`(`roleId`);

-- AddForeignKey
ALTER TABLE `tenant_membership_roles` ADD CONSTRAINT `tenant_membership_roles_tenantMembershipId_fkey` FOREIGN KEY (`tenantMembershipId`) REFERENCES `tenant_memberships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_membership_roles` ADD CONSTRAINT `tenant_membership_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_member_roles` ADD CONSTRAINT `organization_member_roles_organizationMemberId_fkey` FOREIGN KEY (`organizationMemberId`) REFERENCES `organization_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_member_roles` ADD CONSTRAINT `organization_member_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
