import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from '@valentine-efagene/qshelter-common';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet])],
  providers: [],
  controllers: [],
  exports: []
})
export class WalletModule { }
