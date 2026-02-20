import { z } from 'zod';

export const InviteCoApplicantSchema = z.object({
    email: z.string().email('Invalid email address'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    relationship: z.string().min(1), // SPOUSE, PARTNER, SIBLING, PARENT, BUSINESS_PARTNER, OTHER
    monthlyIncome: z.number().positive().optional(),
    employmentType: z
        .enum(['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED'])
        .optional(),
});

export const UpdateCoApplicantSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    relationship: z.string().min(1).optional(),
    monthlyIncome: z.number().positive().optional(),
    employmentType: z
        .enum(['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED'])
        .optional(),
});

export const RemoveCoApplicantSchema = z.object({
    reason: z.string().min(1).optional(),
});

export type InviteCoApplicantInput = z.infer<typeof InviteCoApplicantSchema>;
export type UpdateCoApplicantInput = z.infer<typeof UpdateCoApplicantSchema>;
export type RemoveCoApplicantInput = z.infer<typeof RemoveCoApplicantSchema>;
