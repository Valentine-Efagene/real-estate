import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsBoolean, IsObject, IsOptional, IsString } from "class-validator";


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

export class SlackResponseDto {
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
