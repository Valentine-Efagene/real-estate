import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../event-bus/event-bus.service';
import { EventHandler, EventTransportType } from '../event-bus/event-bus.types';
import { MortgageAction } from './mortgage-fsm.types';

/**
 * FSM Event Configuration
 * Maps FSM actions to microservice endpoints/webhooks
 * Designed for easy migration to SNS/EventBridge
 */
@Injectable()
export class FSMEventConfig implements OnModuleInit {
    private readonly logger = new Logger(FSMEventConfig.name);

    constructor(
        private readonly eventBus: EventBusService,
        private readonly configService: ConfigService,
    ) { }

    onModuleInit() {
        this.registerEventHandlers();
    }

    /**
     * Register all FSM action handlers
     * Each action maps to a microservice endpoint
     */
    private registerEventHandlers(): void {
        const baseUrl = this.configService.get('MICROSERVICES_BASE_URL', 'http://localhost:3000');
        const apiKey = this.configService.get('MICROSERVICES_API_KEY', '');

        const handlers: EventHandler[] = [
            // Notification Service Endpoints
            {
                eventType: MortgageAction.NOTIFY_UNDERWRITER,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/notifications/underwriter`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 3,
                    retryDelay: 2000,
                    backoffMultiplier: 2,
                },
                timeout: 10000,
            },
            {
                eventType: MortgageAction.NOTIFY_BORROWER,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/notifications/borrower`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 3,
                    retryDelay: 2000,
                    backoffMultiplier: 2,
                },
            },
            {
                eventType: MortgageAction.SEND_EMAIL,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/notifications/email`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 5,
                    retryDelay: 1000,
                    backoffMultiplier: 1.5,
                },
            },
            {
                eventType: MortgageAction.SEND_SMS,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/notifications/sms`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Document Service Endpoints
            {
                eventType: MortgageAction.REQUEST_DOCUMENTS,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/documents/request`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.GENERATE_AGREEMENT,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/documents/generate-agreement`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                timeout: 30000, // Document generation may take longer
            },
            {
                eventType: MortgageAction.GENERATE_CLOSING_DOCS,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/documents/generate-closing`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                timeout: 30000,
            },

            // Appraisal Service Endpoints
            {
                eventType: MortgageAction.ORDER_APPRAISAL,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/appraisal/order`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.REQUEST_INSPECTION,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/inspection/request`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Credit Service Endpoints
            {
                eventType: MortgageAction.RUN_CREDIT_CHECK,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/credit/check`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                timeout: 15000,
            },
            {
                eventType: MortgageAction.VERIFY_INCOME,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/verification/income`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.VERIFY_EMPLOYMENT,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/verification/employment`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Payment Service Endpoints
            {
                eventType: MortgageAction.SETUP_PAYMENT_SCHEDULE,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/payments/setup-schedule`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.PROCESS_PAYMENT,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/payments/process`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 3,
                    retryDelay: 5000,
                    backoffMultiplier: 2,
                },
            },
            {
                eventType: MortgageAction.REFUND_PAYMENT,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/payments/refund`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Legal Service Endpoints
            {
                eventType: MortgageAction.INITIATE_FORECLOSURE,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/legal/initiate-foreclosure`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.SCHEDULE_AUCTION,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/legal/schedule-auction`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Insurance Service Endpoints
            {
                eventType: MortgageAction.VERIFY_INSURANCE,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/insurance/verify`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.SETUP_ESCROW,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/escrow/setup`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Compliance Service Endpoints
            {
                eventType: MortgageAction.UPDATE_CREDIT_BUREAU,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/compliance/update-credit-bureau`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },
            {
                eventType: MortgageAction.REPORT_TO_REGULATOR,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/compliance/report-regulator`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Fund Service Endpoints
            {
                eventType: MortgageAction.DISBURSE_FUNDS,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/funds/disburse`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 5,
                    retryDelay: 3000,
                    backoffMultiplier: 2,
                },
                timeout: 30000,
            },
            {
                eventType: MortgageAction.FREEZE_ACCOUNT,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/funds/freeze-account`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
            },

            // Analytics Service Endpoints
            {
                eventType: MortgageAction.UPDATE_ANALYTICS,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/analytics/update`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 1,
                    retryDelay: 1000,
                    backoffMultiplier: 1,
                },
            },

            // Audit Service Endpoints
            {
                eventType: MortgageAction.LOG_AUDIT_TRAIL,
                transport: EventTransportType.HTTP,
                endpoint: `${baseUrl}/audit/log`,
                authentication: apiKey ? {
                    type: 'api-key',
                    credentials: apiKey,
                } : undefined,
                retryConfig: {
                    maxRetries: 2,
                    retryDelay: 1000,
                    backoffMultiplier: 1,
                },
            },
        ];

        // Register all handlers with the event bus
        this.eventBus.registerHandlers(handlers);

        this.logger.log(`Registered ${handlers.length} FSM event handlers`);
    }

    /**
     * Get endpoint URL for a specific action (useful for debugging)
     */
    getEndpointForAction(action: MortgageAction): string | undefined {
        const handlers = this.eventBus.getHandlers().get(action);
        return handlers?.[0]?.endpoint;
    }
}

export default FSMEventConfig;
