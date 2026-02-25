import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { loginSchema, signupSchema, refreshTokenSchema, authResponseSchema } from '../validators/auth.validator';

extendZodWithOpenApi(z);

// Create a registry for all API endpoints
export const registry = new OpenAPIRegistry();

// =============================================================================
// Common Schemas
// =============================================================================

const ApiErrorSchema = z.object({
    success: z.literal(false),
    error: z.object({
        message: z.string(),
        code: z.string().optional(),
    }),
}).openapi('ApiError');

const PaginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
}).openapi('Pagination');

// =============================================================================
// User Schemas
// =============================================================================

const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    isActive: z.boolean(),
    isEmailVerified: z.boolean(),
    tenantId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('User');

const UpdateUserSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    avatar: z.string().url().optional(),
    isActive: z.boolean().optional(),
}).openapi('UpdateUser');

const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
}).openapi('ChangePassword');

// =============================================================================
// Organization Schemas
// =============================================================================

const OrganizationTypeSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
}).openapi('OrganizationType');

const OrganizationSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    description: z.string().optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']),
    bankCode: z.string().optional(),
    bankLicenseNo: z.string().optional(),
    swiftCode: z.string().optional(),
    sortCode: z.string().optional(),
    cacNumber: z.string().optional(),
    taxId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('Organization');

const CreateOrganizationSchema = z.object({
    name: z.string().min(2).max(200),
    typeCodes: z.array(z.string()).min(1),
    primaryTypeCode: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    description: z.string().optional(),
    bankCode: z.string().optional(),
    bankLicenseNo: z.string().optional(),
    swiftCode: z.string().optional(),
    sortCode: z.string().optional(),
    cacNumber: z.string().optional(),
    taxId: z.string().optional(),
}).openapi('CreateOrganization');

const UpdateOrganizationSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    description: z.string().optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
    bankCode: z.string().optional(),
    bankLicenseNo: z.string().optional(),
    swiftCode: z.string().optional(),
    sortCode: z.string().optional(),
    cacNumber: z.string().optional(),
    taxId: z.string().optional(),
}).openapi('UpdateOrganization');

const OrganizationMemberSchema = z.object({
    id: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    title: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
    isActive: z.boolean(),
    joinedAt: z.string().datetime(),
}).openapi('OrganizationMember');

const AddMemberSchema = z.object({
    userId: z.string().min(1),
    roleId: z.string().optional().openapi({ description: 'Optional role ID to assign. If not provided, role is auto-detected based on organization type.' }),
    title: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
}).openapi('AddMember');

const UpdateMemberSchema = z.object({
    title: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
    isActive: z.boolean().optional(),
}).openapi('UpdateMember');

// =============================================================================
// Tenant Schemas
// =============================================================================

const TenantSchema = z.object({
    id: z.string(),
    name: z.string(),
    subdomain: z.string(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('Tenant');

// Register schemas
registry.register('User', UserSchema);
registry.register('Tenant', TenantSchema);
registry.register('ApiError', ApiErrorSchema);
registry.register('Pagination', PaginationSchema);
registry.register('Organization', OrganizationSchema);
registry.register('OrganizationType', OrganizationTypeSchema);
registry.register('OrganizationMember', OrganizationMemberSchema);

// =============================================================================
// Security Scheme
// =============================================================================

registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

// =============================================================================
// Auth Endpoints
// =============================================================================
registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    summary: 'Login with email and password',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: loginSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Login successful',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: authResponseSchema,
                    }),
                },
            },
        },
        401: {
            description: 'Invalid credentials',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string().optional(),
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/signup',
    tags: ['Auth'],
    summary: 'Register a new user account',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: signupSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Account created successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: authResponseSchema,
                    }),
                },
            },
        },
        409: {
            description: 'User already exists',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string().optional(),
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Auth'],
    summary: 'Refresh access token',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: refreshTokenSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Token refreshed successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: authResponseSchema,
                    }),
                },
            },
        },
        401: {
            description: 'Invalid or expired refresh token',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string().optional(),
                        }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// User Endpoints
// =============================================================================

registry.registerPath({
    method: 'get',
    path: '/users',
    tags: ['Users'],
    summary: 'List users with pagination',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.string().optional().openapi({ description: 'Page number' }),
            limit: z.string().optional().openapi({ description: 'Items per page' }),
            firstName: z.string().optional().openapi({ description: 'Filter by first name' }),
            lastName: z.string().optional().openapi({ description: 'Filter by last name' }),
            email: z.string().optional().openapi({ description: 'Filter by email' }),
        }),
    },
    responses: {
        200: {
            description: 'List of users',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({
                            items: z.array(UserSchema),
                            pagination: PaginationSchema,
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Get user by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'User ID' }),
        }),
    },
    responses: {
        200: {
            description: 'User details',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: UserSchema,
                    }),
                },
            },
        },
        404: {
            description: 'User not found',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'put',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Update user',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'User ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateUserSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'User updated successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: UserSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/users/profile',
    tags: ['Users'],
    summary: 'Update own profile',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        firstName: z.string().optional(),
                        lastName: z.string().optional(),
                        phone: z.string().optional(),
                        avatar: z.string().url().optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Profile updated successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: UserSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/users/change-password',
    tags: ['Users'],
    summary: 'Change password',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: ChangePasswordSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Password changed successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
        401: {
            description: 'Current password incorrect',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/users/{id}/suspend',
    tags: ['Users'],
    summary: 'Suspend a user',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'User ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        reason: z.string().optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'User suspended',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: UserSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/users/{id}/reinstate',
    tags: ['Users'],
    summary: 'Reinstate a suspended user',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'User ID' }),
        }),
    },
    responses: {
        200: {
            description: 'User reinstated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: UserSchema,
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Organization Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/organizations',
    tags: ['Organizations'],
    summary: 'Create a new organization',
    description: 'Admin only. Create a new organization with one or more types.',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateOrganizationSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Organization created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: OrganizationSchema,
                    }),
                },
            },
        },
        403: {
            description: 'Admin access required',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/organizations',
    tags: ['Organizations'],
    summary: 'List organizations',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.string().optional().openapi({ description: 'Page number' }),
            limit: z.string().optional().openapi({ description: 'Items per page' }),
            typeCode: z.string().optional().openapi({ description: 'Filter by organization type code (e.g., BANK, DEVELOPER)' }),
            status: z.string().optional().openapi({ description: 'Filter by status' }),
            search: z.string().optional().openapi({ description: 'Search by name or email' }),
        }),
    },
    responses: {
        200: {
            description: 'List of organizations',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({
                            items: z.array(OrganizationSchema),
                            pagination: PaginationSchema,
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/organizations/{id}',
    tags: ['Organizations'],
    summary: 'Get organization by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Organization details',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: OrganizationSchema,
                    }),
                },
            },
        },
        404: {
            description: 'Organization not found',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/organizations/{id}',
    tags: ['Organizations'],
    summary: 'Update organization',
    description: 'Admin only.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateOrganizationSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Organization updated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: OrganizationSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/organizations/{id}',
    tags: ['Organizations'],
    summary: 'Delete organization',
    description: 'Admin only. Soft delete.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Organization deleted',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: OrganizationSchema,
                    }),
                },
            },
        },
    },
});

// Organization Members

registry.registerPath({
    method: 'post',
    path: '/organizations/{id}/members',
    tags: ['Organizations'],
    summary: 'Add member to organization',
    description: 'Admin only.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: AddMemberSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Member added',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: OrganizationMemberSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/organizations/{id}/members',
    tags: ['Organizations'],
    summary: 'List organization members',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
    },
    responses: {
        200: {
            description: 'List of members',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.array(OrganizationMemberSchema),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/organizations/{orgId}/members/{memberId}',
    tags: ['Organizations'],
    summary: 'Update organization member',
    description: 'Admin only.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orgId: z.string().openapi({ description: 'Organization ID' }),
            memberId: z.string().openapi({ description: 'Member ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateMemberSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Member updated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: OrganizationMemberSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/organizations/{orgId}/members/{memberId}',
    tags: ['Organizations'],
    summary: 'Remove member from organization',
    description: 'Admin only.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orgId: z.string().openapi({ description: 'Organization ID' }),
            memberId: z.string().openapi({ description: 'Member ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Member removed',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Onboarding Schemas
// =============================================================================

const OnboardingPhaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    phaseCategory: z.enum(['QUESTIONNAIRE', 'DOCUMENTATION', 'GATE']),
    order: z.number(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'COMPLETED', 'SKIPPED', 'FAILED']),
    activatedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
}).openapi('OnboardingPhase');

const OnboardingSchema = z.object({
    id: z.string(),
    organizationId: z.string(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED']),
    assignee: z.object({
        id: z.string(),
        email: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
    }).optional(),
    phases: z.array(OnboardingPhaseSchema),
    expiresAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
}).openapi('Onboarding');

const SubmitQuestionnaireFieldsSchema = z.object({
    fields: z.array(z.object({
        fieldId: z.string(),
        value: z.any(),
    })).min(1),
}).openapi('SubmitQuestionnaireFields');

const ReviewGateSchema = z.object({
    decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
    notes: z.string().optional(),
}).openapi('ReviewGate');

const ReassignOnboarderSchema = z.object({
    newAssigneeId: z.string(),
}).openapi('ReassignOnboarder');

registry.register('Onboarding', OnboardingSchema);
registry.register('OnboardingPhase', OnboardingPhaseSchema);

// =============================================================================
// Onboarding Endpoints
// =============================================================================

registry.registerPath({
    method: 'get',
    path: '/organizations/{id}/onboarding',
    tags: ['Onboarding'],
    summary: 'Get organization onboarding status',
    description: 'Retrieve the full onboarding workflow status for an organization, including all phases and their extensions.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Onboarding details',
            content: {
                'application/json': {
                    schema: z.object({ success: z.literal(true), data: OnboardingSchema }),
                },
            },
        },
        404: { description: 'Onboarding not found' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/organizations/{id}/onboarding/start',
    tags: ['Onboarding'],
    summary: 'Start onboarding workflow',
    description: 'Start the onboarding workflow when an assignee has been set. Activates the first phase.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Onboarding started',
            content: {
                'application/json': {
                    schema: z.object({ success: z.literal(true), data: OnboardingSchema }),
                },
            },
        },
        400: { description: 'Cannot start (missing assignee or wrong status)' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/organizations/{id}/onboarding/phases/{phaseId}/questionnaire',
    tags: ['Onboarding'],
    summary: 'Submit questionnaire fields',
    description: 'Submit values for questionnaire fields in an onboarding phase. Auto-completes the phase when all required fields are filled.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
            phaseId: z.string().openapi({ description: 'Onboarding Phase ID' }),
        }),
        body: {
            content: { 'application/json': { schema: SubmitQuestionnaireFieldsSchema } },
        },
    },
    responses: {
        200: {
            description: 'Fields submitted, onboarding status updated',
            content: {
                'application/json': {
                    schema: z.object({ success: z.literal(true), data: OnboardingSchema }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/organizations/{id}/onboarding/phases/{phaseId}/gate/review',
    tags: ['Onboarding'],
    summary: 'Review gate phase',
    description: 'Admin reviews a gate phase (approve/reject). If approved and required approvals met, advances to next phase or completes onboarding.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
            phaseId: z.string().openapi({ description: 'Onboarding Phase ID' }),
        }),
        body: {
            content: { 'application/json': { schema: ReviewGateSchema } },
        },
    },
    responses: {
        200: {
            description: 'Review recorded',
            content: {
                'application/json': {
                    schema: z.object({ success: z.literal(true), data: OnboardingSchema }),
                },
            },
        },
        403: { description: 'Admin access required' },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/organizations/{id}/onboarding/reassign',
    tags: ['Onboarding'],
    summary: 'Reassign onboarder',
    description: 'Admin reassigns the onboarding to a different organization member.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Organization ID' }),
        }),
        body: {
            content: { 'application/json': { schema: ReassignOnboarderSchema } },
        },
    },
    responses: {
        200: {
            description: 'Onboarder reassigned',
            content: {
                'application/json': {
                    schema: z.object({ success: z.literal(true), data: OnboardingSchema }),
                },
            },
        },
        403: { description: 'Admin access required' },
    },
});

// Generate OpenAPI document
export function generateOpenAPIDocument(): OpenAPIObject {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '2.0.0',
            title: 'QShelter User Service API',
            description: 'User authentication and management service for QShelter platform',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local development server',
            },
            {
                url: 'https://api-dev.qshelter.com',
                description: 'Development server',
            },
            {
                url: 'https://api.qshelter.com',
                description: 'Production server',
            },
        ],
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Users', description: 'User management endpoints' },
            { name: 'Organizations', description: 'Organization management endpoints' },
            { name: 'Onboarding', description: 'Organization onboarding workflow endpoints' },
            { name: 'Tenants', description: 'Tenant management endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    });
}
