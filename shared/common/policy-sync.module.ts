import { Module } from '@nestjs/common';
import { PolicySyncService } from './services/policy-sync.service';

@Module({
    providers: [PolicySyncService],
    exports: [PolicySyncService],
})
export class PolicySyncModule { }
