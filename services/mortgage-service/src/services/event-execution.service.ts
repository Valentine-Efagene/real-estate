import { prisma } from '../lib/prisma';
import {
    PhaseTrigger,
    EventHandlerType,
    createTenantPrisma,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import { unitLockingService } from './unit-locking.service';
import { getEventPublisher, NotificationType } from '@valentine-efagene/qshelter-common';

/**
 * Event Execution Service
 * 
 * This service implements the execution engine for configurable event handlers.
 * When phases or steps transition, this engine:
 * 1. Fetches attached handlers from templates (via PhaseEventAttachment/StepEventAttachment)
 * 2. Evaluates filter conditions (JSONPath)
 * 3. Executes handlers in priority order
 * 4. Logs execution results for audit
 * 
 * Supported handler types:
 * - LOCK_UNIT: Lock property unit, supersede competing applications
 * - SEND_EMAIL: Send email notification via SNS
 * - SEND_SMS: Send SMS notification via SNS
 * - CALL_WEBHOOK: Call external API (future)
 * - RUN_AUTOMATION: Execute internal business logic (future)
 * - ADVANCE_WORKFLOW: Advance workflow state (future)
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context passed to handlers during execution
 */
export interface ExecutionContext {
    tenantId: string;
    applicationId: string;
    phaseId?: string;
    stepId?: string;
    trigger: PhaseTrigger;
    actorId?: string;
    // Additional data from the triggering event
    eventData?: Record<string, unknown>;
}

/**
 * Result of handler execution
 */
export interface HandlerExecutionResult {
    handlerId: string;
    handlerName: string;
    handlerType: EventHandlerType;
    success: boolean;
    durationMs: number;
    error?: string;
    output?: Record<string, unknown>;
}

/**
 * Config structure for LOCK_UNIT handlers
 */
interface LockUnitConfig {
    supersedeBehavior?: 'SUPERSEDE_ALL' | 'SUPERSEDE_NONE';
    notifySuperseded?: boolean;
}

/**
 * Config structure for SEND_EMAIL handlers
 */
interface SendEmailConfig {
    notificationType: string; // Maps to NotificationType enum
    recipients: 'BUYER' | 'ADMIN' | 'ALL_PARTIES' | 'CUSTOM';
    customRecipients?: string[]; // If recipients = CUSTOM
    templateData?: Record<string, string>; // Additional template data mappings
}

/**
 * Config structure for SEND_SMS handlers
 */
interface SendSmsConfig {
    notificationType: string;
    recipients: 'BUYER' | 'ADMIN' | 'CUSTOM';
    customRecipients?: string[];
}

/**
 * Config structure for CALL_WEBHOOK handlers
 */
interface CallWebhookConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    bodyTemplate?: string; // JSON template with placeholders
    retryOnFail?: boolean;
    timeoutMs?: number;
}

// ============================================================================
// HANDLER EXECUTORS
// ============================================================================

/**
 * Execute LOCK_UNIT handler
 * Locks the property unit for the applicant and supersedes competing applications
 */
async function executeLockUnit(
    config: LockUnitConfig,
    context: ExecutionContext
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
    try {
        const result = await unitLockingService.lockUnitForApplication(
            context.tenantId,
            context.applicationId,
            context.actorId
        );

        // Log domain event for unit lock
        await prisma.domainEvent.create({
            data: {
                id: uuidv4(),
                tenantId: context.tenantId,
                eventType: 'UNIT.LOCKED',
                aggregateType: 'PropertyUnit',
                aggregateId: result.lockedUnit.id,
                queueName: 'notifications',
                payload: JSON.stringify({
                    unitId: result.lockedUnit.id,
                    applicationId: context.applicationId,
                    phaseId: context.phaseId,
                    trigger: context.trigger,
                    supersededCount: result.supersededCount,
                    supersededApplicationIds: result.supersededApplicationIds,
                    triggeredByHandler: true,
                }),
                actorId: context.actorId,
            },
        });

        return {
            success: true,
            output: {
                unitId: result.lockedUnit.id,
                supersededCount: result.supersededCount,
                supersededApplicationIds: result.supersededApplicationIds,
            },
        };
    } catch (error: any) {
        // Unit already locked by this buyer is not an error
        if (error.message?.includes('already locked by this buyer')) {
            return {
                success: true,
                output: { alreadyLocked: true },
            };
        }

        return {
            success: false,
            error: error.message || 'Failed to lock unit',
        };
    }
}

/**
 * Execute SEND_EMAIL handler
 * Sends email notification via SNS to notification-service
 */
async function executeSendEmail(
    config: SendEmailConfig,
    context: ExecutionContext
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
    try {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId: context.tenantId });

        // Get application with buyer and property details
        const application = await tenantPrisma.application.findUnique({
            where: { id: context.applicationId },
            include: {
                buyer: true,
                propertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: true,
                            },
                        },
                    },
                },
            },
        });

        if (!application) {
            return { success: false, error: 'Application not found' };
        }

        // Determine recipients based on config
        const recipients: string[] = [];

        switch (config.recipients) {
            case 'BUYER':
                if (application.buyer?.email) {
                    recipients.push(application.buyer.email);
                }
                break;
            case 'ADMIN':
                // TODO: Get admin emails from tenant settings
                break;
            case 'ALL_PARTIES':
                if (application.buyer?.email) {
                    recipients.push(application.buyer.email);
                }
                // TODO: Add other parties (bank, developer, etc.)
                break;
            case 'CUSTOM':
                if (config.customRecipients) {
                    recipients.push(...config.customRecipients);
                }
                break;
        }

        if (recipients.length === 0) {
            return { success: false, error: 'No recipients found' };
        }

        // Build notification payload
        const property = application.propertyUnit?.variant?.property;
        const buyer = application.buyer;

        const publisher = getEventPublisher('mortgage-service');

        // Map notification type to actual NotificationType
        const notificationType = config.notificationType as NotificationType;

        // Send email to each recipient
        for (const email of recipients) {
            await publisher.publishEmail(
                notificationType,
                {
                    to_email: email,
                    homeBuyerName: `${buyer?.firstName || ''} ${buyer?.lastName || ''}`.trim() || 'Valued Customer',
                    applicationId: application.id,
                    applicationNumber: application.applicationNumber,
                    propertyName: property?.title || 'Property',
                    unitNumber: application.propertyUnit?.unitNumber || '',
                    trigger: context.trigger,
                    ...config.templateData,
                },
                { correlationId: context.applicationId }
            );
        }

        return {
            success: true,
            output: {
                recipientCount: recipients.length,
                notificationType: config.notificationType,
            },
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to send email',
        };
    }
}

/**
 * Execute SEND_SMS handler
 * Sends SMS notification via SNS to notification-service
 */
async function executeSendSms(
    config: SendSmsConfig,
    context: ExecutionContext
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
    try {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId: context.tenantId });

        const application = await tenantPrisma.application.findUnique({
            where: { id: context.applicationId },
            include: {
                buyer: true,
            },
        });

        if (!application) {
            return { success: false, error: 'Application not found' };
        }

        // Determine recipients
        const recipients: string[] = [];

        switch (config.recipients) {
            case 'BUYER':
                if (application.buyer?.phone) {
                    recipients.push(application.buyer.phone);
                }
                break;
            case 'CUSTOM':
                if (config.customRecipients) {
                    recipients.push(...config.customRecipients);
                }
                break;
        }

        if (recipients.length === 0) {
            return { success: false, error: 'No SMS recipients found' };
        }

        const publisher = getEventPublisher('mortgage-service');
        const notificationType = config.notificationType as NotificationType;

        for (const phone of recipients) {
            await publisher.publishSMS(
                notificationType,
                {
                    to_phone: phone,
                    buyerName: application.buyer?.firstName || 'Customer',
                    applicationNumber: application.applicationNumber,
                },
                { correlationId: context.applicationId }
            );
        }

        return {
            success: true,
            output: {
                recipientCount: recipients.length,
                notificationType: config.notificationType,
            },
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to send SMS',
        };
    }
}

/**
 * Execute CALL_WEBHOOK handler
 * Calls an external API endpoint with configurable payload
 */
async function executeCallWebhook(
    config: CallWebhookConfig,
    context: ExecutionContext
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            config.timeoutMs || 30000
        );

        // Build request body from template
        let body: string | undefined;
        if (config.bodyTemplate) {
            // Simple placeholder replacement
            body = config.bodyTemplate
                .replace('{{applicationId}}', context.applicationId)
                .replace('{{tenantId}}', context.tenantId)
                .replace('{{phaseId}}', context.phaseId || '')
                .replace('{{trigger}}', context.trigger)
                .replace('{{actorId}}', context.actorId || '');
        }

        const response = await fetch(config.url, {
            method: config.method,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
            body: config.method !== 'GET' ? body : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                success: false,
                error: `Webhook returned ${response.status}: ${response.statusText}`,
            };
        }

        let responseData: unknown;
        try {
            responseData = await response.json() as unknown;
        } catch {
            // Response may not be JSON
        }

        return {
            success: true,
            output: {
                statusCode: response.status,
                response: responseData,
            },
        };
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return {
                success: false,
                error: `Webhook timeout after ${config.timeoutMs || 30000}ms`,
            };
        }
        return {
            success: false,
            error: error.message || 'Webhook call failed',
        };
    }
}

// ============================================================================
// FILTER CONDITION EVALUATOR
// ============================================================================

/**
 * Evaluate a JSONPath-like filter condition
 * Supports simple conditions like:
 * - $.eventData.status == 'approved'
 * - $.trigger == 'ON_COMPLETE'
 * - $.applicationId != null
 */
function evaluateFilterCondition(
    filterCondition: string,
    context: ExecutionContext
): boolean {
    try {
        // Simple JSONPath-like evaluation
        // Format: $.path.to.value operator 'value'
        const match = filterCondition.match(/\$\.(\S+)\s*(==|!=|>|<|>=|<=)\s*(.+)/);

        if (!match) {
            console.warn(`Invalid filter condition format: ${filterCondition}`);
            return true; // Default to true if condition is malformed
        }

        const [, path, operator, valueStr] = match;

        // Navigate the context object
        const pathParts = path.split('.');
        let actualValue: unknown = context as unknown;

        for (const part of pathParts) {
            if (actualValue && typeof actualValue === 'object') {
                actualValue = (actualValue as Record<string, unknown>)[part];
            } else {
                actualValue = undefined;
                break;
            }
        }

        // Parse expected value
        let expectedValue: unknown;
        if (valueStr === 'null') {
            expectedValue = null;
        } else if (valueStr === 'true') {
            expectedValue = true;
        } else if (valueStr === 'false') {
            expectedValue = false;
        } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
            expectedValue = valueStr.slice(1, -1);
        } else if (!isNaN(Number(valueStr))) {
            expectedValue = Number(valueStr);
        } else {
            expectedValue = valueStr;
        }

        // Evaluate
        switch (operator) {
            case '==':
                return actualValue === expectedValue;
            case '!=':
                return actualValue !== expectedValue;
            case '>':
                return Number(actualValue) > Number(expectedValue);
            case '<':
                return Number(actualValue) < Number(expectedValue);
            case '>=':
                return Number(actualValue) >= Number(expectedValue);
            case '<=':
                return Number(actualValue) <= Number(expectedValue);
            default:
                return true;
        }
    } catch (error) {
        console.error('Filter condition evaluation error:', error);
        return true; // Default to true on error
    }
}

// ============================================================================
// MAIN EXECUTION ENGINE
// ============================================================================

class EventExecutionService {
    /**
     * Execute all attached handlers for a phase trigger
     * 
     * This is called when a phase transitions (activates, completes, etc.)
     * It fetches handlers from the phase template's PhaseEventAttachment records
     * and executes them in priority order.
     * 
     * @param phaseId - The application phase ID (NOT template ID)
     * @param trigger - The trigger event (ON_ACTIVATE, ON_COMPLETE, etc.)
     * @param actorId - The user who triggered this
     * @param eventData - Additional data from the triggering event
     */
    async executePhaseHandlers(
        phaseId: string,
        trigger: PhaseTrigger,
        actorId?: string,
        eventData?: Record<string, unknown>
    ): Promise<HandlerExecutionResult[]> {
        const results: HandlerExecutionResult[] = [];

        // Get the application phase with its template and attached handlers
        const phase = await prisma.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                application: {
                    select: { id: true, tenantId: true },
                },
                phaseTemplate: {
                    include: {
                        eventAttachments: {
                            where: {
                                trigger,
                                enabled: true,
                            },
                            orderBy: { priority: 'asc' },
                            include: {
                                handler: true,
                            },
                        },
                    },
                },
            },
        });

        if (!phase) {
            console.warn(`[EventExecution] Phase not found: ${phaseId}`);
            return results;
        }

        const attachments = phase.phaseTemplate?.eventAttachments || [];

        if (attachments.length === 0) {
            return results; // No handlers attached
        }

        const context: ExecutionContext = {
            tenantId: phase.application.tenantId,
            applicationId: phase.application.id,
            phaseId,
            trigger,
            actorId,
            eventData,
        };

        // Execute handlers in priority order
        for (const attachment of attachments) {
            const handler = attachment.handler;

            // Check filter condition
            if (handler.filterCondition) {
                const shouldExecute = evaluateFilterCondition(
                    handler.filterCondition,
                    context
                );
                if (!shouldExecute) {
                    console.log(
                        `[EventExecution] Skipping handler ${handler.name}: filter condition not met`
                    );
                    continue;
                }
            }

            // Execute the handler
            const startTime = Date.now();
            let result: { success: boolean; output?: Record<string, unknown>; error?: string };

            try {
                result = await this.executeHandler(handler, context);
            } catch (error: any) {
                result = { success: false, error: error.message };
            }

            const durationMs = Date.now() - startTime;

            const executionResult: HandlerExecutionResult = {
                handlerId: handler.id,
                handlerName: handler.name,
                handlerType: handler.handlerType as EventHandlerType,
                success: result.success,
                durationMs,
                error: result.error,
                output: result.output,
            };

            results.push(executionResult);

            // Log execution for audit
            await this.logExecution(context, handler, executionResult);

            // If handler failed and we should stop, break
            // (For now, we continue executing other handlers)
        }

        return results;
    }

    /**
     * Execute a single handler based on its type
     */
    private async executeHandler(
        handler: { handlerType: string; config: unknown; name: string },
        context: ExecutionContext
    ): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
        const config = handler.config as Record<string, unknown> || {};

        switch (handler.handlerType) {
            case 'LOCK_UNIT':
                return executeLockUnit(config as unknown as LockUnitConfig, context);

            case 'SEND_EMAIL':
                return executeSendEmail(config as unknown as SendEmailConfig, context);

            case 'SEND_SMS':
                return executeSendSms(config as unknown as SendSmsConfig, context);

            case 'CALL_WEBHOOK':
                return executeCallWebhook(config as unknown as CallWebhookConfig, context);

            case 'SEND_PUSH':
                // TODO: Implement push notifications
                return { success: true, output: { skipped: 'Push notifications not implemented' } };

            case 'ADVANCE_WORKFLOW':
                // TODO: Implement workflow advancement
                return { success: true, output: { skipped: 'Workflow advancement not implemented' } };

            case 'RUN_AUTOMATION':
                // TODO: Implement custom automations
                return { success: true, output: { skipped: 'Custom automations not implemented' } };

            default:
                return { success: false, error: `Unknown handler type: ${handler.handlerType}` };
        }
    }

    /**
     * Log handler execution for audit trail
     */
    private async logExecution(
        context: ExecutionContext,
        handler: { id: string; name: string; handlerType: string },
        result: HandlerExecutionResult
    ): Promise<void> {
        try {
            await prisma.applicationEvent.create({
                data: {
                    tenantId: context.tenantId,
                    applicationId: context.applicationId,
                    eventType: 'HANDLER_EXECUTED',
                    eventGroup: 'AUTOMATION',
                    data: JSON.parse(JSON.stringify({
                        handlerId: handler.id,
                        handlerName: handler.name,
                        handlerType: handler.handlerType,
                        trigger: context.trigger,
                        phaseId: context.phaseId,
                        stepId: context.stepId,
                        success: result.success,
                        durationMs: result.durationMs,
                        error: result.error,
                        output: result.output,
                    })),
                    actorId: context.actorId,
                    actorType: context.actorId ? 'USER' : 'SYSTEM',
                },
            });
        } catch (error) {
            console.error('[EventExecution] Failed to log execution:', error);
            // Don't throw - logging failure shouldn't fail the handler
        }
    }
}

// Export singleton instance
export const eventExecutionService = new EventExecutionService();

// Export for testing
export { EventExecutionService };
