import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageFSMService } from './mortgage-fsm.service';
import { MortgageFSMController } from './mortgage-fsm.controller';
import { MortgageTransitionService } from './mortgage-transition.service';
import { Mortgage, MortgageTransition, MortgageTransitionEvent } from '@valentine-efagene/qshelter-common';
// import { FSMEventConfig } from './fsm-event-config.service'; // TODO: Add back when EventBus is implemented

@Module({
    imports: [
        TypeOrmModule.forFeature([Mortgage, MortgageTransition, MortgageTransitionEvent]),
    ],
    controllers: [MortgageFSMController],
    providers: [MortgageFSMService, MortgageTransitionService], // FSMEventConfig removed until EventBus is implemented
    exports: [MortgageFSMService, MortgageTransitionService],
})
export class MortgageFSMModule { }

export default MortgageFSMModule;
