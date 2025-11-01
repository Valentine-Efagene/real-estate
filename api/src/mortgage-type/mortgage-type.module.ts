import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageType } from './mortgage-type.entity';
import { MortgageTypeService } from './mortgage-type.service';
import { MortgageTypeController } from './mortgage-type.controller';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageType])],
    providers: [MortgageTypeService],
    controllers: [MortgageTypeController],
    exports: [MortgageTypeService],
})
export class MortgageTypeModule { }

export default MortgageTypeModule;
