export enum DocumentStatus {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  PENDING = 'PENDING',
}

export enum S3Folder {
  AVATAR = 'mediacraft/avatar',
  LOGO = 'mediacraft/logo',
  DOCUMENT = 'mediacraft/document',
  BULK_INVITES = 'mediacraft/bulk-invites',
}

export enum DocumentModule {
  DEVELOPER = 'DEVELOPER',
  DEVELOPER_DIRECTOR = 'DEVELOPER_DIRECTOR',
  PROPOSED_DEVELOPMENT = 'PROPOSED_DEVELOPMENT',
}

export enum ResponseMessage {
  INITIATED = "INITIATED",
  PAYMENT_SUCCESSFUL = "Payment Successful",
  CREATED = "Created Successfully",
  EMAIL_SENT = "Email Sent",
  UPDATED = "Updated Successfully",
  DELETED = "Deleted Successfully",
  FETCHED = "Fetched Successfully",
  DONE = "Done",
  AUTHENTICATED = "Authenticated Successfully",
  USER_SIGNUP_SUCCESSFUL = "Account created. Please check for verification email.",
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  NGN = 'NGN',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

export enum QueueNames {
  EMAIL = 'EMAIL',
  BULK_INVITE = 'BULK_INVITE',
}