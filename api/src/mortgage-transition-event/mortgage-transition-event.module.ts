import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageTransitionEvent } from './mortgage-transition-event.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageTransitionEvent])],
    exports: [TypeOrmModule],
})
export class MortgageTransitionEventModule { }

export default MortgageTransitionEventModule;
