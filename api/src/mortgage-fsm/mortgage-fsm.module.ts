import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageFSMService } from './mortgage-fsm.service';
import { MortgageFSMController } from './mortgage-fsm.controller';
import { MortgageTransitionService } from './mortgage-transition.service';
import { Mortgage } from '../mortgage/mortgage.entity';
import { MortgageTransitionModule } from '../mortgage-transition/mortgage-transition.module';
import { MortgageTransitionEventModule } from '../mortgage-transition-event/mortgage-transition-event.module';
import { MortgageStateHistoryModule } from '../mortgage-state-history/mortgage-state-history.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Mortgage]),
        MortgageTransitionModule,
        MortgageTransitionEventModule,
        MortgageStateHistoryModule,
    ],
    controllers: [MortgageFSMController],
    providers: [MortgageFSMService, MortgageTransitionService],
    exports: [MortgageFSMService, MortgageTransitionService],
})
export class MortgageFSMModule { }

export default MortgageFSMModule;
