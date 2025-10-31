import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
    let service: EncryptionService;

    const mockConfigService = {
        get: (key: string) => {
            const values = {
                ENCRYPTION_PASSWORD: 'testpassword',
                ENCRYPTION_SALT: 'testsalt',
            };
            return values[key];
        },
    };

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EncryptionService,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<EncryptionService>(EncryptionService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should encrypt and decrypt text correctly', () => {
        const originalText = 'Sensitive Information';
        const encrypted = service.encrypt(originalText);
        const decrypted = service.decrypt(encrypted);

        expect(encrypted).not.toEqual(originalText);
        expect(decrypted).toEqual(originalText);
    });

    it('should produce different ciphertexts for different inputs', () => {
        const text1 = 'Hello World';
        const text2 = 'Hello NestJS';

        const encrypted1 = service.encrypt(text1);
        const encrypted2 = service.encrypt(text2);

        expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should throw if key or IV lengths are incorrect', () => {
        const badServiceFactory = () => {
            const badConfigService = {
                get: (key: string) => {
                    const values = {
                        ENCRYPTION_PASSWORD: '',
                        ENCRYPTION_SALT: '',
                    };
                    return values[key];
                },
            };

            const testModule = new EncryptionService(badConfigService as any);
            return testModule;
        };

        expect(badServiceFactory).toThrowError();
    });
});
