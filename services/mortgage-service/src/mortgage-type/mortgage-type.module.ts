import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MortgageType } from './mortgage-type.entity';
import { MortgageTypeService } from './mortgage-type.service';
import { MortgageTypeController } from './mortgage-type.controller';
import { MortgageTypeSeeder } from './mortgage-type.seeder';

@Module({
    imports: [TypeOrmModule.forFeature([MortgageType])],
    providers: [MortgageTypeService, MortgageTypeSeeder],
    controllers: [MortgageTypeController],
    exports: [MortgageTypeService, MortgageTypeSeeder],
})
export class MortgageTypeModule { }

export default MortgageTypeModule;
