//import { registerEnumType } from "@nestjs/graphql";

export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'rsa',
  SALES_ADMIN = 'sales_admin',
  FINANCE_ADMIN = 'finance_admin',
  SUPER_ADMIN = 'super_admin',
  PMB = 'rsa',
}


export enum ImageTypes {
  JPEG = 'jpeg',
  JPG = 'jpg',
  PNG = 'png',
  PDF = 'pdf',
}

export enum MaritalStatus {
  MARRIED = 'Married',
  SINGLE = 'Single',
  DIVORCED = 'Divorced'
}

export enum MortgageStatus {
  PROVISIONAL_OFFER_ACCEPTED = 'provisional_offer_accepted',
  PRE_APPROVAL = "pre_approval",
  APPLICATION_APPROVAL = 'application_approval',
  EQUITY_PAID = "equity_paid",
  DOCUMENT_SENT_TO_BANK = "document_sent_to_bank",
  OFFER_FROM_BANK = "offer_from_bank",
  OFFER_LETTER_ACCEPTANCE = 'offer_letter_acceptance',
  DISBURSEMENT = 'disbursement',
  CLOSED = 'closed',
  CANCELLED = "cancelled"
}

export enum RequestType {
  NHF = "nhf",
  COMMERCIAL = "commercial"
}