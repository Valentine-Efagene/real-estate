import { Test, TestingModule } from '@nestjs/testing';
import EmailService from './email.service';
import Office365Service from '../office365/office365.service';
import SlackService from '../slack/slack.service';
import PushService from '../push/push.service';
import { DeviceEndpointService } from '../device_endpoint/device_endpoint.service';
import { EmailPreferenceService } from '../email_preference/email_preference.service';
import { TemplateType } from './email.enum';

describe('EmailService', () => {
    let service: EmailService;
    let office365Service: Office365Service;
    let emailPreferenceService: EmailPreferenceService;

    const mockOffice365Service = {
        sendTemplateEmail: jest.fn(),
        sendEmail: jest.fn(),
        sendHtmlEmail: jest.fn(),
    };

    const mockEmailPreferenceService = {
        findOneByEmail: jest.fn(),
        subscribe: jest.fn(),
        buildUnsubscribeLink: jest.fn(),
    };

    const mockSlackService = {};
    const mockPushService = {};
    const mockDeviceEndpointService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailService,
                { provide: Office365Service, useValue: mockOffice365Service },
                { provide: EmailPreferenceService, useValue: mockEmailPreferenceService },
                { provide: SlackService, useValue: mockSlackService },
                { provide: PushService, useValue: mockPushService },
                { provide: DeviceEndpointService, useValue: mockDeviceEndpointService },
            ],
        }).compile();

        service = module.get<EmailService>(EmailService);
        office365Service = module.get<Office365Service>(Office365Service);
        emailPreferenceService = module.get<EmailPreferenceService>(EmailPreferenceService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sendTemplateEmail', () => {
        it('should send template email with proper data transformation', async () => {
            const mockPreference = {
                id: 1,
                email: 'test@example.com',
                unsubscribeToken: 'test-token',
                unSubscribed: false,
            };

            const mockResponse = {
                status: 202,
                data: {},
                headers: {
                    'x-ms-request-id': 'test-request-id',
                },
            };

            mockEmailPreferenceService.findOneByEmail.mockResolvedValue(mockPreference);
            mockEmailPreferenceService.buildUnsubscribeLink.mockReturnValue('https://example.com/unsubscribe/test-token');
            mockOffice365Service.sendTemplateEmail.mockResolvedValue(mockResponse);

            const dto = {
                to_email: 'test@example.com',
                templateName: TemplateType.ResetPassword,
                homeBuyerName: 'John Doe',
                otp: '123456',
                ttl: 5,
            };

            const result = await service.sendTemplateEmail(dto);

            expect(emailPreferenceService.findOneByEmail).toHaveBeenCalledWith('test@example.com');
            expect(office365Service.sendTemplateEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to_email: 'test@example.com',
                    templateName: TemplateType.ResetPassword,
                    homeBuyerName: 'John Doe',
                    otp: '123456',
                    ttl: 5,
                    unsubscribeLink: expect.any(String),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should create preference if none exists', async () => {
            const mockPreference = {
                id: 1,
                email: 'newuser@example.com',
                unsubscribeToken: 'new-token',
                unSubscribed: false,
            };

            mockEmailPreferenceService.findOneByEmail.mockResolvedValue(null);
            mockEmailPreferenceService.subscribe.mockResolvedValue(mockPreference);
            mockEmailPreferenceService.buildUnsubscribeLink.mockReturnValue('https://example.com/unsubscribe/new-token');
            mockOffice365Service.sendTemplateEmail.mockResolvedValue({ status: 202, data: {}, headers: {} });

            const dto = {
                to_email: 'newuser@example.com',
                templateName: TemplateType.VerifyEmail,
                homeBuyerName: 'Jane Doe',
                otp: '654321',
                ttl: 10,
            };

            await service.sendTemplateEmail(dto);

            expect(emailPreferenceService.subscribe).toHaveBeenCalledWith('newuser@example.com');
            expect(office365Service.sendTemplateEmail).toHaveBeenCalled();
        });

        it('should throw error when Office365 fails', async () => {
            const mockPreference = {
                id: 1,
                email: 'test@example.com',
                unsubscribeToken: 'test-token',
                unSubscribed: false,
            };

            mockEmailPreferenceService.findOneByEmail.mockResolvedValue(mockPreference);
            mockEmailPreferenceService.buildUnsubscribeLink.mockReturnValue('https://example.com/unsubscribe/test-token');
            mockOffice365Service.sendTemplateEmail.mockRejectedValue(new Error('Office365 error'));

            const dto = {
                to_email: 'test@example.com',
                templateName: TemplateType.Otp,
                homeBuyerName: 'Test User',
                otp: '999999',
                ttl: 3,
            };

            await expect(service.sendTemplateEmail(dto)).rejects.toThrow('Office365 error');
        });
    });

    describe('sendEmail', () => {
        it('should send email successfully', async () => {
            const mockResponse = {
                status: 202,
                data: {},
                headers: { 'x-ms-request-id': 'test-id' },
            };

            mockOffice365Service.sendEmail.mockResolvedValue(mockResponse);

            const dto = {
                to_email: 'test@example.com',
                subject: 'Test Subject',
                message: 'Test Message',
            };

            const result = await service.sendEmail(dto);

            expect(office365Service.sendEmail).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('sendHtmlEmail', () => {
        it('should send HTML email successfully', async () => {
            const mockResponse = {
                status: 202,
                data: {},
                headers: { 'x-ms-request-id': 'test-id' },
            };

            mockOffice365Service.sendHtmlEmail.mockResolvedValue(mockResponse);

            const result = await service.sendHtmlEmail(
                'test@example.com',
                '<h1>Test HTML</h1>',
                'Test Subject'
            );

            expect(office365Service.sendHtmlEmail).toHaveBeenCalledWith(
                'test@example.com',
                '<h1>Test HTML</h1>',
                'Test Subject'
            );
            expect(result).toEqual(mockResponse);
        });
    });
});
