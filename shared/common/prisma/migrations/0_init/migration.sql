-- CreateTable
CREATE TABLE `organization_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystemType` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organization_types_tenantId_idx`(`tenantId`),
    INDEX `organization_types_code_idx`(`code`),
    UNIQUE INDEX `organization_types_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_type_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `typeId` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `organization_type_assignments_organizationId_idx`(`organizationId`),
    INDEX `organization_type_assignments_typeId_idx`(`typeId`),
    UNIQUE INDEX `organization_type_assignments_organizationId_typeId_key`(`organizationId`, `typeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `googleId` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `tenantId` VARCHAR(191) NULL,
    `walletId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `emailVerificationToken` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    UNIQUE INDEX `users_walletId_key`(`walletId`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `tenantId` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `roles_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `roles_name_tenantId_key`(`name`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `path` VARCHAR(191) NOT NULL,
    `methods` JSON NOT NULL,
    `effect` ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
    `tenantId` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `permissions_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `permissions_path_tenantId_key`(`path`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_memberships` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `tenant_memberships_tenantId_idx`(`tenantId`),
    INDEX `tenant_memberships_userId_idx`(`userId`),
    UNIQUE INDEX `tenant_memberships_userId_tenantId_key`(`userId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE') NOT NULL DEFAULT 'PENDING',
    `isPlatformOrg` BOOLEAN NOT NULL DEFAULT false,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL DEFAULT 'Nigeria',
    `website` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `bankCode` VARCHAR(191) NULL,
    `bankLicenseNo` VARCHAR(191) NULL,
    `swiftCode` VARCHAR(191) NULL,
    `sortCode` VARCHAR(191) NULL,
    `cacNumber` VARCHAR(191) NULL,
    `cacCertificateUrl` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organizations_tenantId_idx`(`tenantId`),
    INDEX `organizations_status_idx`(`status`),
    UNIQUE INDEX `organizations_tenantId_bankCode_key`(`tenantId`, `bankCode`),
    UNIQUE INDEX `organizations_tenantId_cacNumber_key`(`tenantId`, `cacNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_members` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `invitedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `invitedBy` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organization_members_userId_idx`(`userId`),
    INDEX `organization_members_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `organization_members_organizationId_userId_key`(`organizationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_document_requirements` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `modifier` ENUM('REQUIRED', 'OPTIONAL', 'NOT_REQUIRED', 'STRICTER') NOT NULL DEFAULT 'REQUIRED',
    `description` TEXT NULL,
    `expiryDays` INTEGER NULL,
    `minFiles` INTEGER NULL,
    `maxFiles` INTEGER NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `validationRules` JSON NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_document_requirements_tenantId_idx`(`tenantId`),
    INDEX `bank_document_requirements_organizationId_idx`(`organizationId`),
    INDEX `bank_document_requirements_phaseId_idx`(`phaseId`),
    INDEX `bank_document_requirements_documentType_idx`(`documentType`),
    UNIQUE INDEX `bank_document_requirements_organizationId_phaseId_documentTy_key`(`organizationId`, `phaseId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subdomain` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenants_subdomain_key`(`subdomain`),
    INDEX `tenants_subdomain_idx`(`subdomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_keys` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `secretRef` VARCHAR(191) NOT NULL,
    `scopes` JSON NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedBy` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `api_keys_tenantId_idx`(`tenantId`),
    INDEX `api_keys_provider_idx`(`provider`),
    INDEX `api_keys_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `jti` VARCHAR(255) NULL,
    `token` LONGTEXT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_jti_key`(`jti`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_resets_token_key`(`token`),
    INDEX `password_resets_userId_idx`(`userId`),
    INDEX `password_resets_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_suspensions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `suspendedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `liftedAt` DATETIME(3) NULL,

    INDEX `user_suspensions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `marketingEmails` BOOLEAN NOT NULL DEFAULT true,
    `transactionalEmails` BOOLEAN NOT NULL DEFAULT true,
    `propertyAlerts` BOOLEAN NOT NULL DEFAULT true,
    `paymentReminders` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `email_preferences_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_endpoints` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `device_endpoints_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `socials` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `socialId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `socials_userId_idx`(`userId`),
    INDEX `socials_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `socials_provider_socialId_key`(`provider`, `socialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauth_states` (
    `id` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `oauth_states_state_key`(`state`),
    INDEX `oauth_states_state_idx`(`state`),
    INDEX `oauth_states_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `balance` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `wallets_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `transactions_walletId_idx`(`walletId`),
    INDEX `transactions_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `category` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `settings_category_idx`(`category`),
    INDEX `settings_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `settings_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `properties` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `propertyType` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NULL,
    `zipCode` VARCHAR(191) NULL,
    `streetAddress` VARCHAR(191) NULL,
    `longitude` DOUBLE NULL,
    `latitude` DOUBLE NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `description` TEXT NULL,
    `displayImageId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `properties_tenantId_idx`(`tenantId`),
    INDEX `properties_userId_idx`(`userId`),
    INDEX `properties_organizationId_idx`(`organizationId`),
    INDEX `properties_category_idx`(`category`),
    INDEX `properties_propertyType_idx`(`propertyType`),
    INDEX `properties_city_idx`(`city`),
    INDEX `properties_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_media` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_media_tenantId_idx`(`tenantId`),
    INDEX `property_media_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_documents_tenantId_idx`(`tenantId`),
    INDEX `property_documents_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `amenities` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `amenities_tenantId_idx`(`tenantId`),
    INDEX `amenities_category_idx`(`category`),
    UNIQUE INDEX `amenities_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_variants` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `nBedrooms` INTEGER NULL,
    `nBathrooms` INTEGER NULL,
    `nParkingSpots` INTEGER NULL,
    `area` DOUBLE NULL,
    `price` DOUBLE NOT NULL,
    `pricePerSqm` DOUBLE NULL,
    `totalUnits` INTEGER NOT NULL DEFAULT 1,
    `availableUnits` INTEGER NOT NULL DEFAULT 1,
    `reservedUnits` INTEGER NOT NULL DEFAULT 0,
    `soldUnits` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_variants_tenantId_idx`(`tenantId`),
    INDEX `property_variants_propertyId_idx`(`propertyId`),
    INDEX `property_variants_status_idx`(`status`),
    INDEX `property_variants_price_idx`(`price`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_variant_amenities` (
    `tenantId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `amenityId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `property_variant_amenities_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`variantId`, `amenityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_variant_media` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_variant_media_tenantId_idx`(`tenantId`),
    INDEX `property_variant_media_variantId_idx`(`variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_units` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `unitNumber` VARCHAR(191) NOT NULL,
    `floorNumber` INTEGER NULL,
    `blockName` VARCHAR(191) NULL,
    `priceOverride` DOUBLE NULL,
    `areaOverride` DOUBLE NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    `reservedAt` DATETIME(3) NULL,
    `reservedUntil` DATETIME(3) NULL,
    `reservedById` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_units_tenantId_idx`(`tenantId`),
    INDEX `property_units_variantId_idx`(`variantId`),
    INDEX `property_units_status_idx`(`status`),
    UNIQUE INDEX `property_units_variantId_unitNumber_key`(`variantId`, `unitNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_amenities` (
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `amenityId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `property_amenities_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`propertyId`, `amenityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `documentation_plans_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `documentation_plans_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `uploadedBy` ENUM('CUSTOMER', 'LENDER', 'DEVELOPER', 'LEGAL', 'INSURER', 'PLATFORM') NOT NULL DEFAULT 'CUSTOMER',
    `order` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `maxSizeBytes` INTEGER NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `expiryDays` INTEGER NULL,
    `minFiles` INTEGER NOT NULL DEFAULT 1,
    `maxFiles` INTEGER NOT NULL DEFAULT 1,
    `condition` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_definitions_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_stages` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `organizationTypeId` VARCHAR(191) NOT NULL,
    `autoTransition` BOOLEAN NOT NULL DEFAULT false,
    `waitForAllDocuments` BOOLEAN NOT NULL DEFAULT true,
    `allowEarlyVisibility` BOOLEAN NOT NULL DEFAULT false,
    `onRejection` ENUM('CASCADE_BACK', 'RESTART_CURRENT', 'RESTART_FROM_STAGE') NOT NULL DEFAULT 'CASCADE_BACK',
    `restartFromStageOrder` INTEGER NULL,
    `slaHours` INTEGER NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_stages_planId_idx`(`planId`),
    INDEX `approval_stages_organizationTypeId_idx`(`organizationTypeId`),
    UNIQUE INDEX `approval_stages_planId_order_key`(`planId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `passingScore` INTEGER NULL,
    `scoringStrategy` ENUM('SUM', 'AVERAGE', 'WEIGHTED_SUM', 'MIN_ALL', 'CUSTOM') NOT NULL DEFAULT 'SUM',
    `autoDecisionEnabled` BOOLEAN NOT NULL DEFAULT false,
    `estimatedMinutes` INTEGER NULL,
    `category` ENUM('PREQUALIFICATION', 'AFFORDABILITY', 'PROPERTY_INTENT', 'RISK_ASSESSMENT', 'COMPLIANCE', 'CUSTOM') NOT NULL DEFAULT 'PREQUALIFICATION',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questionnaire_plans_tenantId_idx`(`tenantId`),
    INDEX `questionnaire_plans_category_idx`(`category`),
    UNIQUE INDEX `questionnaire_plans_tenantId_name_version_key`(`tenantId`, `name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_plan_questions` (
    `id` VARCHAR(191) NOT NULL,
    `questionnairePlanId` VARCHAR(191) NOT NULL,
    `questionKey` VARCHAR(191) NOT NULL,
    `questionText` TEXT NOT NULL,
    `helpText` TEXT NULL,
    `questionType` ENUM('TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'FILE_UPLOAD', 'PHONE', 'EMAIL', 'ADDRESS', 'PERCENTAGE', 'YEARS_MONTHS') NOT NULL,
    `order` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `validationRules` JSON NULL,
    `options` JSON NULL,
    `scoreWeight` INTEGER NOT NULL DEFAULT 1,
    `scoringRules` JSON NULL,
    `showIf` JSON NULL,
    `category` ENUM('ELIGIBILITY', 'EMPLOYMENT', 'INCOME', 'AFFORDABILITY', 'EXPENSES', 'APPLICATION_TYPE', 'PERSONAL', 'PREFERENCES', 'PROPERTY', 'CREDIT', 'ASSETS', 'CUSTOM') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questionnaire_plan_questions_questionnairePlanId_idx`(`questionnairePlanId`),
    UNIQUE INDEX `questionnaire_plan_questions_questionnairePlanId_questionKey_key`(`questionnairePlanId`, `questionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_plans` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `paymentFrequency` ENUM('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'ONE_TIME', 'CUSTOM') NOT NULL,
    `customFrequencyDays` INTEGER NULL,
    `numberOfInstallments` INTEGER NULL,
    `calculateInterestDaily` BOOLEAN NOT NULL DEFAULT false,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 0,
    `allowFlexibleTerm` BOOLEAN NOT NULL DEFAULT false,
    `minTermMonths` INTEGER NULL,
    `maxTermMonths` INTEGER NULL,
    `termStepMonths` INTEGER NULL,
    `maxAgeAtMaturity` INTEGER NULL,
    `collectFunds` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_plans_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `payment_plans_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_payment_methods` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `allowEarlyPayoff` BOOLEAN NOT NULL DEFAULT true,
    `earlyPayoffPenaltyRate` DOUBLE NULL,
    `autoActivatePhases` BOOLEAN NOT NULL DEFAULT true,
    `requiresManualApproval` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_payment_methods_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `property_payment_methods_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_payment_method_links` (
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `property_payment_method_links_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`propertyId`, `paymentMethodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_payment_method_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `paymentPlanId` VARCHAR(191) NULL,
    `documentationPlanId` VARCHAR(191) NULL,
    `questionnairePlanId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT') NOT NULL,
    `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM') NOT NULL,
    `order` INTEGER NOT NULL,
    `interestRate` DOUBLE NULL,
    `percentOfPrice` DOUBLE NULL,
    `collectFunds` BOOLEAN NULL,
    `requiresPreviousPhaseCompletion` BOOLEAN NOT NULL DEFAULT true,
    `minimumCompletionPercentage` DOUBLE NULL,
    `completionCriterion` ENUM('DOCUMENT_APPROVALS', 'PAYMENT_AMOUNT', 'STEPS_COMPLETED') NULL,
    `lockUnitOnComplete` BOOLEAN NOT NULL DEFAULT false,
    `stepDefinitionsSnapshot` JSON NULL,
    `requiredDocumentSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_payment_method_phases_tenantId_idx`(`tenantId`),
    INDEX `property_payment_method_phases_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `property_payment_method_phases_paymentPlanId_idx`(`paymentPlanId`),
    INDEX `property_payment_method_phases_documentationPlanId_idx`(`documentationPlanId`),
    INDEX `property_payment_method_phases_questionnairePlanId_idx`(`questionnairePlanId`),
    INDEX `property_payment_method_phases_phaseCategory_idx`(`phaseCategory`),
    UNIQUE INDEX `property_payment_method_phases_paymentMethodId_order_key`(`paymentMethodId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phase_event_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `trigger` ENUM('ON_ACTIVATE', 'ON_COMPLETE', 'ON_CANCEL', 'ON_PAYMENT_RECEIVED', 'ON_ALL_PAYMENTS_RECEIVED') NOT NULL,
    `handlerId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `phase_event_attachments_tenantId_idx`(`tenantId`),
    INDEX `phase_event_attachments_phaseId_idx`(`phaseId`),
    INDEX `phase_event_attachments_handlerId_idx`(`handlerId`),
    UNIQUE INDEX `phase_event_attachments_phaseId_handlerId_trigger_key`(`phaseId`, `handlerId`, `trigger`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_phase_steps` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `stepType` ENUM('UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT', 'PRE_APPROVAL', 'UNDERWRITING', 'GATE') NOT NULL,
    `order` INTEGER NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_phase_steps_tenantId_idx`(`tenantId`),
    INDEX `payment_method_phase_steps_phaseId_idx`(`phaseId`),
    UNIQUE INDEX `payment_method_phase_steps_phaseId_order_key`(`phaseId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `step_event_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `trigger` ENUM('ON_COMPLETE', 'ON_REJECT', 'ON_SUBMIT', 'ON_RESUBMIT', 'ON_START') NOT NULL,
    `handlerId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `step_event_attachments_tenantId_idx`(`tenantId`),
    INDEX `step_event_attachments_stepId_idx`(`stepId`),
    INDEX `step_event_attachments_handlerId_idx`(`handlerId`),
    UNIQUE INDEX `step_event_attachments_stepId_handlerId_trigger_key`(`stepId`, `handlerId`, `trigger`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_phase_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `maxSizeBytes` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_method_phase_documents_tenantId_idx`(`tenantId`),
    INDEX `payment_method_phase_documents_phaseId_documentType_idx`(`phaseId`, `documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_phase_fields` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `placeholder` VARCHAR(191) NULL,
    `fieldType` ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'EMAIL', 'PHONE', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'FILE') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL,
    `validation` JSON NULL,
    `displayCondition` JSON NULL,
    `defaultValue` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_phase_fields_tenantId_idx`(`tenantId`),
    INDEX `payment_method_phase_fields_phaseId_idx`(`phaseId`),
    UNIQUE INDEX `payment_method_phase_fields_phaseId_name_key`(`phaseId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `propertyUnitId` VARCHAR(191) NOT NULL,
    `buyerId` VARCHAR(191) NOT NULL,
    `sellerId` VARCHAR(191) NULL,
    `paymentMethodId` VARCHAR(191) NULL,
    `paymentMethodSnapshot` JSON NULL,
    `paymentMethodSnapshotAt` DATETIME(3) NULL,
    `paymentMethodSnapshotHash` VARCHAR(191) NULL,
    `applicationNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `applicationType` VARCHAR(191) NOT NULL,
    `totalAmount` DOUBLE NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED', 'TRANSFERRED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `currentPhaseId` VARCHAR(191) NULL,
    `nextPaymentDueDate` DATETIME(3) NULL,
    `lastReminderSentAt` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `signedAt` DATETIME(3) NULL,
    `terminatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `transferredFromId` VARCHAR(191) NULL,
    `supersededById` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,

    UNIQUE INDEX `applications_applicationNumber_key`(`applicationNumber`),
    UNIQUE INDEX `applications_transferredFromId_key`(`transferredFromId`),
    INDEX `applications_tenantId_idx`(`tenantId`),
    INDEX `applications_propertyUnitId_idx`(`propertyUnitId`),
    INDEX `applications_buyerId_idx`(`buyerId`),
    INDEX `applications_sellerId_idx`(`sellerId`),
    INDEX `applications_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `applications_status_idx`(`status`),
    INDEX `applications_currentPhaseId_idx`(`currentPhaseId`),
    INDEX `applications_supersededById_idx`(`supersededById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_organizations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `assignedAsTypeId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'DECLINED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
    `assignedById` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `offeredTerms` JSON NULL,
    `termsOfferedAt` DATETIME(3) NULL,
    `termsAcceptedAt` DATETIME(3) NULL,
    `termsDeclinedAt` DATETIME(3) NULL,
    `declineReason` TEXT NULL,
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `withdrawnAt` DATETIME(3) NULL,
    `slaHours` INTEGER NULL,
    `slaStartedAt` DATETIME(3) NULL,
    `slaBreachedAt` DATETIME(3) NULL,
    `slaBreachNotified` BOOLEAN NOT NULL DEFAULT false,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `lastReminderSentAt` DATETIME(3) NULL,
    `nextReminderAt` DATETIME(3) NULL,
    `escalatedAt` DATETIME(3) NULL,
    `escalatedToUserId` VARCHAR(191) NULL,
    `escalationNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_organizations_tenantId_idx`(`tenantId`),
    INDEX `application_organizations_applicationId_idx`(`applicationId`),
    INDEX `application_organizations_organizationId_idx`(`organizationId`),
    INDEX `application_organizations_assignedAsTypeId_idx`(`assignedAsTypeId`),
    INDEX `application_organizations_status_idx`(`status`),
    INDEX `application_organizations_isPrimary_idx`(`isPrimary`),
    INDEX `application_organizations_slaBreachedAt_idx`(`slaBreachedAt`),
    UNIQUE INDEX `application_organizations_applicationId_assignedAsTypeId_key`(`applicationId`, `assignedAsTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_refunds` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `requestedById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `processedById` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientAccount` VARCHAR(191) NULL,
    `recipientBank` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `approvalNotes` TEXT NULL,
    `rejectionNotes` TEXT NULL,
    `processingNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_refunds_applicationId_idx`(`applicationId`),
    INDEX `application_refunds_status_idx`(`status`),
    INDEX `application_refunds_tenantId_idx`(`tenantId`),
    INDEX `application_refunds_requestedById_idx`(`requestedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `phaseTemplateId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `phaseCategory` ENUM('QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT') NOT NULL,
    `phaseType` ENUM('PRE_APPROVAL', 'UNDERWRITING', 'KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM') NOT NULL,
    `order` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'FAILED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `requiresPreviousPhaseCompletion` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_phases_tenantId_idx`(`tenantId`),
    INDEX `application_phases_applicationId_idx`(`applicationId`),
    INDEX `application_phases_phaseTemplateId_idx`(`phaseTemplateId`),
    INDEX `application_phases_phaseCategory_idx`(`phaseCategory`),
    INDEX `application_phases_status_idx`(`status`),
    INDEX `application_phases_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `questionnairePlanId` VARCHAR(191) NULL,
    `completedFieldsCount` INTEGER NOT NULL DEFAULT 0,
    `totalFieldsCount` INTEGER NOT NULL DEFAULT 0,
    `totalScore` INTEGER NULL,
    `passingScore` INTEGER NULL,
    `passed` BOOLEAN NULL,
    `scoredAt` DATETIME(3) NULL,
    `underwritingScore` DOUBLE NULL,
    `debtToIncomeRatio` DOUBLE NULL,
    `underwritingDecision` VARCHAR(191) NULL,
    `underwritingNotes` TEXT NULL,
    `fieldsSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `questionnaire_phases_phaseId_key`(`phaseId`),
    INDEX `questionnaire_phases_tenantId_idx`(`tenantId`),
    INDEX `questionnaire_phases_phaseId_idx`(`phaseId`),
    INDEX `questionnaire_phases_questionnairePlanId_idx`(`questionnairePlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_phase_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `questionnairePhaseId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED') NOT NULL,
    `notes` TEXT NULL,
    `scoreAtReview` INTEGER NULL,
    `passedAtReview` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `questionnaire_phase_reviews_tenantId_idx`(`tenantId`),
    INDEX `questionnaire_phase_reviews_questionnairePhaseId_idx`(`questionnairePhaseId`),
    INDEX `questionnaire_phase_reviews_reviewerId_idx`(`reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentation_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `documentationPlanId` VARCHAR(191) NULL,
    `sourceQuestionnairePhaseId` VARCHAR(191) NULL,
    `currentStageOrder` INTEGER NOT NULL DEFAULT 1,
    `approvedDocumentsCount` INTEGER NOT NULL DEFAULT 0,
    `requiredDocumentsCount` INTEGER NOT NULL DEFAULT 0,
    `documentDefinitionsSnapshot` JSON NULL,
    `approvalStagesSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `documentation_phases_phaseId_key`(`phaseId`),
    INDEX `documentation_phases_tenantId_idx`(`tenantId`),
    INDEX `documentation_phases_phaseId_idx`(`phaseId`),
    INDEX `documentation_phases_sourceQuestionnairePhaseId_idx`(`sourceQuestionnairePhaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_phases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `paymentPlanId` VARCHAR(191) NULL,
    `totalAmount` DOUBLE NOT NULL,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `interestRate` DOUBLE NOT NULL DEFAULT 0,
    `selectedTermMonths` INTEGER NULL,
    `numberOfInstallments` INTEGER NULL,
    `collectFunds` BOOLEAN NOT NULL DEFAULT true,
    `minimumCompletionPercentage` DOUBLE NULL,
    `paymentPlanSnapshot` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_phases_phaseId_key`(`phaseId`),
    INDEX `payment_phases_tenantId_idx`(`tenantId`),
    INDEX `payment_phases_phaseId_idx`(`phaseId`),
    INDEX `payment_phases_paymentPlanId_idx`(`paymentPlanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questionnaire_fields` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `questionnairePhaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `placeholder` VARCHAR(191) NULL,
    `fieldType` ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'CURRENCY', 'EMAIL', 'PHONE', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'FILE') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL,
    `validation` JSON NULL,
    `displayCondition` JSON NULL,
    `defaultValue` JSON NULL,
    `answer` JSON NULL,
    `isValid` BOOLEAN NOT NULL DEFAULT false,
    `validationErrors` JSON NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questionnaire_fields_tenantId_idx`(`tenantId`),
    INDEX `questionnaire_fields_questionnairePhaseId_idx`(`questionnairePhaseId`),
    UNIQUE INDEX `questionnaire_fields_questionnairePhaseId_name_key`(`questionnairePhaseId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('APPLICATION_CREATED', 'APPLICATION_STATE_CHANGED', 'PHASE_ACTIVATED', 'PHASE_COMPLETED', 'STEP_COMPLETED', 'STEP_REJECTED', 'DOCUMENT_SUBMITTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'PAYMENT_INITIATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'INSTALLMENTS_GENERATED', 'APPLICATION_SIGNED', 'APPLICATION_TERMINATED', 'APPLICATION_TRANSFERRED', 'UNDERWRITING_COMPLETED', 'OFFER_LETTER_GENERATED', 'HANDLER_EXECUTED') NOT NULL,
    `eventGroup` ENUM('STATE_CHANGE', 'PAYMENT', 'DOCUMENT', 'NOTIFICATION', 'WORKFLOW', 'AUTOMATION') NULL,
    `fromState` VARCHAR(191) NULL,
    `toState` VARCHAR(191) NULL,
    `trigger` VARCHAR(191) NULL,
    `data` JSON NULL,
    `actorId` VARCHAR(191) NULL,
    `actorType` ENUM('USER', 'SYSTEM', 'WEBHOOK', 'ADMIN') NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_events_tenantId_idx`(`tenantId`),
    INDEX `application_events_applicationId_idx`(`applicationId`),
    INDEX `application_events_eventType_idx`(`eventType`),
    INDEX `application_events_eventGroup_idx`(`eventGroup`),
    INDEX `application_events_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_installments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `paymentPhaseId` VARCHAR(191) NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `principalAmount` DOUBLE NOT NULL DEFAULT 0,
    `interestAmount` DOUBLE NOT NULL DEFAULT 0,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'WAIVED') NOT NULL DEFAULT 'PENDING',
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `paidDate` DATETIME(3) NULL,
    `lateFee` DOUBLE NOT NULL DEFAULT 0,
    `lateFeeWaived` BOOLEAN NOT NULL DEFAULT false,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 0,
    `gracePeriodEndDate` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_installments_tenantId_idx`(`tenantId`),
    INDEX `payment_installments_paymentPhaseId_idx`(`paymentPhaseId`),
    INDEX `payment_installments_dueDate_idx`(`dueDate`),
    INDEX `payment_installments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_payments` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `installmentId` VARCHAR(191) NULL,
    `payerId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `principalAmount` DOUBLE NOT NULL DEFAULT 0,
    `interestAmount` DOUBLE NOT NULL DEFAULT 0,
    `lateFeeAmount` DOUBLE NOT NULL DEFAULT 0,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `status` ENUM('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'INITIATED',
    `reference` VARCHAR(191) NULL,
    `gatewayResponse` TEXT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `application_payments_reference_key`(`reference`),
    INDEX `application_payments_tenantId_idx`(`tenantId`),
    INDEX `application_payments_applicationId_idx`(`applicationId`),
    INDEX `application_payments_phaseId_idx`(`phaseId`),
    INDEX `application_payments_installmentId_idx`(`installmentId`),
    INDEX `application_payments_payerId_idx`(`payerId`),
    INDEX `application_payments_status_idx`(`status`),
    INDEX `application_payments_reference_idx`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `stepId` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NULL,
    `documentName` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `expectedUploader` ENUM('CUSTOMER', 'LENDER', 'DEVELOPER', 'LEGAL', 'INSURER', 'PLATFORM') NULL,
    `expectedOrganizationId` VARCHAR(191) NULL,
    `documentDate` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `expiryDays` INTEGER NULL,
    `isExpired` BOOLEAN NOT NULL DEFAULT false,
    `expiredAt` DATETIME(3) NULL,
    `expiryWarningAt` DATETIME(3) NULL,
    `revalidatedAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'PENDING_SIGNATURE', 'SENT', 'VIEWED', 'SIGNED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'NEEDS_REUPLOAD') NOT NULL DEFAULT 'PENDING',
    `version` INTEGER NOT NULL DEFAULT 1,
    `replacesDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `application_documents_tenantId_idx`(`tenantId`),
    INDEX `application_documents_applicationId_idx`(`applicationId`),
    INDEX `application_documents_phaseId_idx`(`phaseId`),
    INDEX `application_documents_stepId_idx`(`stepId`),
    INDEX `application_documents_type_idx`(`type`),
    INDEX `application_documents_documentType_idx`(`documentType`),
    INDEX `application_documents_status_idx`(`status`),
    INDEX `application_documents_replacesDocumentId_idx`(`replacesDocumentId`),
    INDEX `application_documents_isExpired_idx`(`isExpired`),
    INDEX `application_documents_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `organizationTypeId` VARCHAR(191) NULL,
    `reviewerId` VARCHAR(191) NULL,
    `reviewerName` VARCHAR(191) NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED') NOT NULL DEFAULT 'PENDING',
    `comments` TEXT NULL,
    `concerns` JSON NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewOrder` INTEGER NOT NULL DEFAULT 0,
    `parentReviewId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_reviews_tenantId_idx`(`tenantId`),
    INDEX `document_reviews_documentId_idx`(`documentId`),
    INDEX `document_reviews_organizationId_idx`(`organizationId`),
    INDEX `document_reviews_organizationTypeId_idx`(`organizationTypeId`),
    INDEX `document_reviews_decision_idx`(`decision`),
    INDEX `document_reviews_reviewerId_idx`(`reviewerId`),
    INDEX `document_reviews_parentReviewId_idx`(`parentReviewId`),
    UNIQUE INDEX `document_reviews_documentId_organizationId_key`(`documentId`, `organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_stage_progress` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentationPhaseId` VARCHAR(191) NOT NULL,
    `approvalStageId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `organizationTypeId` VARCHAR(191) NOT NULL,
    `autoTransition` BOOLEAN NOT NULL DEFAULT false,
    `waitForAllDocuments` BOOLEAN NOT NULL DEFAULT true,
    `allowEarlyVisibility` BOOLEAN NOT NULL DEFAULT false,
    `onRejection` ENUM('CASCADE_BACK', 'RESTART_CURRENT', 'RESTART_FROM_STAGE') NOT NULL DEFAULT 'CASCADE_BACK',
    `restartFromStageOrder` INTEGER NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_TRANSITION', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `activatedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` VARCHAR(191) NULL,
    `transitionComment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_stage_progress_tenantId_idx`(`tenantId`),
    INDEX `approval_stage_progress_documentationPhaseId_idx`(`documentationPhaseId`),
    INDEX `approval_stage_progress_approvalStageId_idx`(`approvalStageId`),
    INDEX `approval_stage_progress_status_idx`(`status`),
    UNIQUE INDEX `approval_stage_progress_documentationPhaseId_order_key`(`documentationPhaseId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `stageProgressId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `organizationTypeId` VARCHAR(191) NOT NULL,
    `decision` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WAIVED') NOT NULL,
    `comment` TEXT NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_approvals_tenantId_idx`(`tenantId`),
    INDEX `document_approvals_documentId_idx`(`documentId`),
    INDEX `document_approvals_stageProgressId_idx`(`stageProgressId`),
    INDEX `document_approvals_reviewerId_idx`(`reviewerId`),
    INDEX `document_approvals_organizationTypeId_idx`(`organizationTypeId`),
    INDEX `document_approvals_decision_idx`(`decision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `htmlTemplate` TEXT NOT NULL,
    `cssStyles` TEXT NULL,
    `mergeFields` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_templates_tenantId_idx`(`tenantId`),
    INDEX `document_templates_code_idx`(`code`),
    UNIQUE INDEX `document_templates_tenantId_code_version_key`(`tenantId`, `code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_letters` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `letterNumber` VARCHAR(191) NOT NULL,
    `type` ENUM('PROVISIONAL', 'FINAL') NOT NULL,
    `status` ENUM('DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `htmlContent` TEXT NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `pdfKey` VARCHAR(191) NULL,
    `mergeData` JSON NULL,
    `sentAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `signedAt` DATETIME(3) NULL,
    `signatureIp` VARCHAR(191) NULL,
    `signatureData` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `generatedById` VARCHAR(191) NULL,
    `sentById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offer_letters_letterNumber_key`(`letterNumber`),
    INDEX `offer_letters_tenantId_idx`(`tenantId`),
    INDEX `offer_letters_applicationId_idx`(`applicationId`),
    INDEX `offer_letters_type_idx`(`type`),
    INDEX `offer_letters_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_terminations` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `requestNumber` VARCHAR(191) NOT NULL,
    `initiatedBy` ENUM('BUYER', 'SELLER', 'ADMIN', 'SYSTEM') NOT NULL,
    `initiatorId` VARCHAR(191) NULL,
    `type` ENUM('BUYER_WITHDRAWAL', 'SELLER_WITHDRAWAL', 'MUTUAL_AGREEMENT', 'PAYMENT_DEFAULT', 'DOCUMENT_FAILURE', 'FRAUD', 'FORCE_MAJEURE', 'PROPERTY_UNAVAILABLE', 'REGULATORY', 'OTHER') NOT NULL,
    `reason` TEXT NULL,
    `supportingDocs` JSON NULL,
    `status` ENUM('REQUESTED', 'PENDING_REVIEW', 'PENDING_REFUND', 'REFUND_IN_PROGRESS', 'REFUND_COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `requiresApproval` BOOLEAN NOT NULL DEFAULT true,
    `autoApproveEligible` BOOLEAN NOT NULL DEFAULT false,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `applicationSnapshot` JSON NOT NULL,
    `totalApplicationAmount` DOUBLE NOT NULL,
    `totalPaidToDate` DOUBLE NOT NULL,
    `outstandingBalance` DOUBLE NOT NULL,
    `refundableAmount` DOUBLE NOT NULL DEFAULT 0,
    `penaltyAmount` DOUBLE NOT NULL DEFAULT 0,
    `forfeitedAmount` DOUBLE NOT NULL DEFAULT 0,
    `adminFeeAmount` DOUBLE NOT NULL DEFAULT 0,
    `netRefundAmount` DOUBLE NOT NULL DEFAULT 0,
    `settlementNotes` TEXT NULL,
    `refundStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `refundReference` VARCHAR(191) NULL,
    `refundMethod` VARCHAR(191) NULL,
    `refundAccountDetails` JSON NULL,
    `refundInitiatedAt` DATETIME(3) NULL,
    `refundCompletedAt` DATETIME(3) NULL,
    `refundFailureReason` TEXT NULL,
    `unitReleasedAt` DATETIME(3) NULL,
    `unitReservedForId` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `application_terminations_requestNumber_key`(`requestNumber`),
    UNIQUE INDEX `application_terminations_idempotencyKey_key`(`idempotencyKey`),
    INDEX `application_terminations_applicationId_idx`(`applicationId`),
    INDEX `application_terminations_tenantId_idx`(`tenantId`),
    INDEX `application_terminations_status_idx`(`status`),
    INDEX `application_terminations_type_idx`(`type`),
    INDEX `application_terminations_initiatorId_idx`(`initiatorId`),
    INDEX `application_terminations_requestedAt_idx`(`requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_change_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `fromPaymentMethodId` VARCHAR(191) NOT NULL,
    `toPaymentMethodId` VARCHAR(191) NOT NULL,
    `requestorId` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `requiredDocumentTypes` VARCHAR(191) NULL,
    `submittedDocuments` JSON NULL,
    `currentOutstanding` DOUBLE NULL,
    `newTermMonths` INTEGER NULL,
    `newInterestRate` DOUBLE NULL,
    `newMonthlyPayment` DOUBLE NULL,
    `penaltyAmount` DOUBLE NULL,
    `financialImpactNotes` TEXT NULL,
    `status` ENUM('PENDING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_DOCUMENTS',
    `reviewerId` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `executedAt` DATETIME(3) NULL,
    `previousPhaseData` JSON NULL,
    `newPhaseData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_method_change_requests_tenantId_idx`(`tenantId`),
    INDEX `payment_method_change_requests_applicationId_idx`(`applicationId`),
    INDEX `payment_method_change_requests_status_idx`(`status`),
    INDEX `payment_method_change_requests_requestorId_idx`(`requestorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_requirement_rules` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `context` ENUM('APPLICATION_PHASE', 'PAYMENT_METHOD_CHANGE') NOT NULL,
    `paymentMethodId` VARCHAR(191) NULL,
    `phaseType` VARCHAR(191) NULL,
    `fromPaymentMethodId` VARCHAR(191) NULL,
    `toPaymentMethodId` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `maxSizeBytes` INTEGER NULL,
    `allowedMimeTypes` VARCHAR(191) NULL,
    `expiryDays` INTEGER NULL,
    `requiresManualReview` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `document_requirement_rules_tenantId_idx`(`tenantId`),
    INDEX `document_requirement_rules_context_idx`(`context`),
    INDEX `document_requirement_rules_paymentMethodId_idx`(`paymentMethodId`),
    INDEX `document_requirement_rules_phaseType_idx`(`phaseType`),
    INDEX `document_requirement_rules_fromPaymentMethodId_toPaymentMeth_idx`(`fromPaymentMethodId`, `toPaymentMethodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_channels` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_channels_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `event_channels_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_types` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `payloadSchema` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_types_tenantId_idx`(`tenantId`),
    INDEX `event_types_channelId_idx`(`channelId`),
    UNIQUE INDEX `event_types_tenantId_code_key`(`tenantId`, `code`),
    UNIQUE INDEX `event_types_channelId_code_key`(`channelId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_handlers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `eventTypeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `handlerType` ENUM('SEND_EMAIL', 'SEND_SMS', 'SEND_PUSH', 'CALL_WEBHOOK', 'ADVANCE_WORKFLOW', 'RUN_AUTOMATION', 'LOCK_UNIT') NOT NULL,
    `config` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `retryDelayMs` INTEGER NOT NULL DEFAULT 1000,
    `filterCondition` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `event_handlers_tenantId_idx`(`tenantId`),
    INDEX `event_handlers_eventTypeId_idx`(`eventTypeId`),
    INDEX `event_handlers_handlerType_idx`(`handlerType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domain_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `aggregateType` VARCHAR(191) NOT NULL,
    `aggregateId` VARCHAR(191) NOT NULL,
    `queueName` VARCHAR(191) NOT NULL,
    `payload` TEXT NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorId` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `processedAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `domain_events_tenantId_idx`(`tenantId`),
    INDEX `domain_events_status_nextRetryAt_idx`(`status`, `nextRetryAt`),
    INDEX `domain_events_eventType_idx`(`eventType`),
    INDEX `domain_events_aggregateType_aggregateId_idx`(`aggregateType`, `aggregateId`),
    INDEX `domain_events_queueName_idx`(`queueName`),
    INDEX `domain_events_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_transfer_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sourceApplicationId` VARCHAR(191) NOT NULL,
    `targetPropertyUnitId` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `reviewNotes` TEXT NULL,
    `priceAdjustmentHandling` VARCHAR(191) NULL,
    `sourceTotalAmount` DOUBLE NULL,
    `targetTotalAmount` DOUBLE NULL,
    `priceAdjustment` DOUBLE NULL,
    `refundedAmount` DOUBLE NULL,
    `refundTransactionId` VARCHAR(191) NULL,
    `refundedAt` DATETIME(3) NULL,
    `targetApplicationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `property_transfer_requests_tenantId_idx`(`tenantId`),
    INDEX `property_transfer_requests_sourceApplicationId_idx`(`sourceApplicationId`),
    INDEX `property_transfer_requests_targetPropertyUnitId_idx`(`targetPropertyUnitId`),
    INDEX `property_transfer_requests_requestedById_idx`(`requestedById`),
    INDEX `property_transfer_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` ENUM('PROPERTY_TRANSFER', 'PROPERTY_UPDATE', 'USER_WORKFLOW', 'CREDIT_CHECK', 'APPLICATION_TERMINATION', 'REFUND_APPROVAL') NOT NULL,
    `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `payload` JSON NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `decision` ENUM('APPROVED', 'REJECTED', 'REQUEST_CHANGES') NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `approval_requests_tenantId_idx`(`tenantId`),
    INDEX `approval_requests_type_idx`(`type`),
    INDEX `approval_requests_status_idx`(`status`),
    INDEX `approval_requests_priority_idx`(`priority`),
    INDEX `approval_requests_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `approval_requests_requestedById_idx`(`requestedById`),
    INDEX `approval_requests_assigneeId_idx`(`assigneeId`),
    INDEX `approval_requests_createdAt_idx`(`createdAt`),
    INDEX `approval_requests_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_blockers` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `stepId` VARCHAR(191) NULL,
    `blockerActor` ENUM('CUSTOMER', 'ADMIN', 'SYSTEM', 'EXTERNAL') NOT NULL,
    `blockerCategory` ENUM('UPLOAD', 'RESUBMISSION', 'SIGNATURE', 'REVIEW', 'APPROVAL', 'PAYMENT', 'PROCESSING', 'EXTERNAL_CHECK', 'QUESTIONNAIRE') NOT NULL,
    `urgency` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `actionRequired` VARCHAR(500) NOT NULL,
    `context` TEXT NULL,
    `expectedByDate` DATETIME(3) NULL,
    `isOverdue` BOOLEAN NOT NULL DEFAULT false,
    `overdueAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `resolvedByActor` VARCHAR(191) NULL,
    `resolutionTrigger` VARCHAR(191) NULL,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `lastReminderAt` DATETIME(3) NULL,
    `nextReminderAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `workflow_blockers_tenantId_idx`(`tenantId`),
    INDEX `workflow_blockers_applicationId_idx`(`applicationId`),
    INDEX `workflow_blockers_phaseId_idx`(`phaseId`),
    INDEX `workflow_blockers_stepId_idx`(`stepId`),
    INDEX `workflow_blockers_blockerActor_idx`(`blockerActor`),
    INDEX `workflow_blockers_blockerCategory_idx`(`blockerCategory`),
    INDEX `workflow_blockers_urgency_idx`(`urgency`),
    INDEX `workflow_blockers_isOverdue_idx`(`isOverdue`),
    INDEX `workflow_blockers_startedAt_idx`(`startedAt`),
    INDEX `workflow_blockers_resolvedAt_idx`(`resolvedAt`),
    INDEX `workflow_blockers_tenantId_blockerActor_resolvedAt_idx`(`tenantId`, `blockerActor`, `resolvedAt`),
    INDEX `workflow_blockers_tenantId_blockerCategory_resolvedAt_idx`(`tenantId`, `blockerCategory`, `resolvedAt`),
    INDEX `workflow_blockers_tenantId_isOverdue_blockerActor_idx`(`tenantId`, `isOverdue`, `blockerActor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `jobType` ENUM('DOCUMENT_EXPIRY_CHECK', 'SLA_BREACH_CHECK', 'PAYMENT_REMINDER', 'DOCUMENT_EXPIRY_WARNING') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `scheduledAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `parameters` JSON NULL,
    `itemsProcessed` INTEGER NOT NULL DEFAULT 0,
    `itemsAffected` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `errors` JSON NULL,
    `summary` TEXT NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `nextRetryAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `scheduled_jobs_tenantId_idx`(`tenantId`),
    INDEX `scheduled_jobs_jobType_idx`(`jobType`),
    INDEX `scheduled_jobs_status_idx`(`status`),
    INDEX `scheduled_jobs_scheduledAt_idx`(`scheduledAt`),
    INDEX `scheduled_jobs_jobType_status_scheduledAt_idx`(`jobType`, `status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_expiry_warnings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `daysUntil` INTEGER NOT NULL,
    `warningSent` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notificationSent` BOOLEAN NOT NULL DEFAULT false,
    `notificationId` VARCHAR(191) NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `newDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_expiry_warnings_tenantId_idx`(`tenantId`),
    INDEX `document_expiry_warnings_documentId_idx`(`documentId`),
    INDEX `document_expiry_warnings_expiresAt_idx`(`expiresAt`),
    INDEX `document_expiry_warnings_resolved_idx`(`resolved`),
    UNIQUE INDEX `document_expiry_warnings_documentId_daysUntil_key`(`documentId`, `daysUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organization_types` ADD CONSTRAINT `organization_types_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_type_assignments` ADD CONSTRAINT `organization_type_assignments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_type_assignments` ADD CONSTRAINT `organization_type_assignments_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `organization_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `permissions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_document_requirements` ADD CONSTRAINT `bank_document_requirements_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_document_requirements` ADD CONSTRAINT `bank_document_requirements_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_document_requirements` ADD CONSTRAINT `bank_document_requirements_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_suspensions` ADD CONSTRAINT `user_suspensions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_preferences` ADD CONSTRAINT `email_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_endpoints` ADD CONSTRAINT `device_endpoints_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `socials` ADD CONSTRAINT `socials_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `socials` ADD CONSTRAINT `socials_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `properties` ADD CONSTRAINT `properties_displayImageId_fkey` FOREIGN KEY (`displayImageId`) REFERENCES `property_media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_media` ADD CONSTRAINT `property_media_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_media` ADD CONSTRAINT `property_media_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `amenities` ADD CONSTRAINT `amenities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variants` ADD CONSTRAINT `property_variants_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variants` ADD CONSTRAINT `property_variants_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_amenities` ADD CONSTRAINT `property_variant_amenities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_amenities` ADD CONSTRAINT `property_variant_amenities_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_amenities` ADD CONSTRAINT `property_variant_amenities_amenityId_fkey` FOREIGN KEY (`amenityId`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_media` ADD CONSTRAINT `property_variant_media_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_variant_media` ADD CONSTRAINT `property_variant_media_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_units` ADD CONSTRAINT `property_units_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_units` ADD CONSTRAINT `property_units_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `property_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_amenities` ADD CONSTRAINT `property_amenities_amenityId_fkey` FOREIGN KEY (`amenityId`) REFERENCES `amenities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_plans` ADD CONSTRAINT `documentation_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_definitions` ADD CONSTRAINT `document_definitions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `documentation_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stages` ADD CONSTRAINT `approval_stages_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `documentation_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stages` ADD CONSTRAINT `approval_stages_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_plans` ADD CONSTRAINT `questionnaire_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_plan_questions` ADD CONSTRAINT `questionnaire_plan_questions_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_plans` ADD CONSTRAINT `payment_plans_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_methods` ADD CONSTRAINT `property_payment_methods_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_links` ADD CONSTRAINT `property_payment_method_links_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_links` ADD CONSTRAINT `property_payment_method_links_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_links` ADD CONSTRAINT `property_payment_method_links_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_paymentPlanId_fkey` FOREIGN KEY (`paymentPlanId`) REFERENCES `payment_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_payment_method_phases` ADD CONSTRAINT `property_payment_method_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_event_attachments` ADD CONSTRAINT `phase_event_attachments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_event_attachments` ADD CONSTRAINT `phase_event_attachments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phase_event_attachments` ADD CONSTRAINT `phase_event_attachments_handlerId_fkey` FOREIGN KEY (`handlerId`) REFERENCES `event_handlers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_steps` ADD CONSTRAINT `payment_method_phase_steps_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_steps` ADD CONSTRAINT `payment_method_phase_steps_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `step_event_attachments` ADD CONSTRAINT `step_event_attachments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `step_event_attachments` ADD CONSTRAINT `step_event_attachments_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `payment_method_phase_steps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `step_event_attachments` ADD CONSTRAINT `step_event_attachments_handlerId_fkey` FOREIGN KEY (`handlerId`) REFERENCES `event_handlers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_documents` ADD CONSTRAINT `payment_method_phase_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_documents` ADD CONSTRAINT `payment_method_phase_documents_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_fields` ADD CONSTRAINT `payment_method_phase_fields_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_phase_fields` ADD CONSTRAINT `payment_method_phase_fields_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_propertyUnitId_fkey` FOREIGN KEY (`propertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_currentPhaseId_fkey` FOREIGN KEY (`currentPhaseId`) REFERENCES `application_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_transferredFromId_fkey` FOREIGN KEY (`transferredFromId`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_supersededById_fkey` FOREIGN KEY (`supersededById`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_organizations` ADD CONSTRAINT `application_organizations_assignedAsTypeId_fkey` FOREIGN KEY (`assignedAsTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_refunds` ADD CONSTRAINT `application_refunds_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_phases` ADD CONSTRAINT `application_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_phases` ADD CONSTRAINT `application_phases_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_phases` ADD CONSTRAINT `application_phases_phaseTemplateId_fkey` FOREIGN KEY (`phaseTemplateId`) REFERENCES `property_payment_method_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phases` ADD CONSTRAINT `questionnaire_phases_questionnairePlanId_fkey` FOREIGN KEY (`questionnairePlanId`) REFERENCES `questionnaire_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phase_reviews` ADD CONSTRAINT `questionnaire_phase_reviews_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phase_reviews` ADD CONSTRAINT `questionnaire_phase_reviews_questionnairePhaseId_fkey` FOREIGN KEY (`questionnairePhaseId`) REFERENCES `questionnaire_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_phase_reviews` ADD CONSTRAINT `questionnaire_phase_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_documentationPlanId_fkey` FOREIGN KEY (`documentationPlanId`) REFERENCES `documentation_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentation_phases` ADD CONSTRAINT `documentation_phases_sourceQuestionnairePhaseId_fkey` FOREIGN KEY (`sourceQuestionnairePhaseId`) REFERENCES `questionnaire_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_phases` ADD CONSTRAINT `payment_phases_paymentPlanId_fkey` FOREIGN KEY (`paymentPlanId`) REFERENCES `payment_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_fields` ADD CONSTRAINT `questionnaire_fields_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questionnaire_fields` ADD CONSTRAINT `questionnaire_fields_questionnairePhaseId_fkey` FOREIGN KEY (`questionnairePhaseId`) REFERENCES `questionnaire_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_events` ADD CONSTRAINT `application_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_events` ADD CONSTRAINT `application_events_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_installments` ADD CONSTRAINT `payment_installments_paymentPhaseId_fkey` FOREIGN KEY (`paymentPhaseId`) REFERENCES `payment_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `application_phases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `payment_installments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `application_payments_payerId_fkey` FOREIGN KEY (`payerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_documents` ADD CONSTRAINT `application_documents_replacesDocumentId_fkey` FOREIGN KEY (`replacesDocumentId`) REFERENCES `application_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `application_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_reviews` ADD CONSTRAINT `document_reviews_parentReviewId_fkey` FOREIGN KEY (`parentReviewId`) REFERENCES `document_reviews`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_documentationPhaseId_fkey` FOREIGN KEY (`documentationPhaseId`) REFERENCES `documentation_phases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_approvalStageId_fkey` FOREIGN KEY (`approvalStageId`) REFERENCES `approval_stages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_stage_progress` ADD CONSTRAINT `approval_stage_progress_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `application_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_stageProgressId_fkey` FOREIGN KEY (`stageProgressId`) REFERENCES `approval_stage_progress`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_approvals` ADD CONSTRAINT `document_approvals_organizationTypeId_fkey` FOREIGN KEY (`organizationTypeId`) REFERENCES `organization_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `document_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_letters` ADD CONSTRAINT `offer_letters_sentById_fkey` FOREIGN KEY (`sentById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_initiatorId_fkey` FOREIGN KEY (`initiatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_terminations` ADD CONSTRAINT `application_terminations_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_fromPaymentMethodId_fkey` FOREIGN KEY (`fromPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_toPaymentMethodId_fkey` FOREIGN KEY (`toPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_requestorId_fkey` FOREIGN KEY (`requestorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_change_requests` ADD CONSTRAINT `payment_method_change_requests_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_fromPaymentMethodId_fkey` FOREIGN KEY (`fromPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_requirement_rules` ADD CONSTRAINT `document_requirement_rules_toPaymentMethodId_fkey` FOREIGN KEY (`toPaymentMethodId`) REFERENCES `property_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_channels` ADD CONSTRAINT `event_channels_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_types` ADD CONSTRAINT `event_types_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_types` ADD CONSTRAINT `event_types_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `event_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handlers` ADD CONSTRAINT `event_handlers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_handlers` ADD CONSTRAINT `event_handlers_eventTypeId_fkey` FOREIGN KEY (`eventTypeId`) REFERENCES `event_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `domain_events` ADD CONSTRAINT `domain_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_sourceApplicationId_fkey` FOREIGN KEY (`sourceApplicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_targetPropertyUnitId_fkey` FOREIGN KEY (`targetPropertyUnitId`) REFERENCES `property_units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_transfer_requests` ADD CONSTRAINT `property_transfer_requests_targetApplicationId_fkey` FOREIGN KEY (`targetApplicationId`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_blockers` ADD CONSTRAINT `workflow_blockers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

