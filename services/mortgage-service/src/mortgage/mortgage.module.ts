import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mortgage, MortgageDocument, MortgageStep, MortgageType } from '@valentine-efagene/qshelter-common';
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
