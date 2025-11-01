import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mortgage } from './mortgage.entity';
import { MortgageDocument } from './mortgage-document.entity';
import { MortgageStep } from './mortgage-step.entity';
import { MortgageService } from './mortgage.service';
import { MortgageController } from './mortgage.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Mortgage, MortgageDocument, MortgageStep])],
    controllers: [MortgageController],
    providers: [MortgageService],
    exports: [MortgageService],
})
export class MortgageModule { }

export default MortgageModule;
