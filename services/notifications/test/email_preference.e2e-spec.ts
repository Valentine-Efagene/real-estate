import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi'
import { CustomNamingStrategy } from '../src/common/helpers/CustomNamingStrategy';
import { EmailPreference } from '../../../shared/common/entities/email_preference.entity';
import { EmailPreferenceModule } from '../src/email_preference/email_preference.module';
import { UnSubscribeDto } from 'src/email_preference/email_preference.dto';

describe('EmailPreferenceModule (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    validationSchema: Joi.object({
                        DOMAIN: Joi.string().uri()
                    })
                }),
                TypeOrmModule.forRoot({
                    type: 'mysql',
                    host: 'localhost',
                    port: parseInt(process.env.DB_PORT) ?? 3306,
                    username: process.env.DB_USERNAME ?? 'root',
                    password: process.env.DB_PASSWORD ?? '',
                    database: 'mofi_test',
                    synchronize: true,
                    namingStrategy: new CustomNamingStrategy(),
                    dropSchema: true,
                    entities: [EmailPreference]
                }),
                EmailPreferenceModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe()); // Enable validation
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should subscribe a new email', async () => {
        const response = await request(app.getHttpServer())
            .get('/email-preference/subscribe')
            .query({ email: 'test@example.com' })
            .expect(200);

        expect(response.body.data).toHaveProperty('email', 'ayorinde.akindeko@gmail.com');
        expect(response.body.data.unSubscribed).toBe(false);
        expect(response.body.data).toHaveProperty('unsubscribeToken');
    });


    it('should ensure the subscribe endpoint is idempotent', async () => {
        const firstResponse = await request(app.getHttpServer())
            .get('/email-preference/subscribe')
            .query({ email: 'idempotent@example.com' })
            .expect(200);

        const secondResponse = await request(app.getHttpServer())
            .get('/email-preference/subscribe')
            .query({ email: 'idempotent@example.com' })
            .expect(200);

        // The email should remain the same
        expect(secondResponse.body.data.email).toBe('idempotent@example.com');

        // The unsubscribeToken should remain the same for the same email
        expect(secondResponse.body.data.unsubscribeToken).toBe(
            firstResponse.body.data.unsubscribeToken
        );
    });

    it('should unsubscribe an email', async () => {
        const subscribeResponse = await request(app.getHttpServer())
            .get('/email-preference/subscribe')
            .query({ email: 'test@example.com' })
            .expect(200);

        const unsubscribeToken = subscribeResponse.body.data.unsubscribeToken;
        const unsubscribeDto: UnSubscribeDto = { token: unsubscribeToken };

        const response = await request(app.getHttpServer())
            .get('/email-preference/unsubscribe')
            .query(unsubscribeDto)
            .expect(200);

        expect(response.body.data).toHaveProperty('unSubscribed', true);
        expect(response.body.data.unsubscribeToken).toBeNull();
        expect(response.body.data.unSubscribed).toBe(true);
    });

    it('should return 404 when unsubscribing with an invalid token', async () => {
        await request(app.getHttpServer())
            .get('/email-preference/unsubscribe')
            .query({ email: 'test@example.com', token: 'invalid-token' })
            .expect(404);
    });
});
