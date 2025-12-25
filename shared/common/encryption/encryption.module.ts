import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

@Module({
    imports: [ConfigModule.forRoot()],
    controllers: [],
    providers: [EncryptionService],
    exports: [EncryptionService]
})
export class EncryptionModule { }
