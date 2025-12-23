import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageStep } from '@valentine-efagene/entities';
import { MortgageStepService } from './mortgage-step.service';
import { MortgageStepController } from './mortgage-step.controller';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageStep])],
    providers: [MortgageStepService],
    controllers: [MortgageStepController],
    exports: [MortgageStepService],
})
export class MortgageStepModule { }

export default MortgageStepModule;
