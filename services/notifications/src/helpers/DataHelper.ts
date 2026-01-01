import { TemplateTypeValue } from '../validators/email.validator';

export class DataHelper {
    public static getDynamicTemplates(): TemplateTypeValue[] {
        return Object.entries(this.templatePathMap).filter(([_, value]) => {
            return value.includes('.hbs');
        }).map(([key]) => key as TemplateTypeValue);
    }

    public static templatePathMap: Record<TemplateTypeValue, string> = {
        'otp': 'otp.html',
        'welcomeMessage': 'welcome.html',
        'accountSuspended': 'accountSuspended.html',
        'accountVerified': 'accountVerified.html',
        'missedPayments': 'missedPayments.html',
        'propertyAllocation': 'propertyAllocation.html',
        'resetPassword': 'resetPassword.html',
        'updatedTermsAndConditions': 'updatedTermsAndCondition.html',
        'verifyEmail': 'verifyEmail.html',
        'walletTopUp': 'walletTopUp.html',
        'adminContributionReceived': 'admin/contributionReceived.html',
        'adminPropertyAllocation': 'admin/propertyAllocation.html',
        'adminInviteAdmin': 'admin/inviteAdmin.html',
    };

    public static templateTitle: Record<TemplateTypeValue, string> = {
        'otp': "Your OTP Code",
        'welcomeMessage': "Welcome",
        'accountSuspended': "Account Suspended",
        'accountVerified': "Account Verified",
        'missedPayments': "Missed Payments",
        'propertyAllocation': "Property Allocation",
        'resetPassword': "Reset Your Password",
        'updatedTermsAndConditions': "Updated Terms and Conditions",
        'verifyEmail': "Verify Your Email",
        'walletTopUp': "Wallet Top-Up Confirmation",
        'adminContributionReceived': "Contribution Received",
        'adminPropertyAllocation': "Property Allocation",
        'adminInviteAdmin': "Admin Invitation",
    };
}
