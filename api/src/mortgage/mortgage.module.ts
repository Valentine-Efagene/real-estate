import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mortgage } from './mortgage.entity';
import { MortgageDocument } from './mortgage-document.entity';
import { MortgageStep } from './mortgage-step.entity';
import { MortgageType } from 'src/mortgage-type/mortgage-type.entity';
import { MortgageService } from './mortgage.service';
import { MortgageController } from './mortgage.controller';
import { MailModule } from 'src/mail/mail.module';
import { MortgageReminderService } from './mortgage-reminder.service';

@Module({
    imports: [TypeOrmModule.forFeature([Mortgage, MortgageDocument, MortgageStep, MortgageType]), MailModule],
    controllers: [MortgageController],
    providers: [MortgageService, MortgageReminderService],
    exports: [MortgageService],
})
export class MortgageModule { }

export default MortgageModule;
