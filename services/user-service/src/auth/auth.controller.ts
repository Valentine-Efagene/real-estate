
import {
    Body,
    Controller,
    Post,
    HttpCode,
    HttpStatus,
    UseGuards,
    Get,
    Query,
    Req
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenDto, RequestPasswordResetDto, ResetPasswordDto, SignInDto, SignUpDto } from './auth.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '@valentine-efagene/qshelter-common';
import { ResponseMessage } from '../common/common.enum';
import { SerializeUser } from './decorator';
import { User } from '../user/user.entity';
import { SwaggerAuth } from '@valentine-efagene/qshelter-common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IAuthTokensAndUser } from './auth.type';
import { GoogleOAuthGuard } from './guard/google-oauth.guard';
import { Request } from 'express';

@ApiTags('Auth')
// @UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
    ) { }

    @ApiOperation({
        summary: `Sign in with Google using token. This is for when 
        the front- end initiates the request, like when using @react - oauth / google`
    })
    @HttpCode(HttpStatus.OK)
    @Post('sign-in/google-token')
    async googleTokenSignIn(
        @Body('token') token: string,
    ): Promise<StandardApiResponse<IAuthTokensAndUser>> {
        const response = await this.authService.googleTokenLogin(token);
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.AUTHENTICATED, response);
    }

    @HttpCode(HttpStatus.OK)
    @Throttle({
        default: {
            limit: 3,
            ttl: 60000
        }
    })
    @Post('sign-in')
    async signIn(
        @Body() dto: SignInDto,
    ): Promise<StandardApiResponse<IAuthTokensAndUser>> {
        const response = await this.authService.signIn(dto);
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.AUTHENTICATED, response)
    }

    @HttpCode(HttpStatus.OK)
    @Post('sign-up')
    async signUp(@Body() dto: SignUpDto): Promise<StandardApiResponse<User>> {
        const response = await this.authService.signUp(dto);
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.USER_SIGNUP_SUCCESSFUL, response)
    }

    @HttpCode(HttpStatus.OK)
    @Post('request-password-reset')
    async requestReset(@Body() dto: RequestPasswordResetDto): Promise<StandardApiResponse<void>> {
        const response = await this.authService.requestPasswordReset(dto.email);
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.DONE, response)
    }

    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto): Promise<StandardApiResponse<void>> {
        const response = await this.authService.resetPassword(dto.token, dto.newPassword);
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.DONE, response)
    }

    @HttpCode(HttpStatus.OK)
    @Get('verify-email')
    async verifyEmail(@Query('token') token: string): Promise<StandardApiResponse<User>> {
        const response = await this.authService.verifyEmail(token);
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.CREATED, response)
    }

    @SwaggerAuth()
    @Post('refresh')
    async refreshToken(
        @SerializeUser() user: User,
        @Body() dto: RefreshTokenDto
    ): Promise<StandardApiResponse<{ accessToken: string }>> {
        const tokens = await this.authService.refreshToken(user, dto)
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.CREATED, tokens);
    }

    @SwaggerAuth()
    @Get('profile')
    async currentUser(
        @SerializeUser() user: User,
    ): Promise<StandardApiResponse<User>> {
        return new StandardApiResponse(HttpStatus.OK, ResponseMessage.CREATED, user);
    }

    @Get('google')
    @UseGuards(GoogleOAuthGuard)
    async googleAuth() {
        // redirects to Google
    }

    @Get('google/callback')
    @UseGuards(GoogleOAuthGuard)
    async googleAuthRedirect(
        @Req() req: Request
    ) {
        // Handle successful login here
        return this.authService.googleLogin(req)
    }
}
