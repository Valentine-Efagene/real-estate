import { TemplateType } from "../email/email.enum";

export default class DataHelper {
    public static getDynamicTemplates(): TemplateType[] {
        return Object.entries(this.templatePathMap).filter(([key, value]) => {
            return value.includes('.hbs')
        }).map(([key, value]) => key as TemplateType)
    }

    public static templatePathMap: Record<TemplateType, string> = {
        [TemplateType.Otp]: 'otp.html',
        [TemplateType.WelcomeMessage]: 'welcome.html',
        [TemplateType.AccountSuspended]: 'accountSuspended.html',
        [TemplateType.AccountVerified]: 'accountVerified.html',
        [TemplateType.MissedPayments]: 'missedPayments.html',
        [TemplateType.PropertyAllocation]: 'propertyAllocation.html',
        [TemplateType.ResetPassword]: 'resetPassword.html',
        [TemplateType.UpdatedTermsAndConditions]: 'updatedTermsAndCondition.html',
        [TemplateType.VerifyEmail]: 'verifyEmail.html',
        [TemplateType.WalletTopUp]: 'walletTopUp.html',
        [TemplateType.AdminContributionReceived]: 'admin/contributionReceived.html',
        [TemplateType.AdminPropertyAllocation]: 'admin/propertyAllocation.html',
        [TemplateType.AdminInviteAdmin]: 'admin/inviteAdmin.html',
    };

    public static templateTitle: Record<TemplateType, string> = {
        [TemplateType.Otp]: "Your OTP Code",
        [TemplateType.WelcomeMessage]: "Welcome",
        [TemplateType.AccountSuspended]: "Account Suspended",
        [TemplateType.AccountVerified]: "Account Verified",
        [TemplateType.MissedPayments]: "Missed Payments",
        [TemplateType.PropertyAllocation]: "Property Allocation",
        [TemplateType.ResetPassword]: "Reset Your Password",
        [TemplateType.UpdatedTermsAndConditions]: "Updated Terms and Conditions",
        [TemplateType.VerifyEmail]: "Verify Your Email",
        [TemplateType.WalletTopUp]: "Wallet Top-Up Confirmation",
        [TemplateType.AdminContributionReceived]: "Contribution Received",
        [TemplateType.AdminPropertyAllocation]: "Property Allocation",
        [TemplateType.AdminInviteAdmin]: "Admin Invitation",
    };
}