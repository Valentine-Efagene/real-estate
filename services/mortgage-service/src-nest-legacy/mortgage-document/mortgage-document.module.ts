import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageDocument } from '@valentine-efagene/qshelter-common';
import { MortgageDocumentService } from './mortgage-document.service';
import { MortgageDocumentController } from './mortgage-document.controller';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageDocument])],
    providers: [MortgageDocumentService],
    controllers: [MortgageDocumentController],
    exports: [MortgageDocumentService],
})
export class MortgageDocumentModule { }

export default MortgageDocumentModule;
