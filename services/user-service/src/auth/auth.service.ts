
import { BadRequestException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RefreshTokenDto, SignInDto, SignUpDto, SignUpStrippedDto } from './auth.dto';
import { User, PasswordResetToken, Role } from '@valentine-efagene/qshelter-common';
import { IAccessTokenPayload, IAuthTokensAndUser, IGoogleAuthProfileParsed, IJwtConfig } from './auth.type';
import { RefreshTokenService } from '../refresh_token/refresh_token.service';
import { accessTokenConfig, refreshTokenConfig } from './auth.constants';
import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes, randomUUID } from 'crypto'
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, QueryRunner, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '../user/user.enums';
import { RoleName } from '../role/role.enums';

function generateRandomString(length = 16) {
    return randomBytes(length).toString('hex').slice(0, length);
}

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        private refreshTokenService: RefreshTokenService,
        private configService: ConfigService,

        @InjectRepository(PasswordResetToken)
        private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    async requestPasswordReset(email: string): Promise<void> {
        const user = await this.userService.findOneByEmail(email);
        if (!user) return; // Prevent email enumeration

        let _resetToken = await this.passwordResetTokenRepository.findOneBy({
            user: {
                id: user.id
            }
        })

        const token = randomUUID();
        const tokenHash = await bcrypt.hash(token, 10);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

        if (!_resetToken) {
            _resetToken = this.passwordResetTokenRepository.create({
                user: {
                    id: user.id
                },
            })
        }

        this.passwordResetTokenRepository.merge(_resetToken, {
            tokenHash,
            expiresAt
        })

        await this.passwordResetTokenRepository.save(_resetToken)

        const resetUrl = `${this.configService.get('FRONTEND_BASE_URL')}/auth/reset-password?token=${token}`;

        // TODO: Publish event to event bus to trigger notification service
        // await eventBus.publish('user.password-reset-requested', {
        //     name: user.firstName,
        //     receiverEmail: user.email,
        //     resetUrl
        // });
        this.logger.log(`Password reset requested for user ${user.email}`);
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const resetTokens = await this.passwordResetTokenRepository.find({
            where: {
                expiresAt: MoreThan(new Date())
            },
            relations: ['user']
        });

        const resetToken = resetTokens.find(u => bcrypt.compareSync(token, u.tokenHash));

        if (!resetToken) {
            throw new BadRequestException('Invalid or expired password reset token');
        }

        const user = resetToken.user

        user.password = await bcrypt.hash(newPassword, 10);
        resetToken.tokenHash = null;
        resetToken.expiresAt = null;

        await this.passwordResetTokenRepository.save(resetToken);
        await this.userRepository.save(user)
    }

    async validateUser(identifier: string, password: string): Promise<Omit<User, 'password'> | null> {
        const user = await this.userService.findOneByEmail(identifier);


        if (!user) {
            return null
        }

        const match = await bcrypt.compare(password, user.password)

        if (match) {
            const { password, ...result } = user;
            return result;
        }

        return null;
    }

    async signUp(user: SignUpDto, autoVerify: boolean = false): Promise<User> {
        const existingUser = await this.userService.findOneByEmail(user.email);

        if (existingUser) {
            throw new BadRequestException('Email already exists');
        }

        const newUser = await this.userService.create(user);
        const verificationToken = randomBytes(32).toString('hex');
        const _updated = this.userRepository.merge(newUser, {
            emailVerificationToken: verificationToken,
            isEmailVerified: autoVerify,
            status: autoVerify ? UserStatus.ACTIVE : UserStatus.PENDING,
        })

        const updated = await this.userRepository.save(_updated)

        if (!updated) {
            throw new InternalServerErrorException('Something went wrong')
        }

        if (!autoVerify) {
            // TODO: Publish event to event bus to trigger notification service
            // await eventBus.publish('user.email-verification-requested', {
            //     link: `${process.env.BASE_URL}/auth/verify-email?token=${verificationToken}`,
            //     name: user.firstName,
            //     receiverEmail: newUser.email
            // });
            this.logger.log(`Email verification requested for ${newUser.email}`);
        }

        return newUser
    }

    async inviteStaff(dto: SignUpStrippedDto, queryRunner: QueryRunner, autoVerify: boolean = false): Promise<User> {
        let user = await this.userRepository.findOne({
            where: {
                email: dto.email
            }
        });

        if (!user) {
            const _newUser = this.userRepository.create(dto);
            user = await queryRunner.manager.save(_newUser)
        }

        const verificationToken = randomBytes(32).toString('hex');

        const _updated = this.userRepository.merge(user, {
            emailVerificationToken: verificationToken,
            isEmailVerified: autoVerify,
            status: autoVerify ? UserStatus.ACTIVE : UserStatus.PENDING,
        })
        const staffRole = await queryRunner.manager.getRepository(Role).findOneBy({
            name: RoleName.STAFF
        })
        _updated.roles = [staffRole]

        const updated = await queryRunner.manager.save(_updated)

        if (!updated) {
            throw new InternalServerErrorException('Something went wrong')
        }

        if (!autoVerify) {
            // TODO: Publish event to event bus to trigger notification service
            // await eventBus.publish('user.email-verification-requested', {
            //     link: `${process.env.BASE_URL}/auth/verify-email?token=${verificationToken}`,
            //     name: dto.firstName,
            //     receiverEmail: user.email
            // });
            this.logger.log(`Email verification requested for staff ${user.email}`);
        }

        return updated
    }

    async googleLogin(req: Request): Promise<IAuthTokensAndUser> {
        if (!req.user) {
            throw new BadRequestException('Authentication Failed')
        }

        const profile: IGoogleAuthProfileParsed = req.user as IGoogleAuthProfileParsed

        let user: User
        user = await this.userService.findOneByEmail(profile.email)

        if (user) {
            return this.generateTokens(user)
        }

        const password = generateRandomString()

        const signUpDto: SignUpDto = {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            password,
            avatar: profile.avatar
        }
        // Create user with auto verification
        // This is because Google users are usually not required to verify their email
        // as they are already verified by Google
        const _user = await this.signUp(signUpDto, true)

        if (!_user) {
            throw new InternalServerErrorException('Something went wrong')
        }

        return this.signIn({
            identifier: _user.email,
            password
        })
    }

    async verifyEmail(token: string) {
        const user = await this.userService.findOneByEmailVerificationToken(token)

        if (!user) {
            throw new BadRequestException('Invalid token')
        }

        const updatedUser = this.userRepository.merge(user, {
            isEmailVerified: true,
            status: UserStatus.ACTIVE
        })

        return await this.userRepository.save(updatedUser)
    }

    async generateJWT(payload: IAccessTokenPayload, config: IJwtConfig) {
        return this.jwtService.sign(payload, {
            secret: config.secret,
            expiresIn: config.expiresIn,
        });
    }

    async refreshToken(
        user: User,
        dto: RefreshTokenDto,
    ): Promise<{ accessToken: string }> {
        const refreshToken = await this.refreshTokenService.findOneByToken(dto.refreshToken);

        if (!refreshToken) {
            throw new UnauthorizedException();
        }

        const payload: IAccessTokenPayload = {
            sub: user.id,
            identifier: user.email,
            roles: user.roles.map(role => role.name)
        };

        const accessToken = await this.generateJWT(payload, accessTokenConfig());
        await this.refreshTokenService.replaceToken({
            token: accessToken,
            userId: user.id
        })

        return {
            accessToken,
        };
    }

    async signIn(dto: SignInDto): Promise<IAuthTokensAndUser> {
        const user = await this.validateUser(dto.identifier, dto.password)
        return this.generateTokens(user)
    }

    async generateTokens(user: Omit<User, "password"> | null): Promise<IAuthTokensAndUser> {
        if (!user) {
            throw new BadRequestException('Invalid credentials');
        }

        if (!user.isEmailVerified) {
            throw new BadRequestException('Please verify your email')
        }

        const payload: IAccessTokenPayload = {
            sub: user.id,
            identifier: user.email,
            roles: user.roles?.map(role => role.name)
        };

        const accessToken = await this.generateJWT(payload, accessTokenConfig());
        const refreshToken = await this.generateJWT(payload, refreshTokenConfig());

        const doc = await this.refreshTokenService.findOneByUserId(user.id)

        if (doc) {
            await this.refreshTokenService.replaceToken({ token: refreshToken, userId: user.id });

            return {
                accessToken,
                refreshToken,
                user
            };
        }

        await this.refreshTokenService.create({
            userId: user.id,
            token: refreshToken,
        });

        return {
            accessToken,
            refreshToken,
            user
        };
    }

    async googleTokenLogin(idToken: string): Promise<IAuthTokensAndUser> {
        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload?.email) throw new BadRequestException('Invalid Google token');

        const { email, given_name, family_name, picture } = payload;

        let user = await this.userService.findOneByEmail(email);
        user = await this.userService.findOneByEmail(email)

        if (user) {
            return this.generateTokens(user)
        }

        const password = generateRandomString()

        const signUpDto: SignUpDto = {
            firstName: given_name ?? '',
            lastName: family_name ?? '',
            email,
            password,
            avatar: picture
        }
        // Create user with auto verification
        // This is because Google users are usually not required to verify their email
        // as they are already verified by Google
        user = await this.signUp(signUpDto, true)

        if (!user) {
            throw new InternalServerErrorException('Something went wrong')
        }

        return this.signIn({
            identifier: user.email,
            password
        })
    }
}
