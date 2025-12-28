import { Module } from '@nestjs/common';
import { QrCodeService } from './qr-code.service';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
    imports: [EncryptionModule],
    providers: [QrCodeService],
    controllers: [],
    exports: [QrCodeService]
})
export class QrCodeModule { }
