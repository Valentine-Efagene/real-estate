import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDownpaymentPlanDto {
    @IsNumber()
    @Min(0)
    totalAmount: number;

    @IsInt()
    @IsOptional()
    installmentCount?: number;

    @IsString()
    @IsOptional()
    frequency?: string; // DAILY, WEEKLY, MONTHLY

    @IsString()
    @IsOptional()
    startDate?: string;
}
