import { Module, Global, DynamicModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventBusService } from './event-bus.service';

export interface EventBusModuleOptions {
    eventBusName?: string;
    awsRegion?: string;
    defaultTransport?: 'HTTP' | 'SNS' | 'EVENTBRIDGE';
    defaultTimeout?: number;
    defaultRetries?: number;
}

@Global()
@Module({})
export class EventBusModule {
    /**
     * Configure EventBusModule with runtime options
     * @param options - EventBridge configuration
     * @returns Configured DynamicModule
     */
    static forRoot(options: EventBusModuleOptions = {}): DynamicModule {
        return {
            module: EventBusModule,
            imports: [HttpModule],
            providers: [
                {
                    provide: 'EVENT_BUS_OPTIONS',
                    useValue: options,
                },
                EventBusService,
            ],
            exports: [EventBusService],
        };
    }
}

export default EventBusModule;
