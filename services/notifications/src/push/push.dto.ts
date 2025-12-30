import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsBoolean, IsObject, IsOptional, IsString, IsInt } from "class-validator";


export class SendMessageDto {
    @ApiProperty({
        example: 'mofi-logs',
    })
    @IsNotEmpty()
    channel: string;

    @ApiProperty({
        example: "Adipisicing ipsum nostrud occaecat non. Aliqua esse fugiat tempor sint.",
    })
    @IsNotEmpty()
    text: string;
}

class BotProfileDto {
    @IsString()
    id: string;

    @IsString()
    app_id: string;

    @IsString()
    name: string;

    @IsObject()
    icons: object; // Define a specific structure if you know the properties of icons

    @IsBoolean()
    deleted: boolean;

    @IsOptional()
    @IsString()
    updated: string;

    @IsString()
    team_id: string;
}

class MessageDto {
    @IsString()
    user: string;

    @IsString()
    type: string;

    @IsString()
    ts: string;

    @IsString()
    bot_id: string;

    @IsString()
    app_id: string;

    @IsString()
    text: string;

    @IsString()
    team: string;

    @IsObject()
    bot_profile: BotProfileDto;

    @IsOptional()
    @IsObject()
    blocks: object[]; // Define structure if blocks have specific properties
}

class ResponseMetadataDto {
    @IsOptional()
    @IsObject({ each: true })
    warnings: string[];
}

export class WebPushResponseDto {
    @IsBoolean()
    ok: boolean;

    @IsString()
    channel: string;

    @IsString()
    ts: string;

    @IsObject()
    message: MessageDto;

    @IsOptional()
    @IsString()
    warning: string;

    @IsOptional()
    @IsObject()
    response_metadata: ResponseMetadataDto;
}


export class WebPushDto {
    @ApiProperty()
    @IsString()
    token: string;

    @ApiProperty()
    @IsString()
    title: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    message?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    warning?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    link?: string;
}

export class TokenRegistrationDto {
    @ApiProperty({
        example: 'eFThnIAGbEDjQ5YIcKu-6z:APA91bFC0zN-mARqqftj5tkGMXPX9PrmuUnq3Im12pP0035zKU8BTGhLQP74tlu6JMAGQntgKobUORMOcvfKNcd82jYBUMBrsYnHcPiwfVUX8HwV-srd9a0'
    })
    @IsNotEmpty()
    @IsString()
    token: string;

    @ApiProperty({
        example: 1
    })
    @IsInt()
    userId: number;
}

export class NotificationDto {
    @ApiProperty({
        example: 'New message from admin@admin.com'
    })
    @IsString()
    title: string;

    @ApiProperty({
        example: 'Hello, how are you doing?'
    })
    @IsString()
    message: string;

    @ApiProperty({
        example: 'arn:aws:sns:us-east-1:898751738669:endpoint/GCM/qshelter_notification/8ad29fff-ab54-370d-b24e-19ff0a715a87'
    })
    @IsString()
    endpointArn: string;
}


export class EndpointVerificationDto {
    @ApiProperty({
        example: 'arn:aws:sns:us-east-1:898751738669:endpoint/GCM/qshelter_notification/8ad29fff-ab54-370d-b24e-19ff0a715a87'
    })
    @IsNotEmpty()
    @IsString()
    endpointArn: string;
}

