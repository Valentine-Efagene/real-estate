import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import Office365Service from '../src/office365/office365.service';
import { EmailPreferenceService } from '../src/email_preference/email_preference.service';
import { ResponseMessage } from '../src/app.enum';

describe('Email Controller (e2e)', () => {
    let app: INestApplication;
    let office365Service: Office365Service;
    let emailPreferenceService: EmailPreferenceService;

    const mockSuccessResponse = {
        status: 202,
        data: {},
        headers: {
            'x-ms-request-id': 'mock-request-id-12345',
            'request-id': null,
            'client-request-id': null,
        },
    };

    const mockEmailPreference = {
        id: 1,
        email: 'test@example.com',
        unsubscribeToken: 'mock-token-12345',
        unSubscribed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(Office365Service)
            .useValue({
                sendTemplateEmail: jest.fn().mockResolvedValue(mockSuccessResponse),
                sendEmail: jest.fn().mockResolvedValue(mockSuccessResponse),
                sendHtmlEmail: jest.fn().mockResolvedValue(mockSuccessResponse),
                sendTestEmail: jest.fn().mockResolvedValue(undefined),
                getStats: jest.fn().mockResolvedValue({ provider: 'Office365', status: 'active' }),
            })
            .overrideProvider(EmailPreferenceService)
            .useValue({
                findOneByEmail: jest.fn().mockResolvedValue(mockEmailPreference),
                subscribe: jest.fn().mockResolvedValue(mockEmailPreference),
                buildUnsubscribeLink: jest.fn().mockReturnValue('https://example.com/unsubscribe/mock-token-12345'),
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        office365Service = moduleFixture.get<Office365Service>(Office365Service);
        emailPreferenceService = moduleFixture.get<EmailPreferenceService>(EmailPreferenceService);
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /email/account-suspended', () => {
        it('should send account suspended email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/account-suspended')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    reason: 'Account violation detected',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(res.body.statusCode).toBe(202);
                    expect(res.body.message).toBe(ResponseMessage.EMAIL_SENT);
                    expect(res.body.data).toHaveProperty('x-ms-request-id');
                    expect(emailPreferenceService.findOneByEmail).toHaveBeenCalledWith('test@example.com');
                    expect(emailPreferenceService.buildUnsubscribeLink).toHaveBeenCalledWith('mock-token-12345');
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            to_email: 'test@example.com',
                            homeBuyerName: 'John Doe',
                            reason: 'Account violation detected',
                            unsubscribeLink: expect.any(String),
                        })
                    );
                });
        });

        it('should return 400 for invalid email', () => {
            return request(app.getHttpServer())
                .post('/email/account-suspended')
                .send({
                    to_email: 'invalid-email',
                    homeBuyerName: 'John Doe',
                    reason: 'Test reason',
                })
                .expect(400);
        });

        it('should return 400 for missing required fields', () => {
            return request(app.getHttpServer())
                .post('/email/account-suspended')
                .send({
                    to_email: 'test@example.com',
                })
                .expect(400);
        });
    });

    describe('POST /email/account-verified', () => {
        it('should send account verified email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/account-verified')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    loginLink: 'https://example.com/login',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(res.body.statusCode).toBe(202);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalled();
                });
        });

        it('should return 400 for invalid URL', () => {
            return request(app.getHttpServer())
                .post('/email/account-verified')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    loginLink: 'not-a-valid-url',
                })
                .expect(400);
        });
    });

    describe('POST /email/missed-payments', () => {
        it('should send missed payments email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/missed-payments')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    amount: 50000000,
                    loginLink: 'https://example.com/login',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            to_email: 'test@example.com',
                            amount: expect.any(String), // Transformed by FormatHelper
                        })
                    );
                });
        });
    });

    describe('POST /email/property-allocation', () => {
        it('should send property allocation email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/property-allocation')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    equity: 4.5,
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(res.body.statusCode).toBe(202);
                });
        });

        it('should return 400 for invalid equity value', () => {
            return request(app.getHttpServer())
                .post('/email/property-allocation')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    equity: 'not-a-number',
                })
                .expect(400);
        });
    });

    describe('POST /email/reset-password', () => {
        it('should send reset password email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/reset-password')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    otp: '123456',
                    ttl: 5,
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            otp: '123456',
                            ttl: 5,
                        })
                    );
                });
        });

        it('should return 400 for invalid ttl', () => {
            return request(app.getHttpServer())
                .post('/email/reset-password')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    otp: '123456',
                    ttl: 'invalid',
                })
                .expect(400);
        });
    });

    describe('POST /email/updated-terms-and-conditions', () => {
        it('should send updated terms email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/updated-terms-and-conditions')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(res.body.statusCode).toBe(202);
                });
        });
    });

    describe('POST /email/verify-email', () => {
        it('should send verify email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/verify-email')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    otp: '654321',
                    ttl: 10,
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            otp: '654321',
                            ttl: 10,
                        })
                    );
                });
        });

        it('should return 400 for missing OTP', () => {
            return request(app.getHttpServer())
                .post('/email/verify-email')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    ttl: 10,
                })
                .expect(400);
        });
    });

    describe('POST /email/wallet-top-up', () => {
        it('should send wallet top up email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/wallet-top-up')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    amount: 100000000,
                    transactionId: 'TXN123456',
                    walletBalance: 500000000,
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            transactionId: 'TXN123456',
                        })
                    );
                });
        });
    });

    describe('POST /email/admin-contribution-received', () => {
        it('should send admin contribution received email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/admin-contribution-received')
                .send({
                    to_email: 'admin@example.com',
                    customerName: 'John Contributor',
                    amount: 50000000,
                    transactionID: 'CONTRIB123',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(res.body.statusCode).toBe(202);
                    expect(res.body.message).toBe(ResponseMessage.EMAIL_SENT);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            to_email: 'admin@example.com',
                            customerName: 'John Contributor',
                            transactionID: 'CONTRIB123',
                        })
                    );
                });
        });

        it('should return 400 for missing required fields', () => {
            return request(app.getHttpServer())
                .post('/email/admin-contribution-received')
                .send({
                    to_email: 'admin@example.com',
                    customerName: 'John Contributor',
                })
                .expect(400);
        });
    });

    describe('POST /email/admin-property-allocation', () => {
        it('should send admin property allocation email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/admin-property-allocation')
                .send({
                    to_email: 'admin@example.com',
                    customerName: 'Jane Doe',
                    planType: 'Standard Plan',
                    propertyDetail: '3 bedroom bungalow',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(res.body.statusCode).toBe(202);
                    expect(res.body.message).toBe(ResponseMessage.EMAIL_SENT);
                    expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                        expect.objectContaining({
                            to_email: 'admin@example.com',
                            customerName: 'Jane Doe',
                            planType: 'Standard Plan',
                        })
                    );
                });
        });
    });

    describe('POST /email/test-raw-html-email', () => {
        it('should send raw HTML email with valid data', () => {
            return request(app.getHttpServer())
                .post('/email/test-raw-html-email')
                .send({
                    to_email: 'test@example.com',
                    subject: 'Test HTML Email',
                    html: '<h1>Test Email</h1><p>This is a test</p>',
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                    expect(office365Service.sendHtmlEmail).toHaveBeenCalledWith(
                        'test@example.com',
                        '<h1>Test Email</h1><p>This is a test</p>',
                        'Test HTML Email'
                    );
                });
        });

        it('should return 400 for missing HTML', () => {
            return request(app.getHttpServer())
                .post('/email/test-raw-html-email')
                .send({
                    to_email: 'test@example.com',
                    subject: 'Test HTML Email',
                })
                .expect(400);
        });
    });

    describe('Error handling', () => {
        it('should handle Office365 service errors gracefully', () => {
            jest.spyOn(office365Service, 'sendTemplateEmail').mockRejectedValueOnce(
                new Error('Office365 API error')
            );

            return request(app.getHttpServer())
                .post('/email/reset-password')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    otp: '123456',
                    ttl: 5,
                })
                .expect(500);
        });

        it('should validate email format across all endpoints', async () => {
            const endpoints = [
                '/email/account-suspended',
                '/email/account-verified',
                '/email/reset-password',
                '/email/verify-email',
                '/email/admin-contribution-received',
                '/email/admin-property-allocation',
            ];

            for (const endpoint of endpoints) {
                await request(app.getHttpServer())
                    .post(endpoint)
                    .send({
                        to_email: 'invalid-email-format',
                        homeBuyerName: 'Test',
                    })
                    .expect(400);
            }
        });
    });

    describe('Email Preference Integration', () => {
        it('should check email preference before sending template email', async () => {
            await request(app.getHttpServer())
                .post('/email/reset-password')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    otp: '123456',
                    ttl: 5,
                })
                .expect(200);

            expect(emailPreferenceService.findOneByEmail).toHaveBeenCalledWith('test@example.com');
            expect(emailPreferenceService.buildUnsubscribeLink).toHaveBeenCalled();
        });

        it('should create preference if user does not exist', async () => {
            jest.spyOn(emailPreferenceService, 'findOneByEmail').mockResolvedValueOnce(null);

            await request(app.getHttpServer())
                .post('/email/verify-email')
                .send({
                    to_email: 'newuser@example.com',
                    homeBuyerName: 'New User',
                    otp: '999999',
                    ttl: 10,
                })
                .expect(200);

            expect(emailPreferenceService.findOneByEmail).toHaveBeenCalledWith('newuser@example.com');
            expect(emailPreferenceService.subscribe).toHaveBeenCalledWith('newuser@example.com');
        });

        it('should include unsubscribe link in all template emails', async () => {
            await request(app.getHttpServer())
                .post('/email/account-verified')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    loginLink: 'https://example.com/login',
                })
                .expect(200);

            expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    unsubscribeLink: expect.stringContaining('unsubscribe'),
                })
            );
        });
    });

    describe('Integration with DTO validation', () => {
        it('should transform amount using FormatHelper for missed-payments', async () => {
            await request(app.getHttpServer())
                .post('/email/missed-payments')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    amount: 50000000,
                    loginLink: 'https://example.com/login',
                })
                .expect(200);

            expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: expect.stringMatching(/₦/), // Should contain Naira symbol
                })
            );
        });

        it('should transform URL using encodeURI for account-verified', async () => {
            await request(app.getHttpServer())
                .post('/email/account-verified')
                .send({
                    to_email: 'test@example.com',
                    homeBuyerName: 'John Doe',
                    loginLink: 'https://example.com/login?param=value with spaces',
                })
                .expect(200);

            expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    loginLink: expect.not.stringContaining(' '), // Spaces should be encoded
                })
            );
        });
    });
});
