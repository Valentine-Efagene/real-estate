import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MortgageAction } from './mortgage-fsm.types';

/**
 * FSM Event Configuration
 * Note: Event bus is a separate Lambda service.
 * This service is a placeholder for future event publishing functionality.
 * When implementing, publish events to the event bus Lambda via HTTP/SNS.
 */
@Injectable()
export class FSMEventConfig {
    private readonly logger = new Logger(FSMEventConfig.name);

    constructor(
        private readonly configService: ConfigService,
    ) { }

    /**
     * Get endpoint URL for a specific action
     * This would be used when publishing events to the event bus Lambda
     */
    getEndpointForAction(action: MortgageAction): string | undefined {
        const baseUrl = this.configService.get('EVENT_BUS_URL');
        // Map actions to event bus endpoints
        return baseUrl ? `${baseUrl}/events/${action}` : undefined;
    }
}

export default FSMEventConfig;
