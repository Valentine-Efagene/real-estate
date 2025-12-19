/**
 * Database Module - Centralized Entity Exports
 * All entities are imported from this module across the application
 * This makes it easier to manage entities when splitting into microservices
 */

// Re-export entities from their original locations
export { Tenant } from '../../tenant/tenant.entity';
export { User } from '../../user/user.entity';
export { Role } from '../../role/role.entity';
export { Permission } from '../../permission/permission.entity';
export { RefreshToken } from '../../refresh_token/refresh_token.entity';
export { Property } from '../../property/property.entity';
export { UserSuspension } from '../../user_suspensions/user_suspensions.entity';
export { PropertyMedia } from '../../property-media/property-media.entity';
export { PropertyDocument } from '../../property-document/property-document.entity';
export { default as Mortgage } from '../../mortgage/mortgage.entity';
export { default as MortgageDocument } from '../../mortgage/mortgage-document.entity';
export { default as MortgageStep } from '../../mortgage/mortgage-step.entity';
export { MortgageDownpaymentPlan } from '../../mortgage-downpayment/mortgage-downpayment.entity';
export { MortgageDownpaymentInstallment } from '../../mortgage-downpayment/mortgage-downpayment-installment.entity';
export { MortgageDownpaymentPayment } from '../../mortgage-downpayment/mortgage-downpayment-payment.entity';
export { default as MortgageType } from '../../mortgage-type/mortgage-type.entity';
export { Amenity } from '../../amenity/amenity.entity';
export { PasswordResetToken } from '../../password_reset_tokens/password_reset_tokens.entity';
export { Settings } from '../../settings/settings.entity';
export { BulkInviteTask } from '../../bulk-invite/bulk-invite-task.entity';
export { Wallet } from '../../wallet/wallet.entity';
export { Transaction } from '../../transaction/transaction.entity';
