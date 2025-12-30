import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";


export class SendSmsDto {
    @ApiProperty({
        example: '+2349074384763',
    })
    @IsNotEmpty()
    destinationNumber: string;

    @ApiProperty({
        example: "Adipisicing ipsum nostrud occaecat non. Aliqua esse fugiat tempor sint.",
    })
    message: string;
}
