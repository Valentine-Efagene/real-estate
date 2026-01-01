import { Router, Request, Response, NextFunction } from 'express';
import { getEmailService } from '../services/email.service';
import { createResponse } from '../helpers/response';
import { FormatHelper } from '../helpers/FormatHelper';
import {
    SendEmailSchema,
    SendRawHtmlEmailSchema,
    AccountSuspendedSchema,
    AccountVerifiedSchema,
    MissedPaymentsSchema,
    PropertyAllocationSchema,
    ResetPasswordSchema,
    UpdatedTermsAndConditionsSchema,
    VerifyEmailSchema,
    WalletTopUpSchema,
    AdminContributionReceivedSchema,
    AdminPropertyAllocationSchema,
    AdminInviteAdminSchema,
    TestTempSchema,
    TemplateTypeValue,
} from '../validators/email.validator';

const router = Router();
const emailService = getEmailService();

// Helper function to wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// Test email endpoint
router.post('/test-email', asyncHandler(async (req: Request, res: Response) => {
    const testDto = {
        to_email: '2benay+contribtest@gmail.com',
        subject: 'Test Enhanced Email Service',
        message: 'This is a test email sent via the enhanced email service with Office 365 as primary sender.'
    };

    const result = await emailService.sendEmail(testDto);
    if (!result || !result.headers) {
        res.status(500).json(createResponse(500, 'Enhanced email test failed', { error: 'Failed to send email' }));
        return;
    }
    res.json(createResponse(200, 'Enhanced email test completed', result.headers));
}));

// Test raw HTML email
router.post('/test-raw-html-email', asyncHandler(async (req: Request, res: Response) => {
    const parsed = SendRawHtmlEmailSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await emailService.sendHtmlEmail(parsed.data.to_email, parsed.data.html, parsed.data.subject);
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Account suspended email
router.post('/account-suspended', asyncHandler(async (req: Request, res: Response) => {
    const parsed = AccountSuspendedSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'accountSuspended';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Account verified email
router.post('/account-verified', asyncHandler(async (req: Request, res: Response) => {
    const parsed = AccountVerifiedSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'accountVerified';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Missed payments email
router.post('/missed-payments', asyncHandler(async (req: Request, res: Response) => {
    const parsed = MissedPaymentsSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'missedPayments';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data,
        amount: FormatHelper.formatNaira(parsed.data.amount),
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Property allocation email
router.post('/property-allocation', asyncHandler(async (req: Request, res: Response) => {
    const parsed = PropertyAllocationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'propertyAllocation';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Reset password email
router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'resetPassword';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Updated terms and conditions email
router.post('/updated-terms-and-conditions', asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdatedTermsAndConditionsSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'updatedTermsAndConditions';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Verify email
router.post('/verify-email', asyncHandler(async (req: Request, res: Response) => {
    const parsed = VerifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'verifyEmail';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Wallet top-up email
router.post('/wallet-top-up', asyncHandler(async (req: Request, res: Response) => {
    const parsed = WalletTopUpSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'walletTopUp';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data,
        amount: FormatHelper.formatNaira(parsed.data.amount),
        walletBalance: FormatHelper.formatNaira(parsed.data.walletBalance),
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Admin: Contribution received
router.post('/admin/contribution-received', asyncHandler(async (req: Request, res: Response) => {
    const parsed = AdminContributionReceivedSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'adminContributionReceived';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data,
        amount: FormatHelper.formatNaira(parsed.data.amount),
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Admin: Property allocation
router.post('/admin/property-allocation', asyncHandler(async (req: Request, res: Response) => {
    const parsed = AdminPropertyAllocationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'adminPropertyAllocation';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Admin: Invite admin
router.post('/admin/invite-admin', asyncHandler(async (req: Request, res: Response) => {
    const parsed = AdminInviteAdminSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const templateName: TemplateTypeValue = 'adminInviteAdmin';
    const response = await emailService.sendTemplateEmail({
        templateName,
        ...parsed.data
    });
    res.json(createResponse(response.status, 'Email sent', response.headers));
}));

// Test template loading
router.post('/test-temp', asyncHandler(async (req: Request, res: Response) => {
    const parsed = TestTempSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const result = await emailService.testTemp(parsed.data.path);
    res.json(createResponse(200, 'Template loaded', result));
}));

// List template files
router.get('/templates', asyncHandler(async (_req: Request, res: Response) => {
    const files = await emailService.listTemplateFiles();
    res.json(createResponse(200, 'Template files', files));
}));

// Get email constants
router.get('/constants', asyncHandler(async (_req: Request, res: Response) => {
    const constants = await emailService.getConstants();
    res.json(createResponse(200, 'Email constants', constants));
}));

export default router;
