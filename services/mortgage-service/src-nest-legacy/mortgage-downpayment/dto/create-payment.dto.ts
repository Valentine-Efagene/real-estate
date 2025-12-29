import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDownpaymentPaymentDto {
    @IsNumber()
    amount: number;

    @IsString()
    @IsOptional()
    providerReference?: string;
}
