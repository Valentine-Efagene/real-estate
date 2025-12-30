import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsUrl,
} from "class-validator";
import { Transform } from "class-transformer";
import { Section, TemplateType } from "./email.enum";
import { ProjectStatus, ProjectType } from "../common/common.enum";
import { IsNaira } from "../common/validators/is-naira.validator";
import FormatHelper from "../common/helpers/FormatHelper";

const mock = {
    firstName: 'Johnny',
    projectStatus: ProjectStatus.PENDING,
    name: 'Johnny',
    businessName: 'Tesla',
    bankName: 'Zenith',
    accountNumber: '483948394999',
    applicationType: 'Commercial Mortgage',
    projectType: ProjectType.OFF_PLAN,
    otp: '4343',
    platform: 'Hope',
    serviceType: 'Inspection',
    customerName: 'Ufuoma',
    buyersName: 'Ufuoma',
    customerPhone: '+43435353434',
    rcNumber: '3435353434',
    contactInfo: '+43435353434',
    buyersPhone: '+43435353434',
    amenities: 'CCTV, Water heater',
    phone: '+43435353434',
    customerEmail: 'janedoe@testmail.com',
    // email: 'janedoe@mailsac.com',
    email: 'efagenevalentine@gmail.com',
    propertyDetails: '4 bedroom semi-detached duplex',
    propertyTitle: '4 bedroom semi-detached duplex',
    documentTitle: 'CAC Certificate',
    buyersEmail: 'janedoe@testmail.com',
    mortgageType: 'Commercial',
    propertyInfo: '4 bedroom semi-detached duplex',
    propertyCost: 400000000,
    loanAmount: 400000000,
    equityAmount: 400000000,
    password: 'hfu834h98JAK3920',
    developerName: 'Homes',
    batchNumber: 111,
    numberOfApplications: 332,
    modeOfInspection: 'Virtual',
    virtualOrPhysical: 'Virtual',
    amount: 400000000,
    preferredMortgageBank: 'Homebase',
    lender: 'Homebase',
    requestId: 121,
    applicationNumber: 1200,
    url: 'https://www.w3.org/Provider/Style/dummy.html',
    dashboardLink: 'https://www.w3.org/Provider/Style/dummy.html',
    companyWebsite: 'https://example.com',
    projectLocation: 'Karsana, Abuja',
    projectName: 'Karsana, Abuja',
    propertyAddress: 'Karsana, Abuja',
    dateAndTime: '03-04-2024 10:32',
    location: 'Karsana, Abuja',
    city: 'Abuja',
    state: 'FCT',
    date: '04-03-2024',
    time: '10:33',
    propertyType: 'duplex',
    duration: 100,
    declineReason: 'Anim laboris pariatur voluptate incididunt esse mollit qui est.',
    supportEmail: 'homebase@info.ng',
    supportPhone: '+45454656565',
    interestRate: 10,
    percentage: 10,
    username: 'janedoe'
}

export class BaseEmailDto {
    @ApiProperty({
        example: mock.email,
    })
    @IsEmail()
    to_email: string;
}

export class SendTemplateEmailDto extends BaseEmailDto {
    @ApiPropertyOptional({
        example: 'Subject of the email',
    })
    @IsOptional()
    subject?: string;

    @ApiProperty({
        example: TemplateType.Otp,
    })
    @IsNotEmpty()
    @IsEnum(TemplateType)
    templateName: string
}

export class SendRawTemplateEmailDto extends BaseEmailDto {
    @ApiPropertyOptional({
        example: 'Subject of the email',
    })
    @IsOptional()
    subject: string;

    @ApiProperty({
        example: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
</head>

<body style="margin:0; padding:0; background-color:#F5F7FA; font-family:Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7FA; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="460" cellpadding="0" cellspacing="0"
                    style=" border-radius:10px; overflow:hidden;">
                    <tr>
                        <td ">
                            <img src="https://d326lvj7db9a4n.cloudfront.net/contribuild-banner.png" width="460" height="78" alt="ContriBuild"
                                style="display:block;" />
                        </td>
                    </tr>
                </table>

                <!-- Container -->
                <table width="460" cellpadding="0" cellspacing="0"
                    style="background-color:#ffffff; border-radius:10px; overflow:hidden; margin: 20px 0;">

                    <!-- Header -->


                    <!-- Content -->
                    <tr>
                        <td style="padding: 24px; ">

                            <h2 style="margin:0 0 10px 0; font-size:22px; font-weight:semibold;">
                                Reset Your Password
                            </h2>
                             <img src="https://d326lvj7db9a4n.cloudfront.net/contribuild-banner.png" width="460" height="78" alt="ContriBuild"
                                style="display:block;" />

                            <p style="font-size:14px; line-height:22px; margin:25px 0;">
                                Hello Johnny 👋,
                            </p>

                            <p style="font-size:14px; line-height:22px; margin:10px 0 25px;">
                                Please enter the OTP below to reset your password.
                            </p>

                            <p style="font-size:24px; font-weight:semibold; letter-spacing:4px; margin:0 0 20px;">
                                4343
                            </p>

                            <p style="font-size:14px; line-height:20px; margin:0 0 25px;">
                                This code expires in 4 minutes.
                            </p>

                            <p style="font-size:14px; line-height:20px; margin:0;">
                                If you didn't sign up on ContriBuild, please reach out to us at<br>
                                <a href="mailto:mreif@quickshelter.ng"
                                    style="color:#1E1E1E; text-decoration:underline;">
                                    mreif@quickshelter.ng
                                </a>
                            </p>

                            <p style="font-size:14px; line-height:20px; margin-top:30px;">
                                Best, <br />
                                The ContriBuild Team.
                            </p>

                        </td>
                    </tr>

                </table>

                <!-- Footer -->
                <table width="600" cellpadding="0" cellspacing="0"
                    style="margin-top:15px; text-align:center; color:#033950">
                    <tr>
                        <td style="font-size:13px; padding:10px;">
                            Need help? send an email to
                            <a href="mailto:mreif@quickshelter.ng" style="color:#033950; text-decoration:underline;">
                                mreif@quickshelter.ng
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="font-size:13px; padding-bottom:10px;">
                            ContriBuild © 2025
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>

</html>`,
    })
    @IsNotEmpty()
    html: string
}

export class CheckTemplateFileExistsDto {
    @ApiProperty({
        example: 'developerSalesNotification.html'
    })
    fileName: string;

    @ApiProperty({
        example: Section.MORTGAGE
    })
    module: string;
}

export class NotificationDto {
    @ApiProperty({
        example: TemplateType.Otp,
        type: 'enum',
        enum: TemplateType
    })
    @IsEnum(TemplateType)
    templateName: TemplateType;
}

export class GetEmailTemplateDto {
    @ApiProperty({
        example: TemplateType.Otp,
        type: 'enum',
        enum: TemplateType
    })
    @IsEnum(TemplateType)
    templateName: TemplateType;
}

export class SendEmailDto {
    @ApiProperty({
        example: mock.email,
    })
    @IsNotEmpty()
    @IsEmail()
    to_email: string;

    @ApiProperty({
        example: "otp",
    })
    @IsNotEmpty()
    subject: string;

    @ApiProperty({
        example: "otp",
    })
    @IsNotEmpty()
    message: string;
}

export class TestTempDto {
    @ApiProperty({
        example: '/contribuild/adminAcceptanceOfferLetter.html'
    })
    @IsNotEmpty()
    path: string
}

export class SesExceptionError {
    @ApiProperty()
    Type: string

    @ApiProperty()
    Code: string

    @ApiProperty()
    Message: string

    @ApiProperty()
    message: string
}

export class SuccessResponseDto {
    @ApiProperty({ example: 200 })
    statusCode: number;

    @ApiProperty({
        example: "Created Successfully"
    })
    message: string;

    @ApiPropertyOptional({
        example: true
    })
    success: boolean;
}

export class ErrorResponseDto {
    @ApiProperty({ example: 400 })
    statusCode: number;

    @ApiProperty({
        examples: [
            "to_email must be an email",
            "to_email should not be empty"
        ]
    })
    message: string | string[];
}

export class AccountSuspendedDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    reason: string;
}

export class AccountVerifiedDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiProperty({ example: mock.dashboardLink })
    @IsNotEmpty()
    @Transform(({ value }) => encodeURI(value))
    @IsUrl()
    loginLink: string;
}

export class MissedPaymentsDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiPropertyOptional({
        example: mock.amount,
        description: 'Amount to be credited to wallet'
    })
    @IsNotEmpty()
    @IsNaira()
    @Transform(({ value }) => FormatHelper.nairaFormatter.format(value))
    amount: number;

    @ApiProperty({ example: mock.dashboardLink })
    @IsNotEmpty()
    @Transform(({ value }) => encodeURI(value))
    @IsUrl()
    loginLink: string;
}

export class PropertyAllocationDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiPropertyOptional({ example: 4.5 })
    @IsNotEmpty()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    equity: number;
}

export class ResetPasswordDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiProperty({ example: mock.otp })
    @IsNotEmpty()
    otp: string;

    @ApiPropertyOptional({
        example: 4,
        description: 'Time to live in minutes for the OTP'
    })
    @IsNotEmpty()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    ttl: number;
}

export class UpdatedTermsAndConditionsDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;
}

export class VerifyEmailDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiProperty({ example: mock.otp })
    @IsNotEmpty()
    otp: string;

    @ApiPropertyOptional({
        example: 4,
        description: 'Time to live in minutes for the OTP'
    })
    @IsNotEmpty()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    ttl: number;
}

export class WalletTopUpDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    homeBuyerName: string;

    @ApiPropertyOptional({
        example: mock.amount,
        description: 'Amount to be credited to wallet'
    })
    @IsNotEmpty()
    @IsNaira()
    @Transform(({ value }) => FormatHelper.nairaFormatter.format(value))
    amount: number;

    @ApiProperty({ example: mock.requestId })
    @IsNotEmpty()
    transactionId: string;

    @ApiPropertyOptional({
        example: mock.amount,
        description: 'Current wallet balance after top-up'
    })
    @IsNotEmpty()
    @IsNaira()
    @Transform(({ value }) => FormatHelper.nairaFormatter.format(value))
    walletBalance: number;
}

export class AdminContributionReceivedDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    customerName: string;

    @ApiPropertyOptional({
        example: mock.amount,
        description: 'Contribution amount'
    })
    @IsNotEmpty()
    @IsNaira()
    @Transform(({ value }) => FormatHelper.nairaFormatter.format(value))
    amount: number;

    @ApiProperty({ example: mock.requestId })
    @IsNotEmpty()
    transactionID: string;
}

export class AdminPropertyAllocationDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    customerName: string;

    @ApiProperty({ example: 'Standard Plan' })
    @IsNotEmpty()
    planType: string;

    @ApiProperty({ example: mock.propertyDetails })
    @IsNotEmpty()
    propertyDetail: string;
}

export class AdminInviteAdminDto extends BaseEmailDto {
    @ApiProperty({ example: mock.firstName })
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ example: mock.dashboardLink })
    @IsNotEmpty()
    @Transform(({ value }) => encodeURI(value))
    @IsUrl()
    inviteLink: string;
}