import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mortgage } from './mortgage.entity';
import { MortgageDocument } from './mortgage-document.entity';
import { MortgageStep } from './mortgage-step.entity';
import { MortgageType } from '../mortgage-type/mortgage-type.entity';
import { MortgageService } from './mortgage.service';
import { MortgageController } from './mortgage.controller';
import { MailModule } from '../mail/mail.module';
import { MortgageReminderService } from './mortgage-reminder.service';
import { MortgageFSMModule } from '../mortgage-fsm/mortgage-fsm.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Mortgage, MortgageDocument, MortgageStep, MortgageType]),
        MailModule,
        MortgageFSMModule
    ],
    controllers: [MortgageController],
    providers: [MortgageService, MortgageReminderService],
    exports: [MortgageService],
})
export class MortgageModule { }

export default MortgageModule;
