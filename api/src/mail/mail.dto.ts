import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateMailDto {
  @ApiProperty({ nullable: true, example: 'can_list_properties' })
  name: string;
}

export class SendMailDto {
  @ApiProperty({
    nullable: false,
    example: 'Johnny Ufuoma'
  })
  @IsNotEmpty()
  @IsString()
  name?: string;

  @ApiProperty({
    nullable: false,
    example: 'johnnyufuoma@testmail.com'
  })
  @IsNotEmpty()
  @IsString()
  receiverEmail?: string;

  @ApiProperty({
    nullable: false,
    example: 'Testing stuff.'
  })
  @IsNotEmpty()
  @IsString()
  message: string
}

export class SendVerificationMailDto {
  @ApiProperty({
    nullable: false,
    example: 'Johnny Ufuoma'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    nullable: false,
    example: 'johnnyufuoma@testmail.com'
  })
  @IsNotEmpty()
  @IsString()
  link: string;

  @ApiProperty({
    nullable: false,
    example: 'johnnyufuoma@testmail.com'
  })
  @IsNotEmpty()
  @IsString()
  receiverEmail?: string;
}

export class SendPasswordResetMailDto {
  @ApiProperty({
    nullable: false,
    example: 'johnnyufuoma@testmail.com'
  })
  @IsNotEmpty()
  @IsString()
  receiverEmail: string;

  @ApiProperty({
    nullable: false,
    example: 'Johnny Ufuoma'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    nullable: false,
    example: 'johnnyufuoma@testmail.com'
  })
  @IsNotEmpty()
  @Transform(({ value }) => {
    return encodeURI(value)
  })
  @IsUrl()
  resetUrl: string;
}

export class SendTicketMailDto {
  @ApiProperty({
    nullable: false,
    example: 1
  })
  @IsNotEmpty()
  @Transform(({ value }) => {
    return parseInt(value)
  })
  @IsInt()
  ticketId: number;
}

export class TestDto {

}

export class SendPaymentReminderDto {
  name: string;
  receiverEmail: string;
  amount: number;
  dueDate: string; // ISO date string
  mortgageId: number;
}