import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '@valentine-efagene/qshelter-common';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [],
  exports: []
})
export class TransactionModule { }
