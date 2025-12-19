import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageTransition } from './mortgage-transition.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageTransition])],
    exports: [TypeOrmModule],
})
export class MortgageTransitionModule { }

export default MortgageTransitionModule;
