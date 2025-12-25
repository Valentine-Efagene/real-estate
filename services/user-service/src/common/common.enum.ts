export enum QueueNames {
    MAIL = 'mail',
}

export enum ResponseMessage {
    CREATED = 'Created successfully',
    UPDATED = 'Updated successfully',
    DELETED = 'Deleted successfully',
    FETCHED = 'Fetched successfully',
    SUCCESS = 'Operation successful',
    ERROR = 'An error occurred',
    EMAIL_SENT = 'Email sent successfully',
    AUTHENTICATED = 'Authenticated successfully',
    USER_SIGNUP_SUCCESSFUL = 'User signup successful',
    DONE = 'Done',
}

export enum S3Folder {
    AVATARS = 'avatars',
    DOCUMENTS = 'documents',
    MEDIA = 'media',
    TEMP = 'temp',
}
