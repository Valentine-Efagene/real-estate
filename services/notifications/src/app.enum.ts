export enum ResponseMessage {
  CREATED = "Created Successfully",
  EMAIL_SENT = "Email Sent",
  SENT = "Sent",
  SMS_SENT = "SMS Sent",
  UPDATED = "Updated Successfully",
  DELETED = "Deleted Successfully",
  FETCHED = "Fetched Successfully",
  AUTHENTICATED = "Authenticated Successfully",
}


export enum AxiosErrorCode {
  ECONNREFUSED = "ECONNREFUSED",
}

export enum ErrorMessage {
  NO_REASON_DECLINE = 'A reason is required to decline',
  NO_COMMENT_DECLINE = 'A comment is required to decline',
  DOCUMENTS_NOT_APPROVED = 'Please ensure all documents have been approved',
}