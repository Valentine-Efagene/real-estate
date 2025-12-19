import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageStateHistory } from './mortgage-state-history.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageStateHistory])],
    exports: [TypeOrmModule],
})
export class MortgageStateHistoryModule { }

export default MortgageStateHistoryModule;
