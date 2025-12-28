// https://mohammedshamseerpv.medium.com/encrypt-and-decrypt-files-in-node-js-a-step-by-step-guide-using-aes-256-cbc-c25b3ef687c3

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-cbc';
    private key: Buffer
    private iv: Buffer

    private readonly iterations = 100000; // Number of iterations for PBKDF2
    private readonly keyLength = 32; // Key length for AES-256
    private readonly ivLength = 16; // IV length for AES

    constructor(
        private readonly configService: ConfigService
    ) {
        const password = this.configService.get<string>('ENCRYPTION_PASSWORD')
        const salt = this.configService.get<string>('ENCRYPTION_SALT')

        if (!password || password.length < 1) {
            throw new InternalServerErrorException('Encryption password not set')
        }

        if (!salt || salt.length < 1) {
            throw new InternalServerErrorException('Encryption salt not set')
        }

        const keyAndIv = this.deriveKeyAndIV(password, salt)
        this.key = keyAndIv.key
        this.iv = keyAndIv.iv

        if (this.key.length !== 32) throw new Error('Encryption key must be 32 bytes');
        if (this.iv.length !== 16) throw new Error('IV must be 16 bytes');
    }

    deriveKeyAndIV(password: string, salt: string): { key: Buffer, iv: Buffer } {
        // Derive the key using PBKDF2
        const key = crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
        const iv = key.subarray(0, this.ivLength); // Use the first 16 bytes as the IV
        return { key, iv };
    }

    encrypt(text: string): string {
        const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decrypt(encryptedText: string): string {
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
