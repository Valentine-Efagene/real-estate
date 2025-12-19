import { IsString, IsOptional, IsEnum, IsEmail, IsObject, MaxLength, MinLength, Matches } from 'class-validator';
import { TenantStatus, TenantPlan } from './tenant.enums';

export class CreateTenantDto {
    @IsString()
    @MaxLength(255)
    name: string;

    @IsString()
    @MinLength(3)
    @MaxLength(100)
    @Matches(/^[a-z0-9-]+$/, { message: 'Subdomain can only contain lowercase letters, numbers, and hyphens' })
    subdomain: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    domain?: string;

    @IsOptional()
    @IsEnum(TenantStatus)
    status?: TenantStatus;

    @IsOptional()
    @IsEnum(TenantPlan)
    plan?: TenantPlan;

    @IsOptional()
    @IsObject()
    config?: any;

    @IsOptional()
    @IsEmail()
    contactEmail?: string;

    @IsOptional()
    @IsString()
    contactPhone?: string;
}

export class UpdateTenantDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    domain?: string;

    @IsOptional()
    @IsEnum(TenantStatus)
    status?: TenantStatus;

    @IsOptional()
    @IsEnum(TenantPlan)
    plan?: TenantPlan;

    @IsOptional()
    @IsObject()
    config?: any;

    @IsOptional()
    @IsEmail()
    contactEmail?: string;

    @IsOptional()
    @IsString()
    contactPhone?: string;
}
