import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
    imports: [HttpModule, ConfigModule],
    providers: [EventBusService],
    exports: [EventBusService],
})
export class EventBusModule { }

export default EventBusModule;
