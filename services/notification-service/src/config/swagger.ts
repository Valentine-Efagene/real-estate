import {
    OpenAPIRegistry,
    OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { z } from 'zod';
import {
    SendEmailSchema,
    SendRawHtmlEmailSchema,
    AccountSuspendedSchema,
    AccountVerifiedSchema,
    MissedPaymentsSchema,
    PropertyAllocationSchema,
    ResetPasswordSchema,
    UpdatedTermsAndConditionsSchema,
    VerifyEmailSchema,
    WalletTopUpSchema,
    AdminContributionReceivedSchema,
    AdminPropertyAllocationSchema,
    AdminInviteAdminSchema,
    TestTempSchema,
} from '../validators/email.validator';
import { SendSmsSchema } from '../validators/sms.validator';
import {
    TokenRegistrationSchema,
    EndpointVerificationSchema,
    NotificationSchema,
} from '../validators/push.validator';
import { SendSlackMessageSchema } from '../validators/slack.validator';
import { SendWhatsAppMessageSchema } from '../validators/whatsapp.validator';
import {
    CreateEventHandlerSchema,
    UpdateEventHandlerSchema,
    EventHandlerResponseSchema,
    EventHandlerListResponseSchema,
} from '../validators/event-handler.validator';

const registry = new OpenAPIRegistry();

// Standard response schema
const StandardResponseSchema = z.object({
    success: z.boolean(),
    statusCode: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
});

// Register schemas
registry.register('SendEmail', SendEmailSchema);
registry.register('SendRawHtmlEmail', SendRawHtmlEmailSchema);
registry.register('AccountSuspended', AccountSuspendedSchema);
registry.register('AccountVerified', AccountVerifiedSchema);
registry.register('MissedPayments', MissedPaymentsSchema);
registry.register('PropertyAllocation', PropertyAllocationSchema);
registry.register('ResetPassword', ResetPasswordSchema);
registry.register('UpdatedTermsAndConditions', UpdatedTermsAndConditionsSchema);
registry.register('VerifyEmail', VerifyEmailSchema);
registry.register('WalletTopUp', WalletTopUpSchema);
registry.register('AdminContributionReceived', AdminContributionReceivedSchema);
registry.register('AdminPropertyAllocation', AdminPropertyAllocationSchema);
registry.register('AdminInviteAdmin', AdminInviteAdminSchema);
registry.register('TestTemp', TestTempSchema);
registry.register('SendSms', SendSmsSchema);
registry.register('TokenRegistration', TokenRegistrationSchema);
registry.register('EndpointVerification', EndpointVerificationSchema);
registry.register('Notification', NotificationSchema);
registry.register('SendSlackMessage', SendSlackMessageSchema);
registry.register('SendWhatsAppMessage', SendWhatsAppMessageSchema);
registry.register('StandardResponse', StandardResponseSchema);

// Email endpoints
registry.registerPath({
    method: 'post',
    path: '/email/test-email',
    tags: ['Email'],
    summary: 'Test email endpoint',
    responses: {
        200: { description: 'Email sent successfully' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/email/test-raw-html-email',
    tags: ['Email'],
    summary: 'Send raw HTML email',
    request: { body: { content: { 'application/json': { schema: SendRawHtmlEmailSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/account-suspended',
    tags: ['Email'],
    summary: 'Send account suspended email',
    request: { body: { content: { 'application/json': { schema: AccountSuspendedSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/account-verified',
    tags: ['Email'],
    summary: 'Send account verified email',
    request: { body: { content: { 'application/json': { schema: AccountVerifiedSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/missed-payments',
    tags: ['Email'],
    summary: 'Send missed payments email',
    request: { body: { content: { 'application/json': { schema: MissedPaymentsSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/property-allocation',
    tags: ['Email'],
    summary: 'Send property allocation email',
    request: { body: { content: { 'application/json': { schema: PropertyAllocationSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/reset-password',
    tags: ['Email'],
    summary: 'Send reset password email',
    request: { body: { content: { 'application/json': { schema: ResetPasswordSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/updated-terms-and-conditions',
    tags: ['Email'],
    summary: 'Send updated terms and conditions email',
    request: { body: { content: { 'application/json': { schema: UpdatedTermsAndConditionsSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/verify-email',
    tags: ['Email'],
    summary: 'Send verify email',
    request: { body: { content: { 'application/json': { schema: VerifyEmailSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/wallet-top-up',
    tags: ['Email'],
    summary: 'Send wallet top-up confirmation email',
    request: { body: { content: { 'application/json': { schema: WalletTopUpSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/admin/contribution-received',
    tags: ['Email - Admin'],
    summary: 'Send admin contribution received email',
    request: { body: { content: { 'application/json': { schema: AdminContributionReceivedSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/admin/property-allocation',
    tags: ['Email - Admin'],
    summary: 'Send admin property allocation email',
    request: { body: { content: { 'application/json': { schema: AdminPropertyAllocationSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/admin/invite-admin',
    tags: ['Email - Admin'],
    summary: 'Send admin invitation email',
    request: { body: { content: { 'application/json': { schema: AdminInviteAdminSchema } } } },
    responses: { 200: { description: 'Email sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/email/test-temp',
    tags: ['Email'],
    summary: 'Test template loading',
    request: { body: { content: { 'application/json': { schema: TestTempSchema } } } },
    responses: { 200: { description: 'Template loaded successfully' } },
});

registry.registerPath({
    method: 'get',
    path: '/email/templates',
    tags: ['Email'],
    summary: 'List available email templates',
    responses: { 200: { description: 'Template list returned' } },
});

registry.registerPath({
    method: 'get',
    path: '/email/constants',
    tags: ['Email'],
    summary: 'Get email constants',
    responses: { 200: { description: 'Constants returned' } },
});

// SMS endpoints
registry.registerPath({
    method: 'post',
    path: '/sms/send',
    tags: ['SMS'],
    summary: 'Send SMS',
    request: { body: { content: { 'application/json': { schema: SendSmsSchema } } } },
    responses: { 200: { description: 'SMS sent successfully' } },
});

// Push endpoints
registry.registerPath({
    method: 'post',
    path: '/push/create-application-endpoint',
    tags: ['Push'],
    summary: 'Create application endpoint for push notifications',
    request: { body: { content: { 'application/json': { schema: TokenRegistrationSchema } } } },
    responses: { 200: { description: 'Endpoint created successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/push/verify-endpoint',
    tags: ['Push'],
    summary: 'Verify push notification endpoint',
    request: { body: { content: { 'application/json': { schema: EndpointVerificationSchema } } } },
    responses: { 200: { description: 'Endpoint verified successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/push/send-notification',
    tags: ['Push'],
    summary: 'Send push notification',
    request: { body: { content: { 'application/json': { schema: NotificationSchema } } } },
    responses: { 200: { description: 'Notification sent successfully' } },
});

// Slack endpoints
registry.registerPath({
    method: 'post',
    path: '/slack/send',
    tags: ['Slack'],
    summary: 'Send Slack message via HTTP',
    request: { body: { content: { 'application/json': { schema: SendSlackMessageSchema } } } },
    responses: { 200: { description: 'Message sent successfully' } },
});

registry.registerPath({
    method: 'post',
    path: '/slack/send-sdk',
    tags: ['Slack'],
    summary: 'Send Slack message via SDK',
    request: { body: { content: { 'application/json': { schema: SendSlackMessageSchema } } } },
    responses: { 200: { description: 'Message sent successfully' } },
});

// WhatsApp endpoints
registry.registerPath({
    method: 'post',
    path: '/whatsapp/send',
    tags: ['WhatsApp'],
    summary: 'Send WhatsApp message',
    request: { body: { content: { 'application/json': { schema: SendWhatsAppMessageSchema } } } },
    responses: { 200: { description: 'Message sent successfully' } },
});

// Event Handler endpoints
registry.register('CreateEventHandler', CreateEventHandlerSchema);
registry.register('UpdateEventHandler', UpdateEventHandlerSchema);
registry.register('EventHandlerResponse', EventHandlerResponseSchema);
registry.register('EventHandlerListResponse', EventHandlerListResponseSchema);

registry.registerPath({
    method: 'post',
    path: '/event-handlers',
    tags: ['Event Handlers'],
    summary: 'Create a new event handler',
    request: { body: { content: { 'application/json': { schema: CreateEventHandlerSchema } } } },
    responses: {
        201: { description: 'Event handler created successfully' },
        400: { description: 'Validation error' },
        404: { description: 'Event type not found' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/event-handlers',
    tags: ['Event Handlers'],
    summary: 'List all event handlers',
    request: {
        query: z.object({
            eventTypeId: z.string().optional(),
            enabled: z.string().optional(),
        }),
    },
    responses: {
        200: { description: 'Event handlers retrieved successfully' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/event-handlers/{id}',
    tags: ['Event Handlers'],
    summary: 'Get an event handler by ID',
    request: {
        params: z.object({ id: z.string() }),
    },
    responses: {
        200: { description: 'Event handler retrieved successfully' },
        404: { description: 'Event handler not found' },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/event-handlers/{id}',
    tags: ['Event Handlers'],
    summary: 'Update an event handler',
    request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: UpdateEventHandlerSchema } } },
    },
    responses: {
        200: { description: 'Event handler updated successfully' },
        400: { description: 'Validation error' },
        404: { description: 'Event handler not found' },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/event-handlers/{id}',
    tags: ['Event Handlers'],
    summary: 'Delete an event handler',
    request: {
        params: z.object({ id: z.string() }),
    },
    responses: {
        200: { description: 'Event handler deleted successfully' },
        404: { description: 'Event handler not found' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/event-handlers/{id}/toggle',
    tags: ['Event Handlers'],
    summary: 'Toggle event handler enabled status',
    request: {
        params: z.object({ id: z.string() }),
    },
    responses: {
        200: { description: 'Event handler toggled successfully' },
        404: { description: 'Event handler not found' },
    },
});

export function generateOpenAPIDocument(baseUrl?: string): OpenAPIObject {
    const generator = new OpenApiGeneratorV31(registry.definitions);

    return generator.generateDocument({
        openapi: '3.1.0',
        info: {
            title: 'Notifications Service API',
            version: '1.0.0',
            description: 'Email, SMS, Push, Slack, and WhatsApp notification service',
        },
        servers: baseUrl !== undefined
            ? [{ url: baseUrl, description: 'Current environment' }]
            : [
                { url: 'http://localhost:3004', description: 'Local development' },
            ],
    });
}
